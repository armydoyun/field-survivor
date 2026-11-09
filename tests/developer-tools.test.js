import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeRandomState, nextRandom, restoreRandomState, runRandom, createVisualRandom } from '../src/core/random.js';
import { createCombatInspector, readDebugOptions } from '../src/debug/combat-inspector.js';
import { createGame as mountGame } from '../src/app/create-game.js';
import { createRun, makeJourney } from '../src/core/run.js';
import { initialProfile } from '../src/core/profile.js';
import { createStatistics } from '../src/core/statistics.js';
import { createSession } from '../src/core/session.js';
import { encodeSave, readSave } from '../src/save/format.js';
import { restoreRun } from '../src/save/restore-run.js';
import { branches } from '../src/data/specializations.js';
import { fusionRecipes } from '../src/data/fusions.js';
import { createMockBrowser } from './mock-browser.js';

function createGame(s){const options=readDebugOptions(globalThis.location?.search);return mountGame(s,{createInspector:context=>createCombatInspector({...context,enabled:options.enabled}),seedSource:options.seed===undefined?undefined:()=>options.seed});}

const plan=[{at:450,kind:'witness',slot:0},{at:840,kind:'relay',slot:1},{at:1200,kind:'guardian',slot:2},{at:1590,kind:'hunt',slot:3}];
function state(){const s={profile:initialProfile(),run:null,replaceRun(r){s.run=r;},resetState(){s.profile=initialProfile();s.run=null;}};return s;}
function fresh(s,seed=42){const r=createRun(s.profile,{journey:makeJourney(structuredClone(plan)),maxHp:100,xpNext:10});r.rng=makeRandomState(seed);s.run=r;return r;}
function withBrowser(callback,search='?debug=1&seed=42'){
  const env=createMockBrowser({observers:true});env.location={search};const descriptors=new Map();
  for(const [key,value]of Object.entries(env)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  try{return callback(env);}finally{for(const [key,d]of descriptors)if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}
}
function choose(env,action){const button={dataset:{action},closest:s=>s==='[data-action]'?button:null};env.document.getElementById('overlay').dispatch('click',{target:button});}
const key=(env,code,extra={})=>env.dispatch('keydown',{code,...extra});
function inspectorFixture(enabled=true){const s=state();fresh(s);const view={mode:'playing'},platform={keys:new Set(),ctx:new Proxy({},{get:()=>()=>{},set:()=>true})};let now=0;const inspector=createCombatInspector({sessionState:s,view,platform,cameraView:{camera:{x:480,y:270,shakeX:0,shakeY:0}},enabled,now:()=>now});return {s,view,platform,inspector,at:n=>{now=n;}};}

test('versioned RNG has stable vectors and accepts the full uint32 seed range',()=>{
  const a=makeRandomState(0);assert.deepEqual(Array.from({length:4},()=>Math.floor(nextRandom(a)*4294967296)),[1144304738,1416247,958946056,627933444]);
  for(const seed of [0,1,42,0xffffffff]){const x=makeRandomState(seed),y=makeRandomState(seed);for(let i=0;i<1000;i++){const v=nextRandom(x);assert.equal(v,nextRandom(y));assert.ok(v>=0&&v<1);}assert.notEqual(x.state,seed);}
});
test('random-state restoration rejects malformed versions, integers and ranges without consuming RNG',()=>{
  for(const raw of [null,{}, {version:2,seed:0,state:1},{version:1,seed:-1,state:0},{version:1,seed:0,state:2**32},{version:1,seed:0,state:1.5}])assert.equal(restoreRandomState(raw),null);
  const raw=makeRandomState(42),restored=restoreRandomState(raw);assert.deepEqual(restored,raw);assert.notEqual(restored,raw);
});
test('cosmetic draws cannot advance a seeded run; replacing runs resets only the visual stream',()=>{
  const a=state(),b=state();fresh(a);fresh(b);const visual=createVisualRandom(a),first=visual();for(let i=0;i<10000;i++)visual();assert.deepEqual(a.run.rng,b.run.rng);
  for(let i=0;i<100;i++){assert.equal(runRandom(a.run),runRandom(b.run));visual();}fresh(a);assert.equal(visual(),first);
});
test('seed and exact RNG cursor survive a save/restore and remain independent per session',()=>{
  const s=state(),r=fresh(s);for(let i=0;i<73;i++)runRandom(r);const data=readSave(encodeSave(s.profile,r)),restored=restoreRun(data.run,data.profile);assert.deepEqual(restored.rng,r.rng);
  assert.deepEqual(Array.from({length:100},()=>runRandom(restored)),Array.from({length:100},()=>runRandom(r)));assert.notEqual(restored.rng,r.rng);
  delete data.run.rng;assert.equal(restoreRun(data.run,data.profile).rng,undefined);
});
test('new sessions seed the journey and all later rolls from one saved stream; legacy mode is explicit',()=>{
  const s=state(),statistics=createStatistics({sessionState:s}),session=createSession({sessionState:s,statistics,platform:{},seedSource:()=>123});
  const a=session.newRun(),b=session.newRun();assert.deepEqual(a,b);assert.equal(a.rng.seed,123);assert.notEqual(a.rng.state,123);
  const legacy=createSession({sessionState:s,statistics,platform:{},seedSource:null});assert.equal(legacy.newRun(makeJourney(plan)).rng,undefined);
});
test('inspector is inert when disabled and never writes its records into run/save state',()=>{
  for(const enabled of [false,true]){const h=inspectorFixture(enabled),before=encodeSave(h.s.profile,h.s.run);h.inspector.beginStep();h.inspector.circle(1,2,3,'test');h.inspector.segment(1,2,3,4,5,'test');h.inspector.hit({id:1,x:1,y:2,radius:3},10);h.inspector.draw();assert.equal(encodeSave(h.s.profile,h.s.run),before);assert.equal(h.inspector.snapshot().length,enabled?3:0);}
});
test('record buffers are bounded, copy polygon data and clear on simulation steps and run replacement',()=>{
  const h=inspectorFixture(),d=h.inspector,points=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];d.beginStep();d.polygon(points,'test');points[0].x=999;assert.equal(d.snapshot()[0].values[0][0],0);for(let i=0;i<600;i++)d.circle(0,0,1,'test');assert.equal(d.snapshot().length,512);assert.equal(d.report().dropped,89);const copy=d.snapshot();copy[0].values[0][0]=33;assert.equal(d.snapshot()[0].values[0][0],0);d.beginStep();assert.equal(d.snapshot().length,0);fresh(h.s);d.shouldUpdate(true);assert.equal(d.snapshot().length,0);
});
test('developer controls preserve modifier, IME, input focus, repeat and privacy rules',()=>{
  const h=inspectorFixture(),d=h.inspector,event={code:'F7',preventDefault(){}};
  for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{target:{isContentEditable:true}},{target:{closest:()=>true}}])assert.equal(d.keydown({...event,...extra}),false);
  h.view.panic=true;assert.equal(d.keydown(event),false);h.view.panic=false;d.keydown({...event,repeat:true});assert.equal(d.held,false);d.keydown(event);assert.equal(d.held,true);d.keydown({...event,code:'F6'});assert.equal(d.enabled,false);assert.equal(d.held,true);
});
test('one requested step is consumed once and cannot leak through a blocked screen',()=>{
  const h=inspectorFixture(),d=h.inspector,event=code=>({code,preventDefault(){}});d.keydown(event('F7'));assert.equal(d.shouldUpdate(true),false);d.keydown(event('F8'));assert.equal(d.shouldUpdate(true),true);assert.equal(d.shouldUpdate(true),false);d.keydown(event('F8'));assert.equal(d.shouldUpdate(false),false);assert.equal(d.shouldUpdate(true),false);
  h.view.shopOpen=true;d.keydown(event('F8'));assert.equal(d.shouldUpdate(true),false);
});
test('timings use a bounded rolling sample and report measured p95 and entity counts',()=>{
  const h=inspectorFixture(),d=h.inspector;d.beginStep();for(let i=0;i<200;i++){h.at(i*16);d.measureFrame(2,3);}const report=d.report();assert.equal(report.samples,180);assert.equal(report.mean.update,2);assert.equal(report.mean.render,3);assert.equal(report.frameP95,16);assert.equal(report.seed,42);assert.equal(report.counts.enemies,0);
});
test('full runtime freezes, advances exactly 1/60 second, respects pause and releases debug listeners',()=>withBrowser(env=>{
  const s=state(),app=createGame(s);choose(env,'new');assert.equal(s.run.rng.seed,42);env.__inspect.flushFrame(1016);key(env,'F7');const before=structuredClone(s.run);env.__inspect.flushFrame(1032);assert.deepEqual(s.run,before);key(env,'F8');env.__inspect.flushFrame(1048);assert.ok(Math.abs(s.run.time-before.time-1/60)<1e-12);const time=s.run.time;env.__inspect.flushFrame(1064);assert.equal(s.run.time,time);
  key(env,'KeyP');key(env,'F8');env.__inspect.flushFrame(1080);assert.equal(s.run.time,time);key(env,'KeyP');env.__inspect.flushFrame(1096);assert.equal(s.run.time,time);key(env,'F7');env.__inspect.flushFrame(1112);assert.ok(s.run.time>time);app.dispose();assert.equal(env.__inspect.listenerCount(),0);
}));
test('developer shortcuts are unavailable during ordinary play',()=>withBrowser(env=>{
  const s=state(),app=createGame(s);choose(env,'new');assert.equal(app.debug,undefined);env.__inspect.flushFrame(1016);const time=s.run.time;key(env,'F7');env.__inspect.flushFrame(1032);assert.ok(s.run.time>time);app.dispose();
},''));
test('runtime simulation is identical with debug recording on and off for the same seed and input',()=>{
  const simulate=visible=>withBrowser(env=>{const s=state(),app=createGame(s);choose(env,'new');if(!visible)key(env,'F6');key(env,'KeyD');for(let i=1;i<=180;i++)env.__inspect.flushFrame(1000+i*16);const saved=encodeSave(s.profile,s.run);app.dispose();return saved;});assert.equal(simulate(true),simulate(false));
});
test('production random consumers are confined to run, seed and legacy boundaries',()=>{
  for(const name of ['combat/weapons.js','combat/specializations.js','combat/population.js','combat/runtime.js','world/sites.js','world/objectives.js','world/pickups.js','growth/progression.js','render/feedback.js'])assert.doesNotMatch(readFileSync(new URL('../src/'+name,import.meta.url),'utf8'),/Math\.random/);
});

// Every catalog entry must really run, draw and restore; a missing dispatch becomes a failed test.
const loadouts=[...branches.flatMap(b=>b.options.map(option=>({name:'spec:'+b.id+':'+option.id,weapon:b.id,option:option.id}))),...fusionRecipes.map(f=>({name:'fusion:'+f.id,fusion:f}))];
for(const loadout of loadouts)test('skill wiring: '+loadout.name,()=>withBrowser(env=>{
  const s=state(),app=createGame(s);choose(env,'new');const r=s.run;r.spawnClock=100;r.ambientClock=100;r.invulnUntil=1e9;
  r.enemies=Array.from({length:9},(_,i)=>({id:r.nextId++,kind:0,x:r.player.x+40+(i%3)*60,y:r.player.y+(Math.floor(i/3)-1)*60,hp:1e8,maxHp:1e8,speed:0,radius:11,orbitHitAt:0,phase:0,aiTimer:100,dx:0,dy:0,flash:0,elite:false,xpScale:1}));
  if(loadout.fusion){const f=loadout.fusion;for(const [id,branch]of f.needs){r.up[id]=5;r.branches[id]=branch;}if(f.base)r.up['fusion_'+f.base]=4;r.up['fusion_'+f.id]=1;}
  else{r.up[loadout.weapon]=4;r.branches[loadout.weapon]=loadout.option;}
  const recorded=new Set();let checkpoint=null;
  for(let i=1;i<=600;i++){
    env.__inspect.flushFrame(1000+i*16);for(const shape of app.debug.snapshot()){recorded.add(shape.label);assert.ok(shape.values.flat().every(Number.isFinite),loadout.name+' finite geometry');}
    const live=loadout.fusion?r.fusionStates[loadout.fusion.id]?.phase!=='wait':r.arsenal.fields.length||['pulse','orbit','beacon'].includes(loadout.weapon);
    if(!checkpoint&&i>=30&&live){
      const data=readSave(encodeSave(s.profile,r));checkpoint=restoreRun(data.run,data.profile);assert.ok(checkpoint,loadout.name);assert.deepEqual(checkpoint.rng,r.rng);
      if(loadout.fusion){assert.equal(checkpoint.up['fusion_'+loadout.fusion.id],1);assert.equal(checkpoint.fusionStates[loadout.fusion.id]?.phase,r.fusionStates[loadout.fusion.id].phase,loadout.name+' active phase must survive');}
      else{assert.equal(checkpoint.branches[loadout.weapon],loadout.option);assert.equal(checkpoint.arsenal.states[loadout.weapon]?.phase,r.arsenal.states[loadout.weapon].phase);assert.deepEqual(checkpoint.arsenal.fields.map(f=>[f.type,f.phase]),r.arsenal.fields.map(f=>[f.type,f.phase]),loadout.name+' live fields must survive');}
    }
  }
  assert.ok(checkpoint,loadout.name+' must save an active state');assert.ok(r.time>9,'simulation must continue without getting stuck in a modal');assert.ok(recorded.size,loadout.name+' must execute a hit test');
  if(loadout.fusion)assert.ok([...recorded].some(label=>label.startsWith(loadout.fusion.id+':')),loadout.name+' must execute its own damage/sensor geometry');
  else if(['nova','chain','lance','mine','rift','orbit'].includes(loadout.weapon))assert.ok([...recorded].some(label=>label.startsWith(loadout.weapon)),loadout.name+' must execute its own geometry');
  // Continue the restored active state in the real update/render path, not just a JSON round trip.
  s.replaceRun(checkpoint);for(let i=601;i<=620;i++)env.__inspect.flushFrame(1000+i*16);assert.ok(Number.isFinite(s.run.player.hp));app.dispose();
}));

test('hit-window observations show count, gap and cooldown without changing the ledger',()=>{
  const h=inspectorFixture(),list=[{id:7,tag:'scan',at:0,count:2}];h.s.run.time=.1;const before=structuredClone(list);h.inspector.hitWindow('beam',7,'scan',.2,8,list,false);assert.deepEqual(list,before);assert.deepEqual(h.inspector.report().windows,[{owner:'beam',id:7,bucket:'scan',gap:.2,limit:8,count:2,remaining:.1,accepted:false}]);h.inspector.beginStep();assert.deepEqual(h.inspector.report().windows,[]);
});
test('particle capacity changes cannot change seeded combat, loot or upgrade outcomes',()=>{
  const simulate=saturated=>withBrowser(env=>{
    const s=state(),app=createGame(s);choose(env,'new');const r=s.run;r.invulnUntil=100;r.enemies=[{id:r.nextId++,kind:0,x:r.player.x+40,y:r.player.y,hp:1,maxHp:1,speed:0,radius:11,orbitHitAt:0,phase:0,aiTimer:100,dx:0,dy:0,flash:0,elite:false,xpScale:1}];
    if(saturated)r.fx=Array.from({length:360},()=>({x:0,y:0,vx:0,vy:0,life:100,max:100,color:'#fff'}));for(let i=1;i<=180;i++)env.__inspect.flushFrame(1000+i*16);assert.ok(r.kills>0);const saved=encodeSave(s.profile,r);app.dispose();return saved;
  });assert.equal(simulate(false),simulate(true));
});
test('hostile hazard observations preserve beam thickness and ring safe-gap geometry',()=>{
  const h=inspectorFixture(),d=h.inspector;d.hazard({x:1,y:2,shape:'beam',angle:0,length:100,width:12,fireAt:0,endAt:2},1);d.hazard({x:1,y:2,shape:'ring',angle:1,gap:.7,radius:100,width:10,fireAt:0,endAt:2},1);const shapes=d.snapshot();assert.deepEqual(shapes[0].values,[1,2,101,2,6]);assert.deepEqual(shapes[1].values,[1,2,63,5,1,.7]);assert.ok(shapes.every(s=>s.role==='hostile'));d.draw();
});




test('debug mode and reproducible seed require explicit valid URL options',()=>{
  assert.deepEqual(readDebugOptions('?debug=1&seed=0'),{enabled:true,seed:0});assert.deepEqual(readDebugOptions('?seed=4294967295&debug=1'),{enabled:true,seed:4294967295});
  for(const query of ['', '?seed=42', '?debug=0&seed=42', '?xdebug=1'])assert.equal(readDebugOptions(query).enabled,false);
  for(const query of ['?debug=1&seed=-1','?debug=1&seed=1.5','?debug=1&seed=4294967296','?debug=1&seed=NaN'])assert.deepEqual(readDebugOptions(query),{enabled:true,seed:undefined});
});
