import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { HURT_TIME, RECOVERY_DELAY, ENEMY_LIMIT } from '../src/core/config.js';
import { armorScale, incomingScale, wardRadius, targetable } from '../src/combat/rules.js';
import { commitPlayerHit, commitEnemyHit } from '../src/combat/health.js';
import { commitEnemyDeath, spawnDeathChildren, spawnDeathBurst, burstChance } from '../src/combat/death.js';
import { hasRelic, anomalyActive, clockFrozen } from '../src/world/effects.js';
const fresh = () => createRun(initialProfile(), { maxHp: 100, xpNext: 18 });
const enemy = (extra={}) => ({ id:1, kind:0, hp:100, maxHp:100, x:0, y:0, phase:0, ...extra });

test('player hit guards preserve all state during hurt, invulnerability and lethal HP', () => {
  for (const patch of [{player:{hp:100,hurt:.1}}, {invulnUntil:1}, {player:{hp:0,hurt:0}}]) {
    const r=fresh(); Object.assign(r,patch); const before=structuredClone(r);
    assert.equal(commitPlayerHit(r,100,initialProfile()),null); assert.deepEqual(r,before);
  }
  const r=fresh(); r.time=r.invulnUntil=1;
  assert.equal(commitPlayerHit(r,0,initialProfile()).dealt,1); assert.equal(r.player.hp,99);
  assert.equal(r.player.hurt,HURT_TIME); assert.equal(r.recoveryUntil,1+RECOVERY_DELAY); assert.equal(r.director.hits,1);
});
test('player damage combines account armor, upgrades and cooldown boundaries; removed world choices no longer scale it', () => {
  for (const legacyOrigin of [null,'release','consume']) {
    const expected=78, p=initialProfile(), r=fresh(); p.perks.armor=2; r.up.armor=5; r.legacyOrigin=legacyOrigin; r.relics=['clockwork']; r.time=14; r.relicCooldown=14;
    const hit=commitPlayerHit(r,100,p); assert.equal(hit.dealt,expected); assert.equal(hit.stopped,true);
    assert.equal(r.relicFreezeUntil,15.5); assert.equal(r.relicCooldown,28); assert.equal(r.player.hp,100-expected);
    r.player.hurt=0; r.finalStep=2; const d=r.director.hits;
    assert.equal(commitPlayerHit(r,1000,p).stopped,false); assert.equal(r.player.hp,0); assert.equal(r.director.hits,d);
  }
  const p=initialProfile(), r=fresh(); r.up.armor=100;
  assert.equal(armorScale(p,r),.75); assert.equal(incomingScale(300),1); assert.equal(incomingScale(2400),1.9);
});
test('support protection is bounded, nonstacking and excludes bosses and other supports', () => {
  for (const [target,ward,amount] of [
    [{},{x:105},70], [{},{x:105.001},100], [{elite:true},{x:0},82],
    [{},{x:135,elite:true},70], [{kind:8},{x:0},100], [{kind:3},{x:0},100], [{},{x:0,hp:0},100]
  ]) {
    const r=fresh(), e=enemy(target), w=enemy({id:2,kind:8,...ward}); r.enemies=[e,w,{...w,id:3}];
    assert.equal(commitEnemyHit(r,e,100,null).amount,amount);
  }
  assert.equal(wardRadius({}),105); assert.equal(wardRadius({elite:true}),135);
});
test('boss phases and exposure preserve damage scales and director exclusion', () => {
  for (const [phase,final,expected] of [[0,false,100],[1,false,82],[2,false,82],[4,false,130],[4,true,130]]) {
    const r=fresh(), e=enemy({kind:3,hp:1000,maxHp:1000,phase,final});
    assert.equal(commitEnemyHit(r,e,100,1).amount,expected); assert.equal(r.director.damage,0);
  }
  const r=fresh(), e=enemy({hp:10}); commitEnemyHit(r,e,100,null);
  assert.equal(r.director.damage,10); assert.equal(e.combatAt,r.time); assert.equal(e.hp,-90);
});
test('named guardian yields at zero HP, hollow shells die normally, and the final choice keeps its own threshold', () => {
  const r=fresh(), boss=enemy({id:42,kind:3,named:true,hp:10});
  assert.equal(commitEnemyHit(r,boss,9,null).choice,null); assert.equal(boss.hp,1);
  assert.equal(commitEnemyHit(r,boss,1,null).choice,null); assert.equal(boss.hp,0); assert.equal(boss.phase,3); assert.equal(r.bossChoiceId,42);
  const shellRun=fresh(), shell=enemy({id:7,kind:3,hollow:true,hp:5}); assert.equal(commitEnemyHit(shellRun,shell,9,null).choice,null); assert.ok(shell.hp<=0); assert.notEqual(shell.phase,3); assert.equal(shellRun.bossChoiceId,0);
  const before=structuredClone(boss); assert.equal(commitEnemyHit(r,boss,100,null),null); assert.deepEqual(boss,before);
  const finalRun=fresh(), final=enemy({kind:3,final:true,hp:11});
  assert.equal(commitEnemyHit(finalRun,final,1,1).choice,'finalchoice'); assert.equal(finalRun.finalStep,3); assert.equal(final.hp,10);
  const overkill=enemy({kind:3,final:true,hp:100}); commitEnemyHit(fresh(),overkill,10000,1); assert.equal(overkill.hp,1);
});
test('core shield caps damage and eligibility is checked before initialization, without a second guard', () => {
  const r=fresh(), e=enemy({kind:3,final:true}); assert.equal(targetable(e,r),true);
  r.journey.core={phase:0}; assert.equal(commitEnemyHit(r,e,1000,0).amount,10); assert.equal(e.hp,90); assert.equal(targetable(e,r),false);
  // A caller that already checked eligibility before creating the core may still commit a zero hit.
  assert.equal(commitEnemyHit(r,e,1000,0).amount,0); assert.equal(e.flash,.11);
  r.journey.core.phase=1; assert.equal(targetable(e,r),true);
  e.phase=3; assert.equal(targetable(e,r),false); e.phase=0; e.hp=0; assert.equal(targetable(e,r),false);
});
test('death telemetry records tactical lifetime and actions without counting bosses, nodes or finale', () => {
  for (const [extra,finalStep,special,counted] of [[{kind:2,combatAt:3,phase:1},0,true,true],[{kind:1,elite:true,combatAt:3},0,true,true],[{kind:0},0,false,true],[{kind:3},0,false,false],[{coreNode:true},0,false,false],[{kind:2},2,false,false]]) {
    const r=fresh(), e=enemy(extra); r.time=10; r.finalStep=finalStep; commitEnemyDeath(r,e);
    assert.equal(e.hp,0); assert.equal(r.kills,1); assert.equal(r.director.kills,counted?1:0); assert.equal(r.director.specialKills,special?1:0);
    if(special){assert.equal(r.director.lifeSum,7); assert.equal(r.director.specialActed,extra.phase===1?1:0);}
  }
});
test('split children retain placement and stats and respect remaining enemy capacity', () => {
  for (const [elite,expected] of [[false,[-12,12]],[true,[-18,0,18]]]) {
    const r=fresh(), e=enemy({kind:6,elite,x:100,y:200});
    spawnDeathChildren(r,e,kind=>{assert.equal(kind,1);const child={speed:10};r.enemies.push(child);return child;});
    assert.deepEqual(r.enemies.map(c=>c.x-100),expected);
    for (const c of r.enemies){assert.equal(c.y,300-c.x);assert.equal(c.hp,9);assert.equal(c.maxHp,9);assert.equal(c.radius,8);assert.equal(c.speed,32);}
  }
  const r=fresh(); r.enemies=Array.from({length:ENEMY_LIMIT-1},()=>({})); let calls=0;
  spawnDeathChildren(r,enemy({kind:6,elite:true}),()=>{calls++;const c={speed:0};r.enemies.push(c);return c;});
  assert.equal(calls,1); assert.equal(r.enemies.length,ENEMY_LIMIT);
});
test('burst preserves chance, recursion limit, RNG use and fragment cap', () => {
  assert.equal(burstChance(0),0); assert.equal(burstChance(1),.25); assert.equal(burstChance(5),.75);
  for (const [level,depth,roll,shouldRoll] of [[0,0,0,false],[5,2,0,false],[1,0,.25,true]]) {
    const r=fresh(); let rolls=0;spawnDeathBurst(r,enemy(),depth,level,()=>{throw Error('no damage evaluation');},()=>{rolls++;return roll;});
    assert.equal(rolls,shouldRoll?1:0); assert.equal(r.shots.length,0);
  }
  const r=fresh(); r.shots=Array.from({length:248},()=>({}));const events=[];
  spawnDeathBurst(r,enemy({id:7}),1,5,()=>{events.push('damage');return 40;},()=>{events.push('rng');return 0;});
  assert.deepEqual(events,['rng','damage','damage']); assert.equal(r.shots.length,250);
  for(const shot of r.shots.slice(-2)){assert.equal(shot.damage,40);assert.equal(shot.burstDepth,2);assert.deepEqual(shot.hit,[7]);assert.equal(shot.kind,'burst');}
  let rolls=0;spawnDeathBurst(r,enemy(),0,5,()=>{throw Error('cap');},()=>{rolls++;return 0;});assert.equal(rolls,1);
});
test('world predicates inspect supplied runs, including permanent field shifts and timed clock phases', () => {
  const a=fresh(), b=fresh(); a.relics=['clockwork'];
  assert.equal(hasRelic('clockwork',a),true);assert.equal(hasRelic('clockwork',b),false);
  a.anomalyChoices={clock:'hold',echo:'keep'};a.anomalyUntil.clock=20;
  for(const [time,expected]of [[11.99,false],[12,true],[13.99,true],[14,false],[24,false]]){a.time=time;assert.equal(clockFrozen(a),expected);}
  assert.equal(anomalyActive('echo','keep',a),true); assert.equal(clockFrozen(null),false);
});
test('combat domain modules have no runtime state, UI or circular dependencies', () => {
  const seen=new Set(), active=new Set();
  function visit(url){if(active.has(url.href))assert.fail('cycle: '+url.href);if(seen.has(url.href))return;active.add(url.href);
    const text=readFileSync(url,'utf8');assert.doesNotMatch(text,/from ['"][^'"]*(?:core\/state|game\.js|main\.js)['"]/);assert.doesNotMatch(text,/\b(?:document|window|localStorage)\b/);
    for(const m of text.matchAll(/from ['"]([^'"]+)['"]/g))visit(new URL(m[1],url));active.delete(url.href);seen.add(url.href);
  }
  for(const name of ['rules','health','death'])visit(new URL('../src/combat/'+name+'.js',import.meta.url));
});
