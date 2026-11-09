import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createActions } from '../src/app/actions.js';
import { createKeyboardInput } from '../src/input/keyboard.js';
import { createMenuInput } from '../src/ui/menu-input.js';
import { createMockBrowser } from './mock-browser.js';

function actionFixture(){
  const calls=[],view={mode:'playing',newConfirmReturn:'paused'},fn=name=>(...args)=>calls.push([name,...args]);
  const method=(prefix,names)=>Object.fromEntries(names.map(name=>[name,fn(prefix+'.'+name)]));
  const deps={view,buildGuide:method('guide',['toggleBuildGuide','openUpgradeInfo']),growthActions:method('growth',['toggleFusion','chooseFusion','chooseUpgrade','chooseBranch','rerollUpgrade']),session:method('session',['startFresh','resume','resetAllRecords']),storage:method('storage',['save']),story:method('story',['chooseSignal','chooseBoss','chooseWitness','acknowledgeSilence','chooseAnomaly','chooseLegacy','meetWitness']),sites:method('sites',['chooseSite','chooseRelic','meetSite']),encounters:method('encounters',['finishEcho','meetEcho','meetFront']),journey:method('journey',['chooseKeystone']),finale:method('finale',['beginFinale','chooseFinale']),objectives:method('objectives',['meetObjective']),screen:{setMode:mode=>{calls.push(['mode',mode]);view.mode=mode;}}};
  return {calls,view,deps,actions:createActions(deps)};
}
function withBrowser(callback){
  const env=createMockBrowser(),descriptors=new Map();for(const [key,value]of Object.entries(env)){if(key==='window')continue;descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}descriptors.set('window',Object.getOwnPropertyDescriptor(globalThis,'window'));Object.defineProperty(globalThis,'window',{value:env,writable:true,configurable:true});
  try{return callback(env);}finally{for(const [key,descriptor]of descriptors)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
}
function keyFixture(env){
  const calls=[],view={mode:'playing'},keys=new Set(),fn=name=>(...args)=>{calls.push([name,...args.filter(x=>typeof x!=='object')]);return false;},platform={$:id=>env.document.getElementById(id),keys};
  const deps={sessionState:{run:{choices:['power']}},view,platform,shop:{toggleShop:fn('shop'),keyboardShop:fn('shopKeys')},buildGuide:{toggleBuildGuide:fn('guide'),closeUpgradeInfo:fn('closeInfo'),openUpgradeInfo:fn('info'),keyboardBuildGuide:fn('guideKeys')},menuInput:{hideGame:fn('hide'),keyboardMenu:fn('menuKeys')},storage:{save:fn('save')},growthActions:{toggleFusion:fn('fusion')},display:{toggleFullscreen:fn('fullscreen')},actions:{interact:fn('interact')},session:{pause:fn('pause')}};
  return {calls,view,keys,deps,input:createKeyboardInput(deps)};
}
function press(h,code,extra={}){const event={code,repeat:false,ctrlKey:false,metaKey:false,altKey:false,isComposing:false,target:null,prevented:0,preventDefault(){this.prevented++;},...extra};h.input.keydown(event);return event;}

test('every exact overlay action reaches its existing workflow with unchanged arguments',()=>{
  const cases=[['fusion-close','playing',['growth.toggleFusion']],['fusion-guide','playing',['guide.toggleBuildGuide',true]],['new','menu',['session.startFresh']],['new-cancel','newconfirm',['mode','paused']],['new-confirm','newconfirm',['session.startFresh',true]],['resume','paused',['session.resume']],['reroll','levelup',['growth.rerollUpgrade']],['hear','signal',['story.chooseSignal','hear']],['burn','signal',['story.chooseSignal','burn']],['witness-hear','encounter',['story.chooseWitness','hear']],['witness-take','encounter',['story.chooseWitness','take']],['silence','secret',['story.acknowledgeSilence']],['final-enter','finalintro',['finale.beginFinale']],['reset-open','menu',['mode','resetconfirm']],['reset-cancel','resetconfirm',['mode','menu']],['reset-confirm','resetconfirm',['session.resetAllRecords']],['ledger-open','ending',['mode','ledger']],['ledger-back','ledger',['mode','menu']]];
  for(const [id,mode,expected]of cases){const h=actionFixture();h.view.mode=mode;assert.equal(h.actions.dispatch(id),true);assert.deepEqual(h.calls,[expected],id);}
  const h=actionFixture();h.actions.dispatch('menu');assert.deepEqual(h.calls,[['mode','menu'],['storage.save']]);
});
test('prefix routes preserve complete suffixes and exact actions win before fusion/final prefixes',()=>{
  const routes=[['fusion-','growth.chooseFusion'],['anomaly-','story.chooseAnomaly'],['site-','sites.chooseSite'],['relic-','sites.chooseRelic'],['echo-','encounters.finishEcho'],['branch-','growth.chooseBranch'],['keystone-','journey.chooseKeystone'],['final-','finale.chooseFinale'],['legacy-','story.chooseLegacy']];
  for(const [prefix,method]of routes){const h=actionFixture();assert.equal(h.actions.dispatch(prefix+'test-with-hyphens'),true);assert.deepEqual(h.calls,[[method,'test-with-hyphens']]);}
  const h=actionFixture();h.actions.dispatch('fusion-guide');h.actions.dispatch('fusion-close');h.actions.dispatch('final-enter');assert.deepEqual(h.calls,[['guide.toggleBuildGuide',true],['growth.toggleFusion'],['finale.beginFinale']]);
});
test('guarded screen actions do nothing outside their allowed screen and unknown IDs never invoke object prototypes',()=>{
  for(const id of ['new-cancel','new-confirm','reset-open','reset-cancel','ledger-open','ledger-back']){const h=actionFixture();h.view.mode='playing';assert.equal(h.actions.dispatch(id),true);assert.deepEqual(h.calls,[],id);}
  const h=actionFixture();for(const id of [undefined,null,17,{},'unknown','toString','constructor','__proto__'])assert.equal(h.actions.dispatch(id),false);assert.deepEqual(h.calls,[]);
});
test('overlay click precedence is detail information then upgrade choice then an action on a nested element',()=>{
  for(const [matches,expected]of [[['[data-upgrade-info]','[data-choice]','[data-action]'],['guide.openUpgradeInfo','power']],[['[data-choice]','[data-action]'],['growth.chooseUpgrade','power']],[['[data-action]'],['story.chooseSignal','hear']]]){
    const h=actionFixture(),button={dataset:{upgradeInfo:'power',choice:'power',action:'hear'}};h.actions.overlayClick({target:{closest:selector=>matches.includes(selector)?button:null}});assert.deepEqual(h.calls,[expected]);
  }
  const h=actionFixture();h.actions.overlayClick({target:{closest:()=>null}});assert.deepEqual(h.calls,[]);
});
test('world interaction keeps site, objective, witness, echo, front and legacy priority with short circuiting',()=>{
  const cases=[['site',['site']],['objective',['site','objective']],['witness',['site','objective','witness']],['echo',['site','objective','witness','echo']],['front',['site','objective','witness','echo','front']],['none',['site','objective','witness','echo','front','legacy']]];
  for(const [winner,expected]of cases){const h=actionFixture(),calls=[],meet=name=>()=>{calls.push(name);if(name==='witness'&&winner==='witness')h.view.mode='encounter';return name===winner;};h.deps.sites.meetSite=meet('site');h.deps.objectives.meetObjective=meet('objective');h.deps.story.meetWitness=meet('witness');h.deps.encounters.meetEcho=meet('echo');h.deps.encounters.meetFront=meet('front');h.deps.story.meetLegacy=meet('legacy');h.deps.story.dismantleGuardian=()=>false;h.actions.interact();assert.deepEqual(calls,expected);h.view.mode='paused';h.actions.interact();assert.deepEqual(calls,expected);}
  const h=actionFixture(),calls=[];h.deps.story.dismantleGuardian=()=>{calls.push('guardian');return true;};h.deps.sites.meetSite=()=>{calls.push('site');return true;};h.actions.interact();assert.deepEqual(calls,['guardian']);
});
test('F9 closes auxiliary screens in order and works before privacy/IME guards, while repeats only prevent default',()=>withBrowser(env=>{
  const h=keyFixture(env);Object.assign(h.view,{panic:true,shopOpen:true,skillInfoOpen:true,buildOpen:true});const e=press(h,'F9',{isComposing:true});assert.equal(e.prevented,1);assert.deepEqual(h.calls,[['shop',false],['closeInfo'],['guide',false],['hide']]);h.calls.length=0;assert.equal(press(h,'F9',{repeat:true}).prevented,1);assert.deepEqual(h.calls,[]);
}));
test('privacy and composition block save, movement and interaction but keyup always releases held movement',()=>withBrowser(env=>{
  for(const guard of [{panic:true},{isComposing:true}]){const h=keyFixture(env);h.view.panic=guard.panic;h.keys.add('KeyD');for(const code of ['KeyD','KeyE','KeyS'])press(h,code,{isComposing:guard.isComposing,ctrlKey:code==='KeyS'});assert.deepEqual(h.calls,[]);h.input.keyup({code:'KeyD'});assert.equal(h.keys.size,0);}
}));
test('Ctrl/Meta+S precedes modal routing, suppresses repeat saves and respects Alt',()=>withBrowser(env=>{
  for(const modifier of ['ctrlKey','metaKey']){const h=keyFixture(env);h.view.shopOpen=true;assert.equal(press(h,'KeyS',{[modifier]:true}).prevented,1);assert.deepEqual(h.calls,[['save']]);h.calls.length=0;assert.equal(press(h,'KeyS',{[modifier]:true,repeat:true}).prevented,1);assert.deepEqual(h.calls,[]);press(h,'KeyS',{[modifier]:true,altKey:true});assert.deepEqual(h.calls,[['shopKeys']]);}
}));
test('shop modal consumes global shortcuts before guide, fusion and movement',()=>withBrowser(env=>{
  const h=keyFixture(env);h.view.shopOpen=true;for(const code of ['KeyG','KeyB','KeyD'])press(h,code);assert.deepEqual(h.calls,[['shopKeys'],['shopKeys'],['shopKeys']]);assert.equal(h.keys.size,0);
}));
test('skill information handles close/focus keys and allows native Enter/Space without passing movement through',()=>withBrowser(env=>{
  const h=keyFixture(env);h.view.skillInfoOpen=true;let focus=0;env.document.getElementById('closeSkillInfo').focus=()=>focus++;assert.equal(press(h,'KeyI').prevented,1);assert.equal(press(h,'Tab').prevented,1);assert.equal(focus,1);assert.equal(press(h,'Enter').prevented,0);assert.equal(press(h,'Space').prevented,0);assert.equal(press(h,'KeyD').prevented,1);assert.deepEqual(h.calls,[['closeInfo']]);assert.equal(h.keys.size,0);
}));
test('levelup information selects focused detail ID, focused upgrade, then the first available choice',()=>withBrowser(env=>{
  for(const [dataset,expected]of [[{upgradeInfo:'haste',choice:'power'},'haste'],[{choice:'speed'},'speed'],[{},'power']]){const h=keyFixture(env);h.view.mode='levelup';env.document.activeElement.dataset=dataset;assert.equal(press(h,'KeyI').prevented,1);assert.deepEqual(h.calls,[['info',expected]]);}
}));
test('build guide owns key routing while open and blocks unsupported movement shortcuts',()=>withBrowser(env=>{
  const h=keyFixture(env);h.view.buildOpen=true;assert.equal(press(h,'KeyG').prevented,1);assert.equal(press(h,'KeyW').prevented,1);assert.equal(press(h,'Tab').prevented,0);assert.deepEqual(h.calls,[['guideKeys'],['guideKeys'],['guideKeys']]);assert.equal(h.keys.size,0);
}));
test('global fusion, build, fullscreen and shop shortcuts preserve modifiers, focus guards and repeat rules',()=>withBrowser(env=>{
  for(const [code,mode,expected]of [['KeyG','playing',['fusion']],['KeyB','playing',['guide',true]],['KeyF','playing',['fullscreen']],['KeyS','paused',['shop',true]]]){const h=keyFixture(env);h.view.mode=mode;assert.equal(press(h,code).prevented,1);assert.deepEqual(h.calls,[expected]);h.calls.length=0;press(h,code,{repeat:true});assert.ok(!h.calls.some(c=>c[0]===expected[0]));}
  const text=new env.Element();text.closest=selector=>selector==='input,textarea,select'?text:null;for(const code of ['KeyB','KeyF']){const h=keyFixture(env);press(h,code,{target:text});assert.deepEqual(h.calls,[]);}const h=keyFixture(env);h.view.mode='paused';press(h,'KeyS',{target:text});assert.deepEqual(h.calls,[['menuKeys']]);
}));
test('E interaction is playing-only and pause/menu routing runs before movement collection',()=>withBrowser(env=>{
  const h=keyFixture(env);assert.equal(press(h,'KeyE').prevented,1);assert.deepEqual(h.calls,[['interact']]);h.calls.length=0;press(h,'KeyE',{repeat:true});h.view.mode='paused';press(h,'KeyE');assert.deepEqual(h.calls,[]);assert.equal(press(h,'Escape').prevented,1);assert.deepEqual(h.calls,[['pause']]);h.calls.length=0;h.view.mode='playing';press(h,'KeyD');assert.equal(h.keys.has('KeyD'),true);h.input.keyup({code:'KeyD'});assert.equal(h.keys.size,0);h.view.mode='levelup';press(h,'ArrowDown');assert.deepEqual(h.calls,[['menuKeys']]);assert.equal(h.keys.size,0);
}));
function menuFixture(env,mode='levelup'){
  const calls=[],view={mode},keys=new Set(),nodes=Array.from({length:3},(_,i)=>({disabled:false,matches:()=>true,focus(){calls.push('focus'+i);env.document.activeElement=this;},click(){calls.push('click'+i);}})),overlay=env.document.getElementById('overlay');overlay.querySelectorAll=()=>nodes;
  const menu=createMenuInput({view,platform:{$:id=>env.document.getElementById(id),keys},session:{pause:()=>{calls.push('pause');view.mode='paused';}},storage:{save:()=>calls.push('save')},screen:{setMode:m=>{calls.push(m);view.mode=m;},focusScene:()=>calls.push('focus')},growthActions:{rerollUpgrade:()=>calls.push('reroll'),toggleFusion:()=>calls.push('fusion')}});
  return {menu,calls,view,keys,nodes};
}
const event=(code,extra={})=>({code,repeat:false,ctrlKey:false,altKey:false,metaKey:false,...extra});
test('menu input preserves digit selection, arrow wrapping and native button activation',()=>withBrowser(env=>{
  const h=menuFixture(env);assert.equal(h.menu.keyboardMenu(event('Digit2')),true);assert.deepEqual(h.calls,['click1']);env.document.activeElement=h.nodes[2];assert.equal(h.menu.keyboardMenu(event('ArrowRight')),true);assert.equal(env.document.activeElement,h.nodes[0]);assert.equal(h.menu.keyboardMenu(event('ArrowLeft')),true);assert.equal(env.document.activeElement,h.nodes[2]);const count=h.calls.length;assert.equal(h.menu.keyboardMenu(event('Enter')),false);assert.equal(h.calls.length,count);env.document.activeElement={matches:()=>false};assert.equal(h.menu.keyboardMenu(event('Space')),true);assert.equal(h.calls.at(-1),'click0');
}));
test('menu input traps levelup Tab order, handles reroll/fusion/cancel and ignores repeat/modifier selection',()=>withBrowser(env=>{
  const h=menuFixture(env);env.document.activeElement=h.nodes[2];assert.equal(h.menu.keyboardMenu(event('Tab')),true);assert.equal(env.document.activeElement,h.nodes[0]);assert.equal(h.menu.keyboardMenu(event('Tab',{shiftKey:true})),true);assert.equal(env.document.activeElement,h.nodes[2]);h.menu.keyboardMenu(event('KeyR'));assert.equal(h.calls.at(-1),'reroll');h.view.mode='fusion';h.menu.keyboardMenu(event('Escape'));assert.equal(h.calls.at(-1),'fusion');h.view.mode='newconfirm';h.view.newConfirmReturn='paused';h.menu.keyboardMenu(event('Escape'));assert.equal(h.calls.at(-1),'paused');const count=h.calls.length;for(const extra of [{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true}])assert.equal(h.menu.keyboardMenu(event('Digit1',extra)),false);assert.equal(h.calls.length,count);
}));
test('privacy input pauses once, clears held keys, saves and restores timing/focus when shown again',()=>withBrowser(env=>{
  const h=menuFixture(env,'playing');h.keys.add('KeyD');h.menu.hideGame();assert.equal(h.view.panic,true);assert.equal(h.view.mode,'paused');assert.equal(h.keys.size,0);assert.equal(env.document.getElementById('privacy').hidden,false);assert.equal(env.document.getElementById('app').hidden,true);assert.equal(env.document.title,'Workspace');assert.deepEqual(h.calls,['pause','save','focus']);h.menu.hideGame();assert.equal(h.view.panic,false);assert.equal(h.view.lastFrame,1000);assert.equal(env.document.title,'FIELD SURVIVOR');assert.deepEqual(h.calls,['pause','save','focus','focus']);
}));
test('event binding excludes command routing and key priority, while menu/global input owners remain distinct',()=>{
  const root=new URL('../src/',import.meta.url),read=name=>readFileSync(new URL(name,root),'utf8'),bindings=read('app/events.js'),actions=read('app/actions.js'),input=read('input/keyboard.js');assert.doesNotMatch(bindings,/event\.code|dataset\.action|\b(?:chooseSite|chooseSignal|chooseAnomaly|chooseFinale|meetWitness|meetObjective)\b/);assert.doesNotMatch(input,/from ['"][^'"]*(?:world|combat|growth|core\/state)/);assert.doesNotMatch(actions,/addEventListener|removeEventListener|\b(?:damage|rewardGold|commitUpgrade|commitFusion)\s*\(/);assert.equal(existsSync(new URL('ui/keyboard.js',root)),false);assert.ok(existsSync(new URL('ui/menu-input.js',root)));
});
