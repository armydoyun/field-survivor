import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/app/create-game.js';
import { initialProfile } from '../src/core/profile.js';
import { createEvents } from '../src/app/events.js';
import { createMockBrowser } from './mock-browser.js';

function state(){const s={profile:initialProfile(),run:null,replaceRun(next){s.run=next;},resetState(){s.profile=initialProfile();s.run=null;}};return s;}
function withBrowser(callback){
  const env=createMockBrowser({observers:true}), descriptors=new Map();
  for(const [key,value]of Object.entries(env)){if(key==='window')continue;descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
  descriptors.set('window',Object.getOwnPropertyDescriptor(globalThis,'window'));Object.defineProperty(globalThis,'window',{value:env,writable:true,configurable:true});
  try{return callback(env);}finally{for(const [key,descriptor]of descriptors)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
}
function choose(env,action){const button={dataset:{action},closest:selector=>selector==='[data-action]'?button:null};env.document.getElementById('overlay').dispatch('click',{target:button});}

test('mount binds input and schedules one frame; disposal releases listeners, observer and frame',()=>withBrowser(env=>{
  const s=state(), app=createGame(s), count=env.__inspect.listenerCount();assert.ok(count>=20);assert.equal(env.__inspect.frames.size,1);assert.equal(env.__inspect.activeObservers.size,1);
  choose(env,'new');assert.ok(s.run);env.dispatch('keydown',{code:'KeyD'});const x=s.run.player.x;env.__inspect.flushFrame(1016);assert.ok(s.run.player.x>x);
  const pending=[...env.__inspect.frames.values()][0];app.dispose();app.dispose();assert.equal(env.__inspect.listenerCount(),0);assert.equal(env.__inspect.frames.size,0);assert.equal(env.__inspect.activeObservers.size,0);
  const before=structuredClone(s.run);pending(1032);assert.deepEqual(s.run,before);assert.equal(env.__inspect.frames.size,0);
}));
test('save and remount restore through the provided session without mutating a previous session',()=>withBrowser(env=>{
  const first=state(), a=createGame(first);choose(env,'new');first.run.player.x=777;env.document.getElementById('saveButton').dispatch('click');a.dispose();
  const original=first.run, second=state(), b=createGame(second);assert.equal(second.run.player.x,777);assert.notEqual(second.run,original);
  choose(env,'resume');env.dispatch('keydown',{code:'KeyD'});env.__inspect.flushFrame(1016);assert.ok(second.run.player.x>777);assert.equal(first.run.player.x,777);
  second.profile.gold=999;assert.equal(first.profile.gold,0);b.dispose();assert.equal(env.__inspect.listenerCount(),0);
}));
test('mount-dispose cycles do not accumulate event handlers or scheduled work',()=>withBrowser(env=>{
  let expected=null;for(let i=0;i<4;i++){const app=createGame(state()), count=env.__inspect.listenerCount();expected??=count;assert.equal(count,expected);assert.equal(env.__inspect.frames.size,1);app.dispose();assert.equal(env.__inspect.listenerCount(),0);assert.equal(env.__inspect.frames.size,0);}
}));
test('event binding is idempotent and an old cleanup cannot unregister a later binding',()=>withBrowser(env=>{
  const noop=()=>{}, platform={$:id=>env.document.getElementById(id),keys:new Set(),canvas:env.document.getElementById('field')};
  const events=createEvents({view:{},platform,shop:{},buildGuide:{},menuInput:{},storage:{},display:{fitCanvas:noop},session:{},input:{keydown:noop,keyup:noop},actions:{overlayClick:noop,toggleFusion:noop}});
  const first=events.bindEvents(), count=env.__inspect.listenerCount();assert.equal(events.bindEvents(),first);assert.equal(env.__inspect.listenerCount(),count);
  first();const second=events.bindEvents();first();assert.equal(env.__inspect.listenerCount(),count);assert.equal(events.bindEvents(),second);second();assert.equal(env.__inspect.listenerCount(),0);
}));
