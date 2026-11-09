import test from 'node:test';
import assert from 'node:assert/strict';
import { createDebugGame } from '../src/debug/create-debug-game.js';
import { createGame } from '../src/app/create-game.js';
import { createMockBrowser } from './mock-browser.js';
import { branches } from '../src/data/specializations.js';
import { ENEMY_LIMIT } from '../src/core/config.js';

function withBrowser(callback){
  const env=createMockBrowser({observers:true}),descriptors=new Map();env.location={search:'?debug=1&seed=42'};
  for(const [key,value]of Object.entries(env)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  try{return callback(env);}finally{for(const [key,d]of descriptors)if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}
}
function lab(callback,options={}){return withBrowser(env=>{const app=createDebugGame({mountPanel:false,...options}),tools=app.tools;let frame=1000;const tick=(count=1)=>{for(let i=0;i<count;i++)env.__inspect.flushFrame(frame+=16);};try{return callback({env,app,tools,tick,state:()=>JSON.parse(tools.snapshot())});}finally{app.dispose();}});}

test('debug lab never accesses production storage and starts held with a seeded private run',()=>withBrowser(env=>{
  let accesses=0;env.localStorage={getItem(){accesses++;throw Error('production read');},setItem(){accesses++;throw Error('production write');},removeItem(){accesses++;throw Error('production deletion');}};
  const app=createDebugGame({mountPanel:false});try{assert.equal(app.tools.report().seed,42);assert.equal(app.tools.report().held,true);app.tools.start(77);env.document.getElementById('saveButton').dispatch('click');assert.equal(app.tools.report().seed,77);assert.equal(accesses,0);}finally{app.dispose();}
}));
test('automatic population is off by default; manual spawns still use the normal factory',()=>lab(h=>{
  h.tools.hold(false);h.tick(240);assert.equal(h.state().run.enemies.length,0);const ids=h.tools.spawn(0,3,{distance:150});assert.equal(ids.length,3);assert.equal(h.state().run.enemies.length,3);
  h.tools.configure('playerAttacks',false);h.tools.configure('autoSpawn',true);h.tick(150);assert.ok(h.state().run.enemies.length>3);
}));
test('all 16 specialization grants configure their prerequisite level and chosen branch',()=>lab(h=>{
  for(const b of branches)for(const option of b.options){h.tools.clearBuild();h.tools.giveSkill(`spec:${b.id}:${option.id}`,4);const r=h.state().run;assert.equal(r.branches[b.id],option.id);assert.equal(r.up[b.id],4);assert.ok(r.up[b.id]>=3);}
}));



test('every skill catalog option is accepted, clamps to catalog limits and rejects invalid commands atomically',()=>lab(h=>{
  for(const item of h.tools.catalog.skills){h.tools.clearBuild();h.tools.giveSkill(item.id,12);const r=h.state().run;assert.ok(r.player.hp>0);assert.ok(Object.values(r.up).every(Number.isFinite));}
  const before=h.tools.snapshot();for(const id of ['nope','spec:nova:nope','fusion:nope'])assert.throws(()=>h.tools.giveSkill(id));assert.throws(()=>h.tools.giveSkill('power',NaN));assert.equal(h.tools.snapshot(),before);
}));
test('all enemy kinds and supported elite variants spawn with valid data and unique IDs',()=>lab(h=>{
  const ids=new Set();for(const e of h.tools.catalog.enemies){h.tools.clearThreats();for(const elite of [false,true]){const [id]=h.tools.spawn(e.kind,1,{elite,distance:120,hp:1000});assert.ok(!ids.has(id));ids.add(id);const enemy=h.state().run.enemies.find(e=>e.id===id);assert.equal(enemy.kind,e.kind);assert.equal(enemy.hp,1000);assert.ok(Number.isFinite(enemy.x)&&Number.isFinite(enemy.y));if(elite&&e.kind!==3)assert.equal(enemy.elite,true);}}
}));
test('enemy formation, position, cap and invalid values are deterministic and bounded',()=>lab(h=>{
  const p=h.state().run.player;h.tools.spawn(0,3,{formation:'line',angle:0,distance:100});const enemies=h.state().run.enemies;assert.deepEqual(enemies.map(e=>e.x),[p.x+100,p.x+100,p.x+100]);assert.deepEqual(enemies.map(e=>e.y),[p.y-45,p.y,p.y+45]);
  for(let i=0;i<5;i++)h.tools.spawn(0,50);assert.equal(h.state().run.enemies.length,ENEMY_LIMIT);const before=h.tools.snapshot();for(const args of [[99,1],[0,51],[0,1,{hp:-1}],[0,1,{formation:'bad'}]])assert.throws(()=>h.tools.spawn(...args));assert.equal(h.tools.snapshot(),before);
}));
test('final core setup creates the real boss and nodes, and clearing permits a clean new setup',()=>lab(h=>{
  h.tools.spawnCore();let r=h.state().run;assert.equal(r.finalStep,2);assert.equal(r.enemies.filter(e=>e.final).length,1);assert.ok(r.enemies.some(e=>e.coreNode));h.tools.spawnCore();r=h.state().run;assert.equal(r.enemies.filter(e=>e.final).length,1);h.tools.clearThreats();assert.equal(h.state().run.finalStep,0);
}));
test('manual enemy deletion does not grant kills, gold or experience',()=>lab(h=>{
  h.tools.spawn(6,5);const before=h.state().run;h.tools.clearThreats();const after=h.state().run;assert.equal(after.enemies.length,0);for(const key of ['kills','gold','xp'])assert.equal(after[key],before[key]);
}));
test('AI freeze keeps positions still while the simulation and player attacks can be controlled separately',()=>lab(h=>{
  h.tools.configure('enemyAI',false);h.tools.configure('playerAttacks',false);h.tools.spawn(0,1,{distance:180});const before=h.state().run.enemies[0];h.tools.hold(false);h.tick(120);const after=h.state().run.enemies[0];assert.equal(after.x,before.x);assert.equal(after.y,before.y);assert.equal(h.state().run.shots.length,0);assert.ok(h.state().run.time>1);
  h.tools.configure('enemyAI',true);h.tick(10);assert.notEqual(h.state().run.enemies[0].x,before.x);
}));
test('player damage blocking, normal hit rules and healing use the real combat path',()=>lab(h=>{
  const max=h.state().run.player.hp;h.tools.hurt(10);assert.equal(h.state().run.player.hp,max);h.tools.configure('godMode',false);h.tools.hurt(10);assert.equal(h.state().run.player.hp,max-10);h.tools.hurt(10);assert.equal(h.state().run.player.hp,max-10);h.tools.heal();assert.equal(h.state().run.player.hp,max);h.tools.setHp(1);assert.equal(h.state().run.player.hp,1);
}));
test('enemy damage blocking preserves a close stationary target; attacks can still be observed',()=>lab(h=>{
  h.tools.configure('enemyAI',false);h.tools.configure('blockEnemyDamage',true);h.tools.spawn(0,1,{distance:40,hp:1000});h.tools.hold(false);h.tick(80);assert.equal(h.state().run.enemies[0].hp,1000);h.tools.configure('blockEnemyDamage',false);h.tick(80);assert.ok(h.state().run.enemies[0].hp<1000);
}));
test('world events and automatic growth screens are disabled without preventing ordinary weapon tests',()=>lab(h=>{
  h.tools.setTime(900);h.tools.giveSkill('nova',5);h.tools.hold(false);h.tick(20);assert.equal(h.tools.report().mode,'playing');assert.equal(h.state().run.site,null);assert.equal(h.state().run.journey.active,null);h.tools.configure('choices',true);h.tick();assert.equal(h.tools.report().mode,'branch');
}));
test('single steps are exact and faster time uses bounded simulation substeps',()=>lab(h=>{
  h.tools.step();h.tick();assert.ok(Math.abs(h.state().run.time-1/60)<1e-12);const before=h.state().run.time;h.tick(3);assert.equal(h.state().run.time,before);h.tools.configure('timeScale',4);h.tools.hold(false);h.tick();assert.ok(Math.abs(h.state().run.time-before-.064)<1e-12);
  h.env.dispatch('keydown',{code:'KeyP'});const paused=h.state().run.time;assert.equal(h.tools.step(),false);h.tick();assert.equal(h.state().run.time,paused);
}));
test('time jump clears combat and old absolute hit clocks; teleport changes only position',()=>lab(h=>{
  h.tools.giveSkill('spec:rift:trail');h.tools.spawn(0,3);h.tools.setTime(1500);const r=h.state().run;assert.equal(r.time,1500);assert.equal(r.enemies.length,0);assert.deepEqual(r.fusionStates,{});const hp=r.player.hp;h.tools.teleport(-100,200);assert.deepEqual(h.state().run.player,{...r.player,x:-100,y:200});assert.equal(h.state().run.player.hp,hp);
}));
test('checkpoint restores the seeded cursor and build; malformed imports leave the current run intact',()=>lab(h=>{
  h.tools.giveSkill('spec:nova:boundary');h.tools.spawn(0,1);h.tools.step();h.tick();const before=h.state();h.tools.saveCheckpoint();h.tools.clearBuild();h.tools.spawn(0,2);h.tools.loadCheckpoint();const restored=h.state();assert.deepEqual(restored.run.rng,before.run.rng);assert.deepEqual(Object.fromEntries(Object.entries(restored.run.up).filter(([,value])=>value)),before.run.up);assert.equal(restored.run.enemies.length,before.run.enemies.length);assert.equal(h.tools.report().held,true);
  const snapshot=h.tools.snapshot();assert.throws(()=>h.tools.loadSnapshot('{broken'));assert.throws(()=>h.tools.loadSnapshot('{"v":99}'));assert.equal(h.tools.snapshot(),snapshot);
}));
test('debug reset, live settings and controls remain session-isolated and cleanup is idempotent',()=>withBrowser(env=>{
  const a=createDebugGame({mountPanel:false});a.tools.giveSkill('power',12);a.dispose();assert.equal(env.__inspect.listenerCount(),0);assert.equal(env.__inspect.frames.size,0);assert.throws(()=>a.tools.giveSkill('power',1));
  const b=createDebugGame({mountPanel:false});try{assert.equal(JSON.parse(b.tools.snapshot()).run.up.power,undefined);assert.equal(b.tools.report().settings.autoSpawn,false);assert.throws(()=>b.tools.configure('toString',true));}finally{b.dispose();b.dispose();}assert.equal(env.__inspect.listenerCount(),0);
}));
test('production ignores debug URL options and does not bind developer shortcuts or expose tools',()=>withBrowser(env=>{
  const app=createGame();try{assert.equal(app.debug,undefined);assert.equal(app.tools,undefined);const button={dataset:{action:'new'},closest:s=>s==='[data-action]'?button:null};env.document.getElementById('overlay').dispatch('click',{target:button});env.dispatch('keydown',{code:'F7'});env.__inspect.flushFrame(1016);assert.equal(env.__inspect.frames.size,1);}finally{app.dispose();}
}));
test('panel lifecycle, privacy, keyboard capture and F10 do not leak game movement',()=>withBrowser(env=>{
  const created=[],originalCreate=env.document.createElement;env.document.createElement=(...args)=>{const element=originalCreate(...args);created.push(element);return element;};
  const app=createDebugGame({mountPanel:true});try{const root=created.find(e=>e.id==='fieldDebugPanel'),dock=created.find(e=>e.id==='fieldDebugDock');assert.ok(root.innerHTML.includes('최종 코어 생성'));let stopped=false;root.dispatch('keydown',{code:'KeyW',stopPropagation(){stopped=true;}});assert.equal(stopped,true);
    env.dispatch('keydown',{code:'F10'});assert.equal(root.hidden,true);assert.equal(dock.hidden,false);env.dispatch('keydown',{code:'F9'});assert.equal(root.hidden,true);assert.equal(dock.hidden,true);env.__inspect.flushFrame(1016);assert.equal(root.hidden,true);
  }finally{app.dispose();}assert.equal(env.__inspect.listenerCount(),0);assert.equal(env.__inspect.frames.size,0);
}));

test('isolated skill tests clear unrelated build and suppress only the automatic base PULSE',()=>lab(h=>{
  h.tools.giveSkill('spec:rift:trail');h.tools.giveSkill('nova',5,{isolate:true});assert.equal(h.tools.report().settings.basePulse,false);assert.deepEqual(h.state().run.up,{nova:5});h.tools.configure('enemyAI',false);h.tools.spawn(0,1,{distance:200,hp:1e8});h.tools.hold(false);h.tick(60);assert.equal(h.state().run.shots.filter(s=>s.kind==='pulse').length,0);
  h.tools.giveSkill('spec:pulse:tracking',4,{isolate:true});assert.equal(h.tools.report().settings.basePulse,true);h.tick(20);assert.ok(h.state().run.shots.some(s=>s.kind==='pulse'));
}));
test('invalid isolated selections, invalid teleport coordinates and invalid seeds do not partially commit',()=>lab(h=>{
  h.tools.giveSkill('power',10);const before=h.tools.snapshot();assert.throws(()=>h.tools.giveSkill('nope',4,{isolate:true}));assert.throws(()=>h.tools.teleport(999,NaN));assert.equal(h.tools.snapshot(),before);assert.throws(()=>h.tools.start(-1));assert.equal(h.tools.snapshot(),before);
}));
test('invalid initial debug options fail before mounting any listeners or frame requests',()=>withBrowser(env=>{
  assert.throws(()=>createDebugGame({seed:-1}));assert.equal(env.__inspect.listenerCount(),0);assert.equal(env.__inspect.frames.size,0);
}));

test('hiding hitbox overlay preserves hold and keyboard stepping remains available',()=>lab(h=>{
  h.env.dispatch('keydown',{code:'F6'});assert.equal(h.tools.report().held,true);const before=h.state().run.time;h.tick();assert.equal(h.state().run.time,before);h.env.dispatch('keydown',{code:'F8'});h.tick();assert.ok(h.state().run.time>before);
}));
test('growth screens can be disabled or cleared by a build command without leaving a stale modal',()=>lab(h=>{
  h.tools.configure('choices',true);h.tools.giveSkill('nova',4);h.tools.hold(false);h.tick();assert.equal(h.tools.report().mode,'branch');h.tools.configure('choices',false);assert.equal(h.tools.report().mode,'playing');h.tools.configure('choices',true);h.tick();assert.equal(h.tools.report().mode,'branch');h.tools.clearBuild();assert.equal(h.tools.report().mode,'playing');
}));
test('imported snapshots follow pending growth screens when enabled and remain inspectable when disabled',()=>lab(h=>{
  const snapshot=h.state();snapshot.run.pending=1;snapshot.run.choices=['power'];h.tools.configure('choices',true);h.tools.loadSnapshot(JSON.stringify(snapshot));assert.equal(h.tools.report().mode,'levelup');assert.equal(h.tools.step(),false);h.tools.configure('choices',false);assert.equal(h.tools.report().mode,'playing');h.tools.loadSnapshot(JSON.stringify(snapshot));assert.equal(h.tools.report().held,true);
}));
test('hostile projectile toggle clears live bullets and hazards while allowing contact/AI tests',()=>lab(h=>{
  h.tools.configure('playerAttacks',false);h.tools.spawn(4,1,{distance:250,hp:1e9});h.tools.hold(false);h.tick(240);h.tools.configure('hostileProjectiles',false);h.tick(100);const r=h.state().run;assert.equal(r.bullets.length,0);assert.equal(r.hazards.length,0);assert.ok(r.enemies.length>0);
}));

test('panel delegates isolated grants, spawning and checkbox settings to the real controller',()=>withBrowser(env=>{
  const created=[],create=env.document.createElement;env.document.createElement=(...args)=>{const node=create(...args);created.push(node);return node;};const app=createDebugGame({mountPanel:true});
  try{const root=created.find(n=>n.id==='fieldDebugPanel'),fields={skill:{value:'nova'},level:{value:'5'},enemy:{value:'9'},count:{value:'3'},distance:{value:'120'},angle:{value:'90'},formation:{value:'line'},enemyHp:{value:'1000'},elite:{checked:true}},status={textContent:''};
    root.querySelector=selector=>selector==='[data-status]'?status:fields[selector.match(/^\[name="([^"]+)"\]$/)?.[1]]||null;
    const click=action=>{const target={dataset:{debugAction:action},closest:()=>target};root.dispatch('click',{target});};click('isolate');assert.equal(JSON.parse(app.tools.snapshot()).run.up.nova,5);assert.equal(app.tools.report().settings.basePulse,false);click('spawn');assert.equal(app.tools.report().enemies,3);assert.ok(JSON.parse(app.tools.snapshot()).run.enemies.every(e=>e.elite));assert.match(status.textContent,/3/);
    root.dispatch('change',{target:{dataset:{setting:'autoSpawn'},type:'checkbox',checked:true}});assert.equal(app.tools.report().settings.autoSpawn,true);
  }finally{app.dispose();}
}));
