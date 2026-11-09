import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createEnemySpawner } from '../src/combat/spawner.js';
import { createHostileAttacks, advanceEnemyBullet, canWindup } from '../src/combat/hostile-attacks.js';
import { createEnemyBehavior } from '../src/combat/enemies.js';
import { createGuardians, guardianMood, guardianPool } from '../src/combat/guardians.js';
import { createCoreBoss } from '../src/combat/core-boss.js';
import { nearestEnemyIn, nearestEnemy } from '../src/combat/targeting.js';
import { applySlow, refreshSlow, setPush, pushEnemy, advancePush } from '../src/combat/control.js';
import { hazardHit, hazardGeometry } from '../src/math/geometry.js';
import { movementVector } from '../src/input/movement.js';

const fresh = () => createRun(initialProfile(), { maxHp: 100, xpNext: 18 });
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} vs ${b}`);
function harness(random=()=>.5) {
  const profile=initialProfile(), run=fresh(), hits=[], rings=[];
  const paceAt=()=>({hp:1,speed:1,elite:0,cap:165}), pressure={spawn:1,elite:0,tactics:1,shot:1};
  const pressureProfile=()=>pressure, lateCombat=r=>Math.max(0,Math.min(1,(r.time-600)/1080));
  const spawner=createEnemySpawner({paceAt,pressureProfile,lateCombat,enemyHealthScale:()=>1,random});
  const camera={owner:null,x:480,y:270};
  const spawnEnemy=(r,kind)=>spawner.spawnEnemy(r,kind,camera);
  const hurtPlayer=(amount,r)=>hits.push({amount,owner:r});
  const attacks=createHostileAttacks({lateCombat,pressureProfile,hurtPlayer});
  const vector={x:0,y:0}, movement=()=>({...vector});
  const guardians=createGuardians({attacks,movementVector:movement,hurtPlayer,random});
  const core=createCoreBoss({spawnEnemy,finalRating:()=>({power:1200,nodeHp:1000,hp:10000}),hurtPlayer});
  const behavior=createEnemyBehavior({stats:()=>({speed:190}),paceAt,movementVector:movement,spawnEnemy,moveGuardian:guardians.moveGuardian,moveCore:core.moveCore,attacks,hurtPlayer,random,ring:(...args)=>rings.push(args)});
  return {profile,run,hits,rings,spawner,camera,spawnEnemy,attacks,guardians,core,behavior,pressure,vector};
}

test('movement input normalizes diagonals and cancels opposite keys', () => {
  assert.deepEqual(movementVector(new Set(['KeyA','KeyD'])),{x:0,y:0});
  const v=movementVector(new Set(['KeyW','ArrowRight']));close(Math.hypot(v.x,v.y),1);assert.ok(v.x>0&&v.y<0);
});
test('slows retain the strongest active amount, extend identical effects and halve boss slow', () => {
  const e={kind:0};applySlow(e,.4,2,10);applySlow(e,.2,10,10);applySlow(e,.4,3,10);
  assert.equal(e.slowEffects.length,2);assert.equal(e.slowUntil,13);assert.equal(e.slowAmount,.4);
  refreshSlow(e,13);assert.equal(e.slowAmount,.2);assert.equal(e.slowUntil,20);refreshSlow(e,20);assert.equal(e.slowAmount,0);
  const boss={kind:3};applySlow(boss,.4,2,10);assert.equal(boss.slowAmount,.2);
});
test('push remains bounded, frame-rate independent and ignores stationary or dead targets', () => {
  const a={kind:0,id:1,x:0,y:0,hp:10},b={...a};setPush(a,200,0);setPush(b,200,0);
  advancePush(a,.2);advancePush(b,.1);advancePush(b,.1);close(a.x,b.x);close(a.pushX,b.pushX);assert.ok(a.x<120);
  for(const extra of [{kind:3},{coreNode:true},{hp:0}]){const e={...a,...extra,pushX:0,pushY:0};pushEnemy(e,-1,0,50);assert.equal(e.pushX,0);}
});
test('spawner retains IDs, stats, elite promotion guards and random-only XP pressure scaling', () => {
  const h=harness(),e=h.spawnEnemy(h.run,0);assert.equal(e.id,1);assert.equal(e.hp,18);assert.equal(e.speed,56);
  const boss=h.spawnEnemy(h.run,3);assert.equal(boss.aiTimer,2.1);assert.equal(h.run.nextId,3);
  h.spawner.promoteElite(h.run,e);assert.equal(e.hp,18*1.9);const hp=e.hp;h.spawner.promoteElite(h.run,e);assert.equal(e.hp,hp);
  h.spawner.promoteElite(h.run,boss);assert.equal(boss.elite,false);
  h.pressure.spawn=2;assert.equal(h.spawnEnemy(h.run,-1).xpScale,.5);assert.equal(h.spawnEnemy(h.run,1).xpScale,1);
});
test('weighted spawning observes timed unlocks, live species caps and off-screen placement', () => {
  const h=harness(()=>1-Number.EPSILON);assert.deepEqual(h.spawner.spawnWeights(0).map(x=>x.kind),[0]);
  h.run.time=800;assert.equal(h.spawner.chooseSpawnKind(h.run),10);
  h.run.enemies=[{kind:10,hp:1},{kind:10,hp:1}];assert.equal(h.spawner.chooseSpawnKind(h.run),8);
  h.run.enemies[0].hp=0;assert.equal(h.spawner.chooseSpawnKind(h.run),10);
  h.camera.owner=h.run;const e={x:480,y:270,radius:11};h.spawner.placeOffscreen(h.run,e,h.camera);
  assert.ok(Math.abs(e.x-480)>=960/2+11+30||Math.abs(e.y-270)>=540/2+11+30);
});
test('enemy systems can operate on multiple runs without retaining or replacing their state', () => {
  const h=harness(),a=h.run,b=fresh(),ea=h.spawnEnemy(a,0),eb=h.spawnEnemy(b,0);
  ea.x=a.player.x-200;ea.y=a.player.y;eb.x=b.player.x-200;eb.y=b.player.y;
  const before=structuredClone(a);h.behavior.moveEnemy(b,h.profile,eb,.1);assert.deepEqual(a,before);assert.ok(eb.x>b.player.x-200);
  assert.equal(a.enemies.length,1);assert.equal(b.enemies.length,1);
});
test('projectile caps and telegraphed speed remain fixed while current pressure changes', () => {
  const h=harness(),e={id:1,kind:4,x:0,y:0,shotScale:1.25};h.attacks.enemyShot(h.run,e,0,200,10);
  assert.equal(h.run.bullets[0].vx,250);h.pressure.shot=2;assert.equal(h.attacks.shotScaleFor(h.run,e),1.25);
  h.run.bullets=Array.from({length:70},()=>({}));assert.equal(h.attacks.enemyShot(h.run,e,0,200,10),false);
  assert.equal(h.attacks.enemyShot(h.run,e,0,200,10,5,3,true),true);
  h.run.bullets=Array.from({length:100},()=>({}));assert.equal(h.attacks.enemyShot(h.run,e,0,200,10,5,3,true),false);
});
test('returning and curved bullets integrate correctly across reversal and curve-end boundaries', () => {
  const b={kind:'return',age:.8,x:0,y:0,vx:100,vy:0};advanceEnemyBullet(b,.1);close(b.x,0);assert.equal(b.vx,-100);close(b.age,.9);
  const a={kind:'arc',turn:1,age:0,x:0,y:0,vx:100,vy:0},c={...a};advanceEnemyBullet(a,1);advanceEnemyBullet(c,.5);advanceEnemyBullet(c,.5);
  close(a.x,100*Math.sin(1));close(a.y,100*(1-Math.cos(1)));close(a.x,c.x);close(a.y,c.y);close(Math.hypot(a.vx,a.vy),100);
  const x=a.x;advanceEnemyBullet(a,.5);close(a.x,x+Math.cos(1)*50);
});
test('hostile ground zones enforce caps and vanish before damage after owner death or expiry', () => {
  const h=harness(),r=h.run,e={id:1,kind:10,hp:10,phase:0};r.enemies=[e];
  for(let i=0;i<3;i++)assert.equal(h.attacks.groundMark(r,e,r.player.x,r.player.y,48,1,2,12),true);
  assert.equal(h.attacks.groundMark(r,e,0,0,48,1,2,12),false);
  r.time=1;h.attacks.tickHazards(r);assert.equal(h.hits.length,3);assert.ok(h.hits.every(x=>x.owner===r));
  e.hp=0;h.attacks.tickHazards(r);assert.equal(r.hazards.length,0);assert.equal(h.hits.length,3);
  e.hp=10;h.attacks.groundMark(r,e,0,0,48,0,1,12);r.time=2;h.attacks.tickHazards(r);assert.equal(r.hazards.length,0);
});
test('shared beam/ring geometry preserves actual hit areas and the ring opening', () => {
  const beam={shape:'beam',x:0,y:0,angle:0,turn:0,length:100,width:20,fireAt:0,endAt:1};
  assert.equal(hazardHit(beam,{x:50,y:20},.5),true);assert.equal(hazardHit(beam,{x:50,y:22},.5),false);
  const ring={shape:'ring',x:0,y:0,angle:0,turn:0,radius:100,width:16,gap:Math.PI/2,fireAt:0,endAt:1};
  assert.equal(hazardHit(ring,{x:100,y:0},1),false);assert.equal(hazardHit(ring,{x:-100,y:0},1),true);assert.equal(hazardHit(ring,{x:0,y:0},1),false);
  assert.equal(hazardGeometry(ring,0).radius,26);assert.equal(hazardGeometry(ring,1).radius,100);
});
test('windup concurrency tightens during boss attacks and excludes the actor itself', () => {
  const r=fresh(),e={id:1,kind:4,hp:10,phase:1};r.enemies=[e,{kind:4,hp:10,phase:1},{kind:7,hp:10,phase:2}];
  assert.equal(canWindup(r,e),true);r.enemies.push({kind:3,hp:100,phase:1});assert.equal(canWindup(r,e),false);
});
test('freeze stops ordinary AI while bosses and static core nodes follow their own rules', () => {
  const h=harness(),r=h.run;r.anomalyChoices.clock='hold';r.anomalyUntil.clock=10;r.time=0;
  const e=h.spawnEnemy(r,0);e.x=r.player.x-200;e.y=r.player.y;const before=structuredClone(e);h.behavior.moveEnemy(r,h.profile,e,.1);assert.deepEqual(e,{...before,slowAmount:0,slowUntil:0});
  const boss=h.spawnEnemy(r,3);boss.phase=4;boss.aiTimer=2;h.behavior.moveEnemy(r,h.profile,boss,.1);close(boss.aiTimer,1.9);
  const node={coreNode:true,flash:.5};h.behavior.moveEnemy(r,h.profile,node,.1);close(node.flash,.4);
});
test('seeder locks predicted ground coordinates throughout its tell instead of tracking the player', () => {
  const h=harness(),r=h.run;r.time=1200;h.vector.x=1;const e=h.spawnEnemy(r,10);e.x=r.player.x-300;e.y=r.player.y;e.aiTimer=0;
  h.behavior.moveEnemy(r,h.profile,e,.01);assert.equal(e.phase,1);const x=e.markX;close(x,r.player.x+307.8);
  r.player.x+=100;h.behavior.moveEnemy(r,h.profile,e,.6);assert.equal(r.hazards.length,1);assert.equal(r.hazards[0].x,x);
});
test('guardian pools, memories and forced attack behavior preserve all five patterns', () => {
  const h=harness(),r=h.run,p=h.profile,e=h.spawnEnemy(r,3);e.x=r.player.x-300;e.y=r.player.y;
  assert.deepEqual(guardianPool(r,e),['bloom','fan','charge']);e.hp=e.maxHp*.7;assert.ok(guardianPool(r,e).includes('sweep'));
  p.memory.guardian.ended=2;assert.equal(guardianMood(p,r),'end');r.guardianOrder='spare';assert.equal(guardianMood(p,r),'spare');
  for(const pattern of ['bloom','fan','charge','sweep','bombard']){
    r.bullets=[];r.hazards=[];h.guardians.startGuardianAttack(r,p,e,pattern);assert.equal(e.guardianAttack.kind,pattern);e.aiTimer=0;
    h.guardians.moveGuardian(r,p,e,.01,e.speed,300,1,0);
    if(pattern==='bombard'){assert.equal(r.hazards.length,3);assert.equal(e.phase,4);}
    else {h.guardians.moveGuardian(r,p,e,.01,e.speed,300,1,0);if(pattern!=='charge')assert.ok(r.bullets.length>0);else assert.ok(e.x>r.player.x-300);}
  }
});
test('core creation is idempotent, adds one node per dismantled guardian and opens after nodes are severed', () => {
  for(const [ended,salvaged,count,hp]of [[0,false,2,1000],[1,false,3,800],[1,true,3,650],[3,false,5,800],[6,false,5,800]]){
    const h=harness(),r=h.run;r.guardianFate={spare:0,end:ended};if(salvaged)r.journey.outcomes=[{slot:2,success:true}];
    const c=h.core.ensureCore(r,h.profile);assert.equal(h.core.ensureCore(r,h.profile),c);assert.equal(r.enemies.length,count);assert.ok(r.enemies.every(e=>e.coreNode&&e.hp===hp));assert.equal(c.shields,0);
    for(const node of r.enemies)node.hp=0;r.logs=[];h.profile.memory.archive=[];
    const boss=h.spawnEnemy(r,3);boss.final=true;boss.x=r.player.x-240;boss.y=r.player.y;
    h.core.moveCore(r,h.profile,boss,.1);assert.equal(c.phase,1);assert.equal(r.logs.length,1);assert.equal(h.profile.memory.archive.length,1);
  }
});
test('returned guardians shield one core attack each, then damage resumes', () => {
  const h=harness(),r=h.run;r.guardianFate={spare:5,end:0};const c=h.core.ensureCore(r,h.profile);assert.equal(c.shields,3);for(const node of r.enemies)node.hp=0;
  const boss=h.spawnEnemy(r,3);boss.final=true;boss.x=r.player.x-240;boss.y=r.player.y;h.core.moveCore(r,h.profile,boss,.1);
  for(let attack=0;attack<4;attack++){c.attack={kind:'ring',x:r.player.x-110,y:r.player.y,angle:0,fireAt:r.time,endAt:r.time+.24};for(let i=0;i<3;i++){h.core.moveCore(r,h.profile,boss,.01);r.time+=.01;}r.time+=1;}
  assert.equal(c.shields,0);assert.equal(h.hits.length,3);
});
test('burned signals strengthen the core and add the voice pattern; heard signals and the witness help in phase 2', () => {
  const h=harness(),r=h.run;r.finalStep=2;r.signalChoices=['burn','burn','hear'];h.core.spawnFinalCore(r,h.profile);assert.equal(r.enemies.find(e=>e.final).maxHp,Math.round(10000*1.12));
  const seen=new Set(),c=r.journey.core,boss=r.enemies.find(e=>e.final);for(const node of r.enemies.filter(e=>e.coreNode))node.hp=0;
  for(let i=0;i<400;i++){h.core.moveCore(r,h.profile,boss,.05);r.time+=.05;if(c.attack)seen.add(c.attack.kind);}assert.ok(seen.has('voice'));
  const calm=harness(),q=calm.run;q.finalStep=2;q.signalChoices=['burn','hear','hear'];calm.core.spawnFinalCore(q,calm.profile);const kinds=new Set();for(const node of q.enemies.filter(e=>e.coreNode))node.hp=0;const b=q.enemies.find(e=>e.final);
  for(let i=0;i<400;i++){calm.core.moveCore(q,calm.profile,b,.05);q.time+=.05;if(q.journey.core.attack)kinds.add(q.journey.core.attack.kind);}assert.ok(!kinds.has('voice'));
  const healed=[],w=harness(),x=w.run;x.signalChoices=['hear','hear'];x.npc.state='heard';const core=createCoreBoss({spawnEnemy:w.spawnEnemy,finalRating:()=>({power:1200,nodeHp:1000,hp:10000}),hurtPlayer:()=>{},healPlayer:amount=>healed.push(amount)});
  const cc=core.ensureCore(x,w.profile);for(const node of x.enemies)node.hp=0;const fb=w.spawnEnemy(x,3);fb.final=true;fb.x=x.player.x-240;fb.y=x.player.y;core.moveCore(x,w.profile,fb,.1);assert.deepEqual(healed,[30]);
  x.time=cc.next;core.moveCore(x,w.profile,fb,.01);assert.ok(Math.abs(cc.attack.fireAt-x.time-1.4)<1e-9);
});
test('each dismantled guardian shortens the rest between phase-2 core attacks down to a floor', () => {
  const rest=ended=>{const h=harness(),r=h.run;r.guardianFate={spare:0,end:ended};const c=h.core.ensureCore(r,h.profile);for(const node of r.enemies)node.hp=0;const boss=h.spawnEnemy(r,3);boss.final=true;boss.x=r.player.x-240;boss.y=r.player.y;h.core.moveCore(r,h.profile,boss,.1);
    c.attack={kind:'ring',x:r.player.x+500,y:r.player.y,angle:0,fireAt:r.time,endAt:r.time};r.time+=.01;h.core.moveCore(r,h.profile,boss,.01);return +(c.next-r.time).toFixed(4);};
  assert.equal(rest(0),.95);assert.equal(rest(1),+(.95*.8).toFixed(4));assert.equal(rest(3),+(.95*.8**3).toFixed(4));assert.equal(rest(6),.45);
});
test('the voice attack hits a player who stays at its centre, unlike the ring attack', () => {
  for(const [kind,hitsAtCentre]of [['voice',true],['ring',false]]){const h=harness(),r=h.run;const c=h.core.ensureCore(r,h.profile);for(const node of r.enemies)node.hp=0;const boss=h.spawnEnemy(r,3);boss.final=true;boss.x=r.player.x-240;boss.y=r.player.y;h.core.moveCore(r,h.profile,boss,.1);h.hits.length=0;
    c.attack={kind,x:r.player.x,y:r.player.y,angle:0,fireAt:r.time,endAt:r.time+.24};h.core.moveCore(r,h.profile,boss,.01);assert.equal(h.hits.length>0,hitsAtCentre,kind);}
});
test('final core spawn belongs to its module and is guarded against duplicates and wrong phases', () => {
  const h=harness(),r=h.run;h.core.spawnFinalCore(r,h.profile);assert.equal(r.enemies.length,0);
  r.finalStep=2;h.core.spawnFinalCore(r,h.profile);assert.equal(r.enemies.filter(e=>e.final).length,1);const boss=r.enemies.find(e=>e.final);assert.equal(boss.maxHp,10000);assert.equal(boss.radius,42);
  const count=r.enemies.length;h.core.spawnFinalCore(r,h.profile);assert.equal(r.enemies.length,count);
});
test('target selection ignores inactive bosses and has deterministic strict-radius ties', () => {
  const r=fresh();r.player.x=r.player.y=0;const a={id:1,x:10,y:0,hp:10,kind:0},b={...a,id:2},boss={id:3,x:1,y:0,hp:100,kind:3,phase:3};r.enemies=[boss,a,b];
  assert.equal(nearestEnemyIn(r,10),null);assert.equal(nearestEnemyIn(r,11),a);assert.equal(nearestEnemyIn(r,11,0,0,[1]),b);assert.equal(nearestEnemy(r),a);
});
test('enemy modules are acyclic and never import current state, DOM or the application entry point', () => {
  const seen=new Set(),active=new Set();function visit(url){if(active.has(url.href))assert.fail('cycle: '+url.href);if(seen.has(url.href))return;active.add(url.href);
    const text=readFileSync(url,'utf8');assert.doesNotMatch(text,/from ['"][^'"]*(?:core\/state|game\.js|main\.js)['"]/);assert.doesNotMatch(text,/\b(?:document|window|localStorage)\b/);
    for(const m of text.matchAll(/from ['"]([^'"]+)['"]/g))visit(new URL(m[1],url));active.delete(url.href);seen.add(url.href);}
  for(const name of ['spawner','hostile-attacks','enemies','guardians','core-boss','control','targeting'])visit(new URL('../src/combat/'+name+'.js',import.meta.url));
});
