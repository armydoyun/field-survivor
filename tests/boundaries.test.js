import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { createProgression } from '../src/growth/progression.js';
import { commitReroll } from '../src/growth/commands.js';
import { createCombat } from '../src/combat/runtime.js';
import { createCollisions } from '../src/combat/collisions.js';
import { createPopulation } from '../src/combat/population.js';
import { createGrowthActions } from '../src/ui/growth-actions.js';
import { upgrades } from '../src/data/upgrades.js';
import { makeChoices, availableUpgrades } from '../src/growth/cards.js';
import { enemyType } from '../src/data/enemies.js';
import { movePlayer } from '../src/input/movement.js';
import { ENEMY_LIMIT, DESPAWN_RADIUS, GUARDIAN_YIELD } from '../src/core/config.js';
const source = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
function state(){const profile=initialProfile();return {profile,run:createRun(profile,{maxHp:100,xpNext:24})};}
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;}
const quiet = {popup(){},ring(){},showEnemyDeath(){},showEnemyHit(){},showPlayerHit(){}};

test('statistics works without world/combat instances and reads frozen state',()=>{
  const s=state(), statistics=createStatistics({sessionState:s});
  s.run.up.power=3;s.run.up.haste=2;s.run.journey.keystone='drift';s.run.momentumTime=1;
  freeze(s.profile);freeze(s.run);assert.ok(statistics.stats().maxHp>0);
});
test('progression owns upgrade and specialization records and rejects unavailable fusions',()=>{
  const s=state(), progression=createProgression({sessionState:s,statistics:createStatistics({sessionState:s})});
  s.run.pending=1;s.run.choices=['vitality'];s.run.player.hp=90;
  assert.equal(progression.chooseUpgrade('vitality'),true);assert.equal(s.run.player.hp,115);assert.equal(s.run.up.vitality,1);assert.equal(s.run.pending,0);
  s.run.up.pulse=4;assert.equal(progression.chooseBranch('tracking').option.id,'tracking');
  const old=structuredClone(s.run);assert.equal(progression.chooseFusion('unknown'),null);assert.deepEqual(s.run,old);assert.ok(s.run.logs.some(line=>line.includes('전문화')));
});
test('completed growth converts once; valid pending choices survive preparation and resume',()=>{
  const s=state(), g=createProgression({sessionState:s,statistics:createStatistics({sessionState:s})});
  assert.equal(g.prepareUpgrade(),null);s.run.pending=2;const cards=g.choices();assert.deepEqual(g.prepareUpgrade(),{converted:0});assert.equal(s.run.choices,cards);assert.equal(g.choices(),cards);
  for(const u of upgrades)s.run.up[u.id]=u.max;s.run.choices=null;const before=s.run.gold;
  assert.deepEqual(g.prepareUpgrade(),{converted:2});assert.equal(s.run.gold,before+40);assert.equal(s.run.pending,0);assert.equal(g.prepareUpgrade(),null);assert.equal(s.run.gold,before+40);
});
test('rerolls spend one charge, select eligible fresh choices and leave invalid attempts untouched',()=>{
  const s=state(), r=s.run;r.pending=1;r.rerolls=2;r.choices=makeChoices(r,[],()=>0);const old=r.choices.slice();
  assert.equal(commitReroll(r,()=>0),true);assert.equal(r.rerolls,1);assert.equal(new Set(r.choices).size,r.choices.length);assert.ok(r.choices.some(id=>!old.includes(id)));assert.ok(r.choices.every(id=>availableUpgrades(r).some(u=>u.id===id)));
  for(const mutate of [()=>{r.pending=0;},()=>{r.pending=1;r.rerolls=0;},()=>{r.rerolls=2;r.choices=null;}]){mutate();const before=structuredClone(r);assert.equal(commitReroll(r,()=>{throw Error('unexpected RNG');}),false);assert.deepEqual(r,before);}
});
test('progression resolves the current run/profile after replacement and keeps other sessions isolated',()=>{
  const s=state(), other=state(), g=createProgression({sessionState:s,statistics:createStatistics({sessionState:s})}), former=s.run;
  s.profile=initialProfile();s.profile.perks.learning=2;s.run=createRun(s.profile,{maxHp:100,xpNext:24});g.collect(100);
  assert.ok(s.run.level>1);assert.equal(former.xp,0);assert.equal(former.level,1);assert.equal(other.run.xp,0);
  const enemy={kind:0,x:0,y:0};g.rewardKill(enemy,20,2);assert.equal(s.run.gold,enemyType[0].gold*2);assert.equal(s.run.gems[0].xp,40);
});
test('combat death callbacks retain pre-death, loot, feedback and objective ordering',()=>{
  const s=state(), calls=[], enemy={id:1,kind:0,hp:5,maxHp:5,x:0,y:0};s.run.enemies=[enemy];
  const combat=createCombat({sessionState:s,statistics:{stats:()=>({burst:0})},enemyRuntime:{},difficulty:{rewardXp:()=>7},progression:{rewardKill:(e,xp,m)=>{assert.equal(s.run.kills,1);assert.equal(e.hp,0);assert.equal(xp,7);assert.equal(m,2);calls.push('loot');}},feedback:{...quiet,showEnemyDeath:()=>calls.push('feedback')},onEnemyDying:e=>{assert.equal(e.hp,5);assert.equal(s.run.kills,0);calls.push('dying');},onEnemyKilled:()=>calls.push('objective'),onChoice:()=>assert.fail('unexpected choice')});
  combat.killEnemy(enemy,0,2);assert.deepEqual(calls,['dying','loot','feedback','objective']);
});
test('named guardian lethal hit lowers its weapons without a modal, ordinary kill rewards or death notifications',()=>{
  const s=state(), enemy={id:1,kind:3,named:true,hp:1,maxHp:100,phase:0,x:0,y:0}, calls=[];s.run.enemies=[enemy];s.run.time=200;
  const reject=()=>assert.fail('ordinary death workflow must not run');
  const combat=createCombat({sessionState:s,statistics:{},enemyRuntime:{},difficulty:{rewardXp:reject},progression:{rewardKill:reject},feedback:quiet,onEnemyDying:reject,onEnemyKilled:reject,onChoice:mode=>calls.push(mode)});
  combat.damage(enemy,100);assert.deepEqual(calls,[]);assert.equal(s.run.kills,0);assert.equal(s.run.bossChoiceId,1);assert.equal(enemy.phase,3);assert.equal(enemy.yieldUntil,200+GUARDIAN_YIELD);
});
test('projectiles resolve nearest hits first and stop the frame immediately when a choice opens',()=>{
  const s=state(), view={mode:'playing'}, hits=[];s.run.player.x=s.run.player.y=0;
  const near={id:1,kind:0,hp:10,x:20,y:0,radius:3},far={id:2,kind:0,hp:10,x:80,y:0,radius:3};s.run.enemies=[far,near];
  const shot={x:0,y:0,vx:100,vy:0,radius:1,life:2,hit:[],pierce:3,kind:'pulse',damage:100};s.run.shots=[shot];
  const c=createCollisions({sessionState:s,view,statistics:{},enemyRuntime:{},weapons:{},feedback:quiet,combat:{damage:e=>{hits.push(e.id);view.mode='bosschoice';}}});
  assert.equal(c.tickShots(1,{frost:0}),false);assert.deepEqual(hits,[1]);assert.deepEqual(shot.hit,[1]);assert.equal(shot.pierce,2);assert.equal(s.run.shots.length,1);
});
test('population retains objective/boss/core targets while discarding dead and distant ordinary enemies',()=>{
  const s=state(), p=s.run.player,x=p.x+DESPAWN_RADIUS+100;
  const enemy=(id,extra={})=>({id,kind:0,hp:1,x,y:p.y,...extra});
  s.run.enemies=[enemy(1),enemy(2,{kind:3,phase:0}),enemy(3),enemy(4,{coreNode:true}),enemy(5,{hp:0})];s.run.objective={id:'hunter',phase:1,targetId:3};
  const population=createPopulation({sessionState:s});population.maintainEnemies();assert.deepEqual(s.run.enemies.map(e=>e.id),[2,3,4]);assert.equal(s.run.enemies[0].x,p.x+620);assert.equal(s.run.enemies[1].x,p.x+620);
});
test('population signals successful guardian arrivals only, and capacity defers the encounter',()=>{
  for(const full of [false,true]){
    const s=state(),r=s.run,calls=[];r.time=960;r.nextBoss=960;r.spawnClock=100;r.stage=0;r.waveIndex=3;if(full)r.enemies=Array.from({length:ENEMY_LIMIT},(_,id)=>({id,hp:1,kind:0}));
    const population=createPopulation({sessionState:s,difficulty:{paceAt:()=>({index:0,cap:0,interval:1,extra:0}),pressureProfile:()=>({spawn:1})},enemyRuntime:{spawnEnemy:kind=>{assert.equal(kind,3);calls.push('spawn');return {kind};}},encounters:{spawnTacticalWave(){}},feedback:quiet,onGuardianSpawned:()=>calls.push('arrival')});
    population.spawnPopulation(.01);assert.deepEqual(calls,full?[]:['spawn','arrival']);assert.equal(r.nextBoss,1200);
  }
});
test('growth UI guards block commands and delegates accepted changes before mode and save',()=>{
  const s=state(),view={mode:'paused'},calls=[],keys=new Set(['KeyD']);s.run.pending=1;
  const ui=createGrowthActions({sessionState:s,view,platform:{keys},feedback:quiet,screen:{setMode:mode=>{calls.push(mode);view.mode=mode;}},storage:{save:()=>calls.push('save')},progression:{rerollUpgrade:()=>{calls.push('reroll');return true;}}});
  ui.rerollUpgrade();assert.deepEqual(calls,[]);view.mode='levelup';ui.rerollUpgrade();assert.deepEqual(calls,['reroll','levelup','save']);assert.equal(keys.size,0);
});
test('player movement normalizes diagonals and opposite keys decay momentum without moving',()=>{
  const s=state(),r=s.run,x=r.player.x,y=r.player.y;assert.equal(movePlayer(r,new Set(['KeyD','KeyS']),{speed:190},.5),true);assert.ok(Math.abs(Math.hypot(r.player.x-x,r.player.y-y)-95)<1e-10);assert.equal(r.momentumTime,1);
  const position={x:r.player.x,y:r.player.y};assert.equal(movePlayer(r,new Set(['KeyD','KeyA']),{speed:190},.25),false);assert.equal(r.momentumTime,.75);assert.deepEqual({x:r.player.x,y:r.player.y},position);
});

test('feature ownership boundaries prevent calculation/UI/combat dependency knots from returning',()=>{
  const params=file=>source(file).match(/export function create\w+\(\{([^}]+)\}/)[1].split(',').map(s=>s.trim());
  assert.deepEqual(params('src/core/statistics.js'),['sessionState']);assert.deepEqual(params('src/growth/progression.js'),['sessionState','statistics']);assert.deepEqual(params('src/core/difficulty.js'),['sessionState','statistics']);
  for(const file of ['src/core/statistics.js','src/growth/progression.js','src/combat/weapon-parameters.js'])assert.doesNotMatch(source(file),/\b(?:document|window|localStorage|screen|view|platform|storage|session)\b/);
  for(const file of ['src/ui/growth-metrics.js','src/core/difficulty.js'])assert.ok(!params(file).includes('fusions'),file);
  for(const file of ['src/world/journey.js','src/world/objectives.js','src/world/sites.js'])assert.ok(!params(file).includes('combat'),file);
  assert.ok(!params('src/world/journey.js').includes('objectives'));assert.match(source('src/world/objectives.js'),/function resolveKillObjective/);
  const combatParams=params('src/combat/runtime.js');for(const name of ['view','screen','growthActions','journey','objectives','storage'])assert.ok(!combatParams.includes(name),name);
  assert.doesNotMatch(source('src/ui/growth-actions.js'),/\b(?:commitUpgrade|commitSpecialization|commitFusion|makeChoices|Math\.random|appendRecord)\b/);
  assert.doesNotMatch(source('src/ui/growth-actions.js'),/sessionState\.(?:run|profile)[\w.]*\s*=(?!=)/);
  assert.doesNotMatch(source('src/app/update.js'),/\b(?:Math\.random|segmentHit|segmentEntry|advanceEnemyBullet|spawnClock|nextBoss|ambientClock|shot\.pierce)\b/);
});
test('feature guide points to existing source files and named verification suites',()=>{
  const guide=source('DEVELOPMENT.md'),paths=[...guide.matchAll(/`((?:src|tests)\/[\w./-]+\.m?js)`/g)].map(m=>m[1]);assert.ok(paths.length>=30);
  for(const path of paths)assert.ok(existsSync(new URL('../'+path,import.meta.url)),path);
});
