import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as policy from '../src/core/view-policy.js';
import { createLoop } from '../src/app/loop.js';
import { createKeyboardInput } from '../src/input/keyboard.js';
import { createActions } from '../src/app/actions.js';
import { createGrowthActions } from '../src/ui/growth-actions.js';

const modes=['playing','menu','paused','levelup','branch','fusion','signal','bosschoice','encounter','secret','site','relic','echo','legacy','anomaly','keystone','finalintro','finalchoice','ending','gameover','ledger','newconfirm','resetconfirm','loadout','unknown'];
const runs=[null,Object.freeze({pending:0}),Object.freeze({pending:2})];
function flags(mode,bits){return {mode,panic:!!(bits&1),buildOpen:!!(bits&2),shopOpen:!!(bits&4),skillInfoOpen:!!(bits&8)};}
// Independent copies of the v2.6.23 call-site conditions. Do not derive expected values from policy helpers.
const previous={
  canSimulate:v=>v.mode==='playing'&&!v.panic&&!v.buildOpen&&!v.shopOpen,
  canRenderScene:v=>!v.panic&&!v.buildOpen&&!v.shopOpen&&v.mode==='playing',
  canControlLiveCombat:v=>!v.panic&&v.mode==='playing'&&!v.buildOpen&&!v.shopOpen&&!v.skillInfoOpen,
  canRefreshHud:v=>v.mode==='playing'&&!v.buildOpen&&!v.shopOpen&&!v.skillInfoOpen,
  canAutoSave:(v,r)=>!!r&&v.mode==='playing'&&!v.panic&&!v.buildOpen&&!v.shopOpen&&!v.skillInfoOpen,
  canInteractInWorld:v=>v.mode==='playing',canAcceptMovement:v=>v.mode==='playing',canPauseGame:v=>v.mode==='playing',canTogglePause:v=>v.mode==='playing'||v.mode==='paused',
  canOpenFusion:(v,r)=>!!r&&!v.panic&&!v.buildOpen&&!v.shopOpen&&!v.skillInfoOpen&&['playing','paused'].includes(v.mode),
  fusionButtonEnabled:(v,r)=>!!r&&['playing','paused','fusion'].includes(v.mode),
  canRerollUpgrade:(v,r)=>!(v.mode!=='levelup'||v.panic||v.buildOpen||v.skillInfoOpen||!r?.pending),
  canOpenUpgradeInfo:v=>!(v.panic||v.skillInfoOpen||v.mode!=='levelup'),
  canToggleBuildGuide:(v,r,open)=>!(v.panic||(open&&(v.shopOpen||v.mode==='resetconfirm'))||v.buildOpen===open),
  canToggleShop:(v,r,open)=>!(v.panic||(open&&(v.buildOpen||v.skillInfoOpen||!['menu','paused','playing','ending','gameover'].includes(v.mode)))||v.shopOpen===open),
  canOpenShopWithKeyboard:v=>['menu','paused','ending','gameover'].includes(v.mode),canBuyPermanentUpgrade:v=>v.mode==='menu',canResetRecords:v=>v.mode==='resetconfirm'&&!v.panic
};
assert.deepEqual(Object.keys(policy).sort(),Object.keys(previous).sort(),'Every public policy needs an independent compatibility matrix');
for(const match of readFileSync(new URL('../src/ui/modal-content.js',import.meta.url),'utf8').matchAll(/view.mode\s*===\s*'([^']+)'/g))assert.ok(modes.includes(match[1]),'Add the new screen to the policy matrix: '+match[1]);
for(const [name,expected]of Object.entries(previous))test(name+' preserves existing permissions across 2,304 screen/flag/run/open combinations',()=>{
  for(const mode of modes)for(let bits=0;bits<16;bits++)for(const run of runs)for(const open of [false,true]){
    const view=Object.freeze(flags(mode,bits)),actual=name==='canToggleBuildGuide'||name==='canToggleShop'?policy[name](view,open):policy[name](view,run);
    assert.equal(actual,expected(view,run,open),JSON.stringify({name,view,run,open}));assert.equal(typeof actual,'boolean');
  }
});

test('real frame routing follows independent simulation/render/HUD/autosave permissions for every state',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame');Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:()=>7});
  try{
    for(const mode of modes)for(let bits=0;bits<16;bits++)for(const run of runs){
      const view={...flags(mode,bits),lastFrame:0,lastHud:0,nextSave:0},calls=[],loop=createLoop({sessionState:{run},view,update:{update:dt=>calls.push(['update',dt])},cameraView:{followCamera:dt=>calls.push(['camera',dt])},scene:{draw:()=>calls.push(['draw'])},hud:{updateHud:()=>calls.push(['hud'])},storage:{save:()=>calls.push(['save'])}});
      loop.frame(1000);const names=calls.map(c=>c[0]);assert.equal(names.includes('update'),previous.canSimulate(view));assert.equal(names.includes('draw'),previous.canRenderScene(view));assert.equal(names.includes('camera'),previous.canRenderScene(view));assert.equal(names.includes('hud'),previous.canRefreshHud(view));assert.equal(names.includes('save'),previous.canAutoSave(view,run));assert.equal(view.frameRequest,7);assert.equal(view.nextSave,6000);assert.equal(view.lastFrame,1000);
    }
  }finally{if(descriptor)Object.defineProperty(globalThis,'requestAnimationFrame',descriptor);else delete globalThis.requestAnimationFrame;}
});
test('a frame rechecks permissions after simulation changes the mode instead of using stale render/save permission',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame');Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:()=>1});
  try{
    const view={...flags('playing',0),lastFrame:0,lastHud:0,nextSave:0},calls=[],loop=createLoop({sessionState:{run:{}},view,update:{update(){calls.push('update');view.mode='levelup';}},cameraView:{followCamera:()=>calls.push('camera')},scene:{draw:()=>calls.push('draw')},hud:{updateHud:()=>calls.push('hud')},storage:{save:()=>calls.push('save')}});loop.frame(1000);assert.deepEqual(calls,['update']);
  }finally{if(descriptor)Object.defineProperty(globalThis,'requestAnimationFrame',descriptor);else delete globalThis.requestAnimationFrame;}
});
test('manual save keeps its original input priority and is not blocked by autosave permission',()=>{
  for(const mode of modes)for(let bits=0;bits<16;bits++){
    const view=flags(mode,bits),calls=[],input=createKeyboardInput({sessionState:{run:{}},view,platform:{keys:new Set()},shop:{},buildGuide:{},menuInput:{},storage:{save:()=>calls.push('save')},growthActions:{},display:{},actions:{},session:{}});
    input.keydown({code:'KeyS',ctrlKey:true,preventDefault:()=>calls.push('prevent')});assert.deepEqual(calls,view.panic?[]:['prevent','save']);
  }
});
test('world interaction rechecks the mode between prioritized encounters and stops after a screen opens',()=>{
  const view={mode:'playing'},calls=[],actions=createActions({view,buildGuide:{},growthActions:{},session:{},screen:{},storage:{},journey:{},finale:{},sites:{meetSite(){calls.push('site');return false;}},objectives:{meetObjective(){calls.push('objective');return false;}},story:{dismantleGuardian(){return false;},meetWitness(){calls.push('witness');view.mode='encounter';},meetLegacy(){calls.push('legacy');}},encounters:{meetEcho(){calls.push('echo');return false;},meetFront(){calls.push('front');return false;}}});
  actions.interact();assert.deepEqual(calls,['site','objective','witness']);actions.interact();assert.deepEqual(calls,['site','objective','witness']);
});
test('fusion UI opens when screen policy allows it',()=>{
  for(const mode of ['playing','paused']){const view=flags(mode,0),calls=[],actions=createGrowthActions({sessionState:{run:{}},view,platform:{keys:new Set()},screen:{setMode:mode=>calls.push(mode)},storage:{},feedback:{},progression:{}});assert.equal(policy.canOpenFusion(view,{}),true);actions.toggleFusion();assert.deepEqual(calls,['fusion']);}
});
