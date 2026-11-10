import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fusionRecipes } from '../src/data/fusions.js';
import { retiredFusionIds } from '../src/save/retired-fusions.js';
import { upgrades } from '../src/data/upgrades.js';
import { branches } from '../src/data/specializations.js';
import { initialProfile, hydrateProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { restoreRun } from '../src/save/restore-run.js';
import { encodeSave, readSave } from '../src/save/format.js';
import { commitFusion } from '../src/growth/commands.js';
import { activeFusions, weaponConsumed, hasBranch } from '../src/growth/build.js';
import { availableUpgrades, makeChoices } from '../src/growth/cards.js';
import { createDebugGame } from '../src/debug/create-debug-game.js';
import { createMockBrowser } from './mock-browser.js';

const fixtures=JSON.parse(readFileSync(new URL('retired-fusion-loadouts.json',import.meta.url),'utf8'));
const fresh=profile=>createRun(profile,{maxHp:100,xpNext:28});
function withBrowser(callback){
  const env=createMockBrowser({observers:true}),descriptors=new Map();
  for(const [key,value]of Object.entries({...env,window:env})){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  try{return callback(env);}finally{for(const [key,old]of descriptors)if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];}
}
test('new recipes never reuse retired identities or damage definitions',()=>{
  assert.equal(retiredFusionIds.length,22);assert.deepEqual(retiredFusionIds.slice().sort(),Object.keys(fixtures).sort());
  for(const id of retiredFusionIds){assert.ok(!fusionRecipes.some(f=>f.id===id));assert.ok(!upgrades.some(u=>u.id==='fusion_'+id));}
  const s={profile:initialProfile(),run:null};s.run=fresh(s.profile);assert.equal(createStatistics({sessionState:s}).weaponDamage('fusion_fleet',{}),0);
});
test('every old fusion save keeps original investments and choices but discards retired attacks with no refund',()=>{
  for(const [id,loadout]of Object.entries(fixtures)){
    const profile=initialProfile(),raw=fresh(profile);Object.assign(raw,{time:910,level:12,gold:71,kills:90,up:{...loadout.up,focus:2},branches:{...loadout.branches},fusionStates:{[id]:{phase:'out',clock:0,age:1,hits:[{id:1}],units:[{x:1,y:2}]}},fusionTrail:[{x:1,y:2,t:900}]});const before=structuredClone(raw),pBefore=structuredClone(profile),r=restoreRun(raw,profile);assert.ok(r,id);assert.deepEqual(raw,before);assert.deepEqual(profile,pBefore);assert.equal(r.gold,71);assert.equal(r.level,12);assert.equal(r.kills,90);assert.equal(r.up.focus,2);assert.deepEqual(r.branches,loadout.branches);assert.deepEqual(r.fusionStates,{});assert.deepEqual(r.fusionTrail,[]);assert.deepEqual(activeFusions(r),[]);assert.ok(!Object.keys(r.up).some(k=>k.startsWith('fusion_')&&r.up[k]>0));
    for(const [weapon,option]of Object.entries(loadout.branches)){assert.equal(r.up[weapon],loadout.up[weapon]);assert.equal(weaponConsumed(weapon,r),false);assert.equal(hasBranch(weapon,option,r),true);}
  }
});
test('historical discovery counts survive bounded whitelist hydration without reintroducing playable content',()=>{
  const raw=initialProfile();raw.gold=123;raw.memory.fusions=Object.fromEntries(retiredFusionIds.map(id=>[id,2]));raw.memory.fusions.unknown=99;raw.memory.fusions.fleet=1e9;const before=structuredClone(raw),profile=hydrateProfile(initialProfile(),raw);assert.deepEqual(raw,before);assert.equal(profile.gold,123);assert.equal(profile.memory.fusions.fleet,99999);assert.equal(profile.memory.fusions.unknown,undefined);assert.equal(Object.keys(profile.memory.fusions).length,22);assert.ok(fusionRecipes.every(f=>!retiredFusionIds.includes(f.id)));assert.deepEqual(hydrateProfile(initialProfile(),initialProfile()).memory.fusions,{});
});
test('retired IDs cannot be crafted or appear among growth choices, including stale saved choices',()=>{
  const profile=initialProfile(),r=fresh(profile);r.up={...fixtures.ark.up};r.branches={...fixtures.ark.branches};r.pending=2;r.choices=['fusion_ark','fusion_fleet','power'];const before=structuredClone(r);
  for(const id of retiredFusionIds)assert.equal(commitFusion(r,id),null);assert.deepEqual(r,before);
  const restored=restoreRun(r,profile);assert.ok(restored);assert.ok(restored.choices.every(id=>!id.startsWith('fusion_')));assert.ok(availableUpgrades(restored).every(u=>!u.id.startsWith('fusion_')));for(let i=0;i<20;i++)assert.ok(makeChoices(restored,[],()=>i/20).every(id=>!id.startsWith('fusion_')));
});
test('save round trips preserve the playable original weapons without resurrecting old fusion state',()=>{
  const p=initialProfile(),r=fresh(p);r.up=fixtures.eclipse.up;r.branches=fixtures.eclipse.branches;const a=restoreRun(r,p),data=readSave(encodeSave(p,a)),b=restoreRun(data.run,data.profile);assert.deepEqual(b.up,a.up);assert.deepEqual(b.branches,a.branches);assert.deepEqual(b.fusionStates,{});assert.deepEqual(b.fusionTrail,[]);assert.equal(b.gold,a.gold);
});
test('both HTML entries expose the redesigned fusion action',()=>{
 for(const file of ['index.html','debug.html']){const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.doesNotMatch(html,/id="openFusion" disabled hidden/);assert.ok(html.includes('기반 융합 Lv4'));}
});
test('debug rejects every retired grant atomically and offers current skills, specializations and new fusions',()=>withBrowser(()=>{
  const app=createDebugGame({mountPanel:false});try{app.tools.giveSkill('power',3);const before=app.tools.snapshot();for(const id of retiredFusionIds)for(const prefix of ['fusion:','fusion_'])assert.throws(()=>app.tools.giveSkill(prefix+id,4,{isolate:true}));assert.equal(app.tools.snapshot(),before);assert.equal(app.tools.catalog.skills.length,upgrades.length+16);assert.ok(app.tools.catalog.skills.filter(s=>s.id.startsWith('fusion:')).every(s=>!retiredFusionIds.includes(s.id.slice(7))));for(const b of branches)for(const o of b.options)assert.doesNotThrow(()=>app.tools.giveSkill(`spec:${b.id}:${o.id}`,4,{isolate:true}));}finally{app.dispose();}
}));
test('gameplay, HUD, compendium, checkpoint restore and shutdown work with the redesigned fusion service',()=>withBrowser(env=>{
  const app=createDebugGame({mountPanel:false});try{app.tools.giveSkill('spec:nova:boundary',4,{isolate:true});app.tools.configure('enemyAI',false);app.tools.spawn(0,3,{distance:70,hp:1e7});app.tools.hold(false);for(let i=1;i<=180;i++)env.__inspect.flushFrame(1000+i*16);assert.ok(app.tools.report().time>2);assert.equal(app.tools.report().mode,'playing');assert.ok(JSON.parse(app.tools.snapshot()).run.enemies.some(e=>e.hp<1e7));assert.equal(env.document.getElementById('openFusion').disabled,false);
    env.dispatch('keydown',{code:'KeyG'});assert.equal(app.tools.report().mode,'fusion');env.dispatch('keydown',{code:'KeyG'});env.dispatch('keydown',{code:'KeyB'});assert.equal(env.document.getElementById('buildModal').hidden,false);const guide=env.document.getElementById('evolutionGuide').innerHTML;assert.ok(guide.includes('전문화'));assert.ok(guide.includes('순간 참격'));assert.ok(guide.includes('data-fusion='));env.dispatch('keydown',{code:'Escape'});app.tools.saveCheckpoint();app.tools.clearBuild();app.tools.loadCheckpoint();assert.equal(JSON.parse(app.tools.snapshot()).run.branches.nova,'boundary');
  }finally{app.dispose();}assert.equal(env.__inspect.listenerCount(),0);assert.equal(env.__inspect.frames.size,0);
}));
