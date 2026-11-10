import { createBuildModel } from '../src/ui/build-model.js';
import test from 'node:test';
import { fusionBalance } from '../src/data/balance.js';
import assert from 'node:assert/strict';
import { fusionRecipes, fusionById } from '../src/data/fusions.js';
import { branches } from '../src/data/specializations.js';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { fusionReady, activeFusions, weaponConsumed } from '../src/growth/build.js';
import { commitFusion } from '../src/growth/commands.js';
import { availableUpgrades } from '../src/growth/cards.js';
import { fusionParameters, fusionInterval } from '../src/combat/fusion-parameters.js';
import { createFusions } from '../src/combat/fusions.js';
import { restoreRun } from '../src/save/restore-run.js';
import { encodeSave, readSave } from '../src/save/format.js';
import { makeRandomState } from '../src/core/random.js';

function harness(f,{count=1,level=1,passives={}}={}){
 const sessionState={profile:initialProfile(),run:null},r=sessionState.run=createRun(sessionState.profile,{maxHp:100,xpNext:28});r.rng=makeRandomState(42);
 for(const [w,b]of f.needs){r.up[w]=5;r.branches[w]=b;}if(f.base){assert.ok(commitFusion(r,f.base));r.up['fusion_'+f.base]=4;}assert.ok(commitFusion(r,f.id));r.up['fusion_'+f.id]=level;Object.assign(r.up,passives);
 r.enemies=Array.from({length:count},(_,i)=>({id:i+1,kind:0,phase:0,x:r.player.x+80+(i%8)*45,y:r.player.y+(Math.floor(i/8)-1)*35,radius:12,hp:1e8,maxHp:1e8,speed:0,slowEffects:[]}));
 const view={mode:'playing'},hits=[],statistics=createStatistics({sessionState}),combat={damage(e,damage,crit){e.hp-=damage;hits.push({id:e.id,damage,crit});}},runtime=createFusions({sessionState,view,statistics,combat});
 function tick(dt){sessionState.run.time+=dt;runtime.fusionTick(dt,statistics.stats());}
 return {sessionState,r,view,hits,statistics,runtime,tick};
}
const basic=fusionRecipes.filter(f=>!f.base),higher=fusionRecipes.filter(f=>f.base);
test('16 foundations cover every branch twice and every foundation has a distinct third-weapon upper route',()=>{
 assert.equal(basic.length,16);assert.equal(higher.length,16);assert.equal(new Set(higher.map(f=>f.group)).size,6);assert.equal(new Set(fusionRecipes.map(f=>f.id)).size,32);
 for(const b of branches)for(const o of b.options)assert.equal(basic.filter(f=>f.needs.some(([w,p])=>w===b.id&&p===o.id)).length,2);
 for(const b of basic){const paths=higher.filter(f=>f.base===b.id);assert.equal(paths.length,1);assert.equal(new Set(paths[0].needs.map(([w])=>w)).size,3);}
});
for(const f of fusionRecipes)test('craft boundary and atomic rejection: '+f.id,()=>{
 const h=harness(f),r=h.r;delete r.up['fusion_'+f.id];delete r.fusionStates[f.id];
 if(f.base){for(const lv of [0,1,2,3]){r.up['fusion_'+f.base]=lv;const before=structuredClone(r);assert.equal(commitFusion(r,f.id),null);assert.deepEqual(r,before);}r.up['fusion_'+f.base]=4;}
 for(const [w]of f.base?[f.extra]:f.needs){r.up[w]=4;const before=structuredClone(r);assert.equal(fusionReady(f,r),false);assert.equal(commitFusion(r,f.id),null);assert.deepEqual(r,before);r.up[w]=5;}
 assert.ok(commitFusion(r,f.id));assert.equal(activeFusions(r).length,1);assert.ok(f.needs.every(([w])=>weaponConsumed(w,r)));assert.ok(availableUpgrades(r).every(u=>!f.needs.some(([w])=>u.id===w)));if(f.base)assert.equal(r.fusionStates[f.base],undefined);
});
for(const f of fusionRecipes)test('refresh rates and saved attack continuation: '+f.id,()=>{
 const simulate=(hz,restore=false)=>{const h=harness(f,{count:12});for(let i=0;i<hz*2;i++){
   h.tick(1/hz);
   if(restore&&i===hz-1){const data=readSave(encodeSave(h.sessionState.profile,h.sessionState.run));h.sessionState.run=restoreRun(data.run,data.profile);assert.ok(h.sessionState.run);}
 }return {hits:h.hits.map(h=>[h.id,h.damage,h.crit]),state:h.sessionState.run.fusionStates[f.id]};};
 const baseline=simulate(60);assert.ok(baseline.hits.length>0,f.id+' must damage enemies');assert.deepEqual(simulate(30).hits,baseline.hits);assert.deepEqual(simulate(144).hits,baseline.hits);assert.deepEqual(simulate(60,true).hits,baseline.hits);
});
test('upper damage retains completed foundation and applies additional growth once',()=>{
 const f=higher.find(f=>f.base==='fs_instant_slash'),h=harness(f),s={...h.statistics.stats(),damage:100},p=fusionParameters(f,h.r,s),balance=fusionBalance(f.id);assert.ok(Math.abs(p.damage-184.8*balance)<1e-9);
 h.r.up['fusion_'+f.id]=4;assert.ok(Math.abs(fusionParameters(f,h.r,s).damage-284.592*balance)<1e-9);
 const b=fusionById[f.base];assert.equal(fusionInterval(b,p),.16);assert.equal(p.size,1.15);
});
test('slash hits current enemy coordinate immediately, never travels, and harmless echoes add no damage',()=>{
 const h=harness(fusionById.fs_instant_slash),e=h.r.enemies[0];h.tick(1/120);assert.equal(h.hits.length,1);const q=h.r.fusionStates.fs_instant_slash,v=q.visuals.find(v=>v.type==='slash');assert.equal(v.x,e.x);assert.equal(v.y,e.y);assert.equal(q.effects.length,0);const hp=e.hp;for(let i=0;i<10;i++)h.tick(1/120);assert.equal(e.hp,hp);
 h.r.player.x=e.x-100;h.r.player.y=e.y+100;while(q.age<.17)h.tick(1/120);assert.equal(h.hits.length,2);assert.equal(q.visuals.at(-1).x,e.x);
});
test('upper slash cadence bonuses never skip alternating attacks against one enemy',()=>{
 const f=higher.find(f=>f.base==='fs_instant_slash'),plain=harness(f),fast=harness(f,{passives:{machinery:4}});for(let i=0;i<120;i++){plain.tick(1/120);fast.tick(1/120);}assert.ok(fast.hits.length>plain.hits.length);
});
test('paused combat and saturated visual effects do not consume clocks, damage or RNG',()=>{
 const f=fusionById.fs_instant_slash,h=harness(f);h.view.mode='paused';const before=encodeSave(h.sessionState.profile,h.r);h.runtime.fusionTick(5,h.statistics.stats());assert.equal(encodeSave(h.sessionState.profile,h.r),before);
 const a=harness(f),b=harness(f);b.r.fusionStates[f.id].visuals=Array.from({length:100},()=>({type:'slash',age:0,life:100}));for(let i=0;i<120;i++){a.tick(1/120);b.tick(1/120);}assert.deepEqual(a.hits,b.hits);assert.deepEqual(a.r.rng,b.r.rng);
});

test('simultaneous fusions preserve global attack and RNG ordering across refresh rates',()=>{
 const simulate=hz=>{const h=harness(fusionById.fs_rapid_pulse,{count:12}),other=fusionById.fs_conductive_guard;for(const [w,b]of other.needs){h.r.up[w]=5;h.r.branches[w]=b;}assert.ok(commitFusion(h.r,other.id));for(let i=0;i<hz*2;i++)h.tick(1/hz);return h.hits;};
 assert.deepEqual(simulate(30),simulate(60));assert.deepEqual(simulate(144),simulate(60));
});
test('base and upper slashes keep independent recent targets and angle cycles after restoration',()=>{
 const f=higher.find(f=>f.base==='fs_instant_slash'),h=harness(f,{count:8});for(let i=0;i<30;i++)h.tick(1/120);
 const q=h.r.fusionStates[f.id];assert.ok(q.slashes['base-slash']);assert.ok(q.slashes['upper-slash']);assert.notEqual(q.slashes['base-slash'],q.slashes['upper-slash']);
 const data=readSave(encodeSave(h.sessionState.profile,h.r)),restored=restoreRun(data.run,data.profile);assert.deepEqual(restored.fusionStates[f.id].slashes,q.slashes);
});
test('hit geometry snapshots do not gain later upgrades and invalid dimensions cannot reach rendering',()=>{
 const f=fusionById.fs_rapid_pulse,h=harness(f);h.tick(1/120);const bolt=h.r.fusionStates[f.id].effects.find(e=>e.type==='bolt'),damage=bolt.p.damage,radius=bolt.radius;h.r.up.power=12;h.r.up.area=5;h.tick(1/120);assert.equal(bolt.p.damage,damage);assert.equal(bolt.radius,radius);
 const data=readSave(encodeSave(h.sessionState.profile,h.r));data.run.fusionStates[f.id].effects[0].radius=-1;data.run.fusionStates[f.id].effects[1].vx=Infinity;const r=restoreRun(data.run,data.profile);assert.ok(r.fusionStates[f.id].effects.every(e=>e.radius>0&&Number.isFinite(e.vx)));
});
test('projectile and harmless slash budgets hold under maximum cadence and multishot',()=>{
 const h=harness(fusionById.fs_rapid_pulse,{count:1,passives:{haste:8,multishot:4,pierce:4,area:5}});h.r.enemies[0].x=h.r.player.x+600;
 for(let i=0;i<360;i++){h.tick(1/120);assert.ok(h.r.fusionStates.fs_rapid_pulse.effects.filter(e=>e.type==='bolt').length<=96);}
});
test('a modal opened by a hit stops later targets within the same simulation step',()=>{
 const f=fusionById.fs_instant_slash,h=harness(f,{count:3});for(const e of h.r.enemies){e.x=h.r.player.x+80;e.y=h.r.player.y;}
 let hits=0;const runtime=createFusions({sessionState:h.sessionState,view:h.view,statistics:h.statistics,combat:{damage(){hits++;h.view.mode='bosschoice';}}});h.r.time+=1/60;runtime.fusionTick(1/60,h.statistics.stats());assert.equal(hits,1);assert.equal(h.view.mode,'bosschoice');
});

test('craft preview warns before consuming the last possible upper route',()=>{
 const h=harness(fusionById.fs_rapid_pulse),r=h.r;for(const id of ['fs_surging_strata','fs_conductive_guard']){const f=fusionById[id];for(const [w,b]of f.needs){r.up[w]=5;r.branches[w]=b;}assert.ok(commitFusion(r,id));}
 const last=fusionById.fs_mobile_mines;for(const [w,b]of last.needs){r.up[w]=5;r.branches[w]=b;}
 assert.ok(createBuildModel({sessionState:h.sessionState}).fusionPathPreview(last).includes('모두 닫힙니다'));
});
test('legacy projectile saturation reclaims fusion bolts without explosions or extra hits',()=>{
 const h=harness(fusionById.fs_rapid_pulse);h.tick(1/120);h.r.shots=Array.from({length:320},()=>({kind:'burst'}));const before=h.hits.length;h.tick(1/120);assert.equal(h.r.fusionStates.fs_rapid_pulse.effects.filter(e=>e.type==='bolt').length,0);assert.equal(h.hits.length,before);
});
test('staggered support devices choose different primary targets within one firing batch',()=>{
 const h=harness(fusionById.fs_support_guns,{count:2});for(let i=0;i<7;i++)h.tick(1/120);const [a,b]=h.r.fusionStates.fs_support_guns.units;assert.ok(a.lastTarget);assert.ok(b.lastTarget);assert.notEqual(a.lastTarget,b.lastTarget);
});
