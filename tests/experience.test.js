import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { GEM_LIMIT, GEM_KEEP_RADIUS } from '../src/core/config.js';
import { xpNeed, xpBonus, xpCollectionScale, dropXp, reserveXp, collectXp, collectGem, collectAllXp, tickGems } from '../src/growth/experience.js';
import { rewardGold, rewardXp, grantKillLoot } from '../src/growth/rewards.js';
import { recoveryScale, commitRepeatedHealing } from '../src/combat/recovery.js';
const fresh = () => createRun(initialProfile(), { maxHp: 100, xpNext: xpNeed(1) });
const full = () => Array.from({ length: GEM_LIMIT }, (_, i) => ({ x: i * 100, y: 0, xp: 1, count: 1 }));
const xpState = r => ({ level: r.level, xp: r.xp, xpNext: r.xpNext, pending: r.pending, fraction: r.xpFraction, hp: r.player.hp, budget: r.harvestBudget });

test('XP thresholds and collection multipliers retain original values', () => {
  for (const [level, amount] of [[1,18],[2,47],[3,83],[4,124],[5,169],[10,454],[24,1697],[25,1792],[100,11487]]) assert.equal(xpNeed(level), amount);
  const p = initialProfile(), r = fresh(); p.perks.learning = 3; r.up.salvage = 2;
  assert.ok(Math.abs(xpBonus(p,r)-1.28) < 1e-12); assert.ok(Math.abs(xpCollectionScale(p,r,true)-.96) < 1e-12); assert.ok(Math.abs(xpCollectionScale(p,r,false)-1.28) < 1e-12);
});
test('gem merging uses exact XP and a strict distance boundary, even at capacity', () => {
  const r = fresh(); assert.equal(dropXp(r,0,0,5), true); assert.equal(dropXp(r,71,0,5,2), true);
  assert.equal(r.gems.length, 1); assert.equal(r.gems[0].count, 3);
  dropXp(r,72,0,5); dropXp(r,0,0,6); assert.equal(r.gems.length, 3);
  r.gems = full(); assert.equal(dropXp(r,1,0,1,3), true); assert.equal(r.gems[0].count, 4);
  const before = structuredClone(r.gems); assert.equal(dropXp(r,0,0,2), false); assert.deepEqual(r.gems,before);
});
test('fractional XP persists across drops and large rewards queue every crossed level', () => {
  const p = initialProfile(), r = fresh();
  collectGem(r,p,{xp:.1,count:10},false,()=>{throw Error('no harvest: no HP calculation');});
  assert.equal(r.xp, 1); assert.equal(r.xpFraction, 0);
  collectXp(r,p,18+47+83-1,false); assert.equal(r.level,4); assert.equal(r.pending,3); assert.equal(r.xp,0); assert.equal(r.xpNext,124);
});
test('merged gems retain per-drop healing and rounding under recovery suppression', () => {
  const p = initialProfile(); p.perks.learning = 3;
  const a = fresh(), b = fresh();
  for (const r of [a,b]) { r.time = 10; r.recoveryUntil = 13; r.player.hp = 99; r.up.salvage = 2; }
  collectGem(a,p,{xp:100,count:3},true,()=>100);
  for (let i = 0; i < 3; i++) collectXp(b,p,100,true,()=>100);
  assert.deepEqual(xpState(a),xpState(b)); assert.equal(a.player.hp,99.578125); assert.equal(a.harvestBudget,.6875);
  const aggregated = fresh(); aggregated.time=10; aggregated.recoveryUntil=13; aggregated.player.hp=99;
  collectXp(aggregated,p,300,true,()=>100); assert.notEqual(aggregated.player.hp,a.player.hp);
});
test('harvest obeys its budget, maximum HP and lethal HP without refunding suppressed recovery', () => {
  const p=initialProfile(), r=fresh(); r.player.hp=50; r.harvestBudget=1; r.recoveryUntil=3;
  collectXp(r,p,100,true,()=>100); assert.equal(r.player.hp,50.25); assert.equal(r.harvestBudget,0);
  collectXp(r,p,100,true,()=>100); assert.equal(r.player.hp,50.25);
  r.player.hp=0; r.harvestBudget=3; collectXp(r,p,100,true,()=>100); assert.equal(r.player.hp,0); assert.equal(r.harvestBudget,0);
  r.player.hp=100; r.harvestBudget=3; collectXp(r,p,100,true,()=>100); assert.equal(r.player.hp,100); assert.equal(r.harvestBudget,3);
});
test('recovery has a strict timer boundary, clamps healing and cannot resurrect', () => {
  const r=fresh(); r.time=2; r.recoveryUntil=3; r.player.hp=90;
  assert.equal(recoveryScale(r),.25); assert.equal(commitRepeatedHealing(r,8,100),2); assert.equal(r.player.hp,92);
  r.time=3; assert.equal(recoveryScale(r),1); assert.equal(commitRepeatedHealing(r,100,100),8);
  r.player.hp=0; assert.equal(commitRepeatedHealing(r,100,100),0); assert.equal(r.player.hp,0); assert.equal(recoveryScale(null),1);
});
test('kill rewards preserve elite, timing, encounter factors and explicit zero XP scales', () => {
  const context={time:0,paceXp:1,harvest:false,legacy:''}, e={kind:0};
  assert.equal(rewardGold(e),1); assert.equal(rewardXp(e,context),5);
  e.elite=true; assert.equal(rewardGold(e),3); assert.equal(rewardXp(e,context),15);
  e.xpScale=2; Object.assign(context,{time:780,paceXp:2,harvest:true,legacy:'save'}); assert.equal(rewardXp(e,context),111);
  context.legacy='strip'; assert.equal(rewardXp(e,context),88); e.xpScale=0; assert.equal(rewardXp(e,context),0);
});
test('loot releases at most 5000 reserve only after a successful gem deposit', () => {
  const r=fresh(), enemy={x:10,y:20}; r.xpReserve=20000;
  grantKillLoot(r,enemy,7,10); assert.equal(r.gold,7); assert.equal(r.gems[0].xp,5010); assert.equal(r.xpReserve,15000);
  r.gems=full(); const before=structuredClone(r.gems); grantKillLoot(r,enemy,7,10);
  assert.equal(r.gold,14); assert.equal(r.xpReserve,15010); assert.deepEqual(r.gems,before);
  r.xpReserve=1e8; grantKillLoot(r,enemy,7,10); assert.equal(r.xpReserve,1e8);
  r.gems[0].xp=5010; grantKillLoot(r,{x:0,y:0},7,10); assert.equal(r.xpReserve,1e8-5000); assert.equal(r.gems[0].count,2);
});
test('full absorption collects original drops first and stored XP once, then clears both stores', () => {
  const p=initialProfile(), a=fresh(), b=fresh(); p.perks.learning=3;
  for (const r of [a,b]) { r.player.hp=99; r.recoveryUntil=3; r.gems=[{x:0,y:0,xp:100,count:3},{x:0,y:0,xp:5,count:2}]; r.xpReserve=70; }
  const orbs=structuredClone(b.gems); b.gems=[]; b.xpReserve=0;
  for (const gem of orbs) collectGem(b,p,gem,true,()=>100); collectXp(b,p,70,true,()=>100);
  assert.equal(collectAllXp(a,p,true,()=>100),380); assert.deepEqual(xpState(a),xpState(b));
  assert.deepEqual(a.gems,[]); assert.equal(a.xpReserve,0); assert.equal(collectAllXp(a,p,true,()=>100),0);
});
test('gem ticking retains collection, strict distance tests, attraction and budget recovery order', () => {
  const p=initialProfile(), r=fresh(), x=r.player.x, y=r.player.y; r.harvestBudget=0;
  r.gems=[{x:x+16,y,xp:1,count:2},{x:x+17,y,xp:2,count:1},{x:x+GEM_KEEP_RADIUS,y,xp:3,count:1},{x:x+GEM_KEEP_RADIUS+1,y,xp:4,count:2}];
  tickGems(r,p,.5,0,false); assert.equal(r.xp,2); assert.equal(r.xpReserve,8); assert.equal(r.gems.length,2); assert.equal(r.harvestBudget,.6);
  r.gems=[{x:x+100,y,xp:3,count:1}]; tickGems(r,p,1,200,false); assert.equal(r.gems[0].x,x); assert.equal(r.xp,2);
  tickGems(r,p,0,200,false); assert.equal(r.gems.length,0); assert.equal(r.xp,5);
  reserveXp(r,1e9); assert.equal(r.xpReserve,1e8);
});
