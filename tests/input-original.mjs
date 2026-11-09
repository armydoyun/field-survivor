// Optional differential check against the original three-file source. No production instrumentation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { createActions } from '../src/app/actions.js';
import { createKeyboardInput } from '../src/input/keyboard.js';
if(!process.argv[2])throw Error('Usage: node tests/input-original.mjs /path/to/original');
const original=await readFile(resolve(process.argv[2],'game.js'),'utf8');
function body(marker){const a=original.indexOf(marker);assert.ok(a>=0,'Missing original handler');const b=original.indexOf('\n  });',a);assert.ok(b>a);return original.slice(a+marker.length,b);}
const keyBody=body("window.addEventListener('keydown', event => {"),clickBody=body("$('overlay').addEventListener('click', event => {");
class Element {constructor(kind){this.kind=kind;this.isContentEditable=kind==='editable';}closest(){return this.kind==='text'?this:null;}}
let current;
const aliases={toggleShop:['shop','toggleShop'],keyboardShop:['shop','keyboardShop'],closeUpgradeInfo:['buildGuide','closeUpgradeInfo'],openUpgradeInfo:['buildGuide','openUpgradeInfo'],toggleBuildGuide:['buildGuide','toggleBuildGuide'],keyboardBuildGuide:['buildGuide','keyboardBuildGuide'],hideGame:['menuInput','hideGame'],keyboardMenu:['menuInput','keyboardMenu'],save:['storage','save'],toggleFusion:['growthActions','toggleFusion'],chooseFusion:['growthActions','chooseFusion'],chooseUpgrade:['growthActions','chooseUpgrade'],chooseBranch:['growthActions','chooseBranch'],rerollUpgrade:['growthActions','rerollUpgrade'],toggleFullscreen:['display','toggleFullscreen'],pause:['session','pause'],startFresh:['session','startFresh'],resume:['session','resume'],resetAllRecords:['session','resetAllRecords'],setMode:['screen','setMode'],meetSite:['sites','meetSite'],chooseSite:['sites','chooseSite'],chooseRelic:['sites','chooseRelic'],meetObjective:['objectives','meetObjective'],meetWitness:['story','meetWitness'],meetLegacy:['story','meetLegacy'],chooseSignal:['story','chooseSignal'],chooseBoss:['story','chooseBoss'],chooseWitness:['story','chooseWitness'],acknowledgeSilence:['story','acknowledgeSilence'],chooseAnomaly:['story','chooseAnomaly'],chooseLegacy:['story','chooseLegacy'],meetEcho:['encounters','meetEcho'],meetFront:['encounters','meetFront'],finishEcho:['encounters','finishEcho'],chooseKeystone:['journey','chooseKeystone'],beginFinale:['finale','beginFinale'],chooseFinale:['finale','chooseFinale']};
const globals={Element,$:id=>current.deps.platform.$(id)};
for(const [alias,[owner,name]]of Object.entries(aliases))globals[alias]=(...args)=>current.deps[owner][name](...args);
for(const key of ['mode','panic','shopOpen','skillInfoOpen','buildOpen','newConfirmReturn'])Object.defineProperty(globals,key,{get:()=>current.view[key]});
for(const [key,get]of Object.entries({run:()=>current.deps.sessionState.run,keys:()=>current.keys,document:()=>current.document}))Object.defineProperty(globals,key,{get});
const context=vm.createContext(globals);vm.runInContext('globalThis.keydown=event=>{'+keyBody+'};globalThis.overlayClick=event=>{'+clickBody+'};',context);
function fixture(spec){
  const calls=[],view={...spec.view},keys=new Set(spec.held?['KeyD']:[]),document={activeElement:{dataset:spec.focus}},record=(name,...args)=>calls.push([name,...args.map(x=>x?.code||x)]);
  function owner(group,names){return Object.fromEntries(names.map(name=>[name,(...args)=>{
    record(group+'.'+name,...args);
    if(name==='setMode')view.mode=args[0];if(name==='toggleShop')view.shopOpen=args[0];if(name==='toggleBuildGuide')view.buildOpen=args[0];if(name==='closeUpgradeInfo')view.skillInfoOpen=false;
    if(name==='pause')view.mode=view.mode==='playing'?'paused':view.mode==='paused'?'playing':view.mode;if(name==='hideGame')view.panic=!view.panic;
    if(name==='meetWitness'&&spec.winner==='witness')view.mode='encounter';
    return name==='keyboardMenu'||name==='keyboardBuildGuide'||name==='keyboardShop'?spec.consume:name==='meetSite'?spec.winner==='site':name==='meetObjective'?spec.winner==='objective':name==='meetEcho'?spec.winner==='echo':name==='meetFront'?spec.winner==='front':undefined;
  }]))}
  const deps={view,platform:{$:id=>({focus:()=>record('focus',id)}),keys},sessionState:{run:{choices:spec.choices}},shop:owner('shop',['toggleShop','keyboardShop']),buildGuide:owner('guide',['toggleBuildGuide','closeUpgradeInfo','openUpgradeInfo','keyboardBuildGuide']),menuInput:owner('menu',['hideGame','keyboardMenu']),storage:owner('storage',['save']),growthActions:owner('growth',['toggleFusion','chooseFusion','chooseUpgrade','chooseBranch','rerollUpgrade']),display:owner('display',['toggleFullscreen']),session:owner('session',['pause','startFresh','resume','resetAllRecords']),screen:owner('ui',['setMode']),sites:owner('sites',['meetSite','chooseSite','chooseRelic']),objectives:owner('objectives',['meetObjective']),story:owner('story',['meetWitness','meetLegacy','chooseSignal','chooseBoss','chooseWitness','acknowledgeSilence','chooseAnomaly','chooseLegacy']),encounters:owner('encounters',['meetEcho','meetFront','finishEcho']),journey:owner('journey',['chooseKeystone']),finale:owner('finale',['beginFinale','chooseFinale'])};
  return {calls,view,keys,document,deps};
}
const modes=['playing','paused','menu','levelup','fusion','newconfirm','resetconfirm','ending','gameover','signal','bosschoice','site','relic','echo','legacy','finalchoice','finalintro','ledger'];
const codes=['F9','KeyS','KeyG','KeyB','KeyF','KeyE','KeyP','Escape','KeyI','KeyW','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Digit1','Digit3','Numpad2','Enter','Space','Tab','KeyR','KeyZ'];
let seed=271828;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;},pick=list=>list[(random()>>>8)%list.length];
function spec(){const flags=random()>>>12;return {view:{mode:pick(modes),panic:!!(flags&1),shopOpen:!!(flags&2),skillInfoOpen:!!(flags&4),buildOpen:!!(flags&8),newConfirmReturn:'paused'},held:!!(flags&16),consume:!!(flags&32),winner:pick(['site','objective','witness','echo','front','none']),choices:flags&64?['power']:[],focus:flags&128?{upgradeInfo:'haste'}:flags&256?{choice:'speed'}:{}};}
function take(h,event){return JSON.stringify({calls:h.calls,view:h.view,keys:[...h.keys],prevented:event.prevented});}
globalThis.Element=Element;
let observedCommands=0,observedMovement=0;
for(let i=0;i<20000;i++){
  const s=spec(),flags=random()>>>12,data={code:pick(codes),repeat:!!(flags&1),ctrlKey:!!(flags&2),metaKey:!!(flags&4),altKey:!!(flags&8),isComposing:!!(flags&16),target:new Element(pick(['plain','text','editable']))};
  const event=()=>({...data,prevented:0,preventDefault(){this.prevented++;}}),before=fixture(s),after=fixture(s),a=event(),b=event();current=before;context.keydown(a);globalThis.document=after.document;const actions=createActions(after.deps);createKeyboardInput({...after.deps,actions}).keydown(b);assert.equal(take(after,b),take(before,a),'keyboard case '+i+' '+JSON.stringify(data));observedCommands+=before.calls.length;if(before.keys.has(data.code)&&(!s.held||data.code!=='KeyD'))observedMovement++;
}
assert.ok(observedCommands>1000&&observedMovement>0,'Input sample must exercise callbacks and movement');
const actionIds=['fusion-close','fusion-guide','fusion-worldline','new','new-cancel','new-confirm','resume','reroll','hear','burn','boss-spare','boss-end','witness-hear','witness-take','silence','anomaly-ward','site-take','relic-mirror','echo-use','branch-tracking','keystone-control','final-enter','final-release','reset-open','reset-cancel','reset-confirm','legacy-silent','ledger-open','ledger-back','menu','unknown','toString'];
for(const mode of modes)for(const id of actionIds){const s=spec();s.view.mode=mode;const before=fixture(s),after=fixture(s),event={target:{closest:selector=>selector==='[data-action]'?{dataset:{action:id}}:null}};current=before;context.overlayClick(event);createActions(after.deps).overlayClick(event);assert.equal(take(after,{}),take(before,{}),'action '+mode+':'+id);}
console.log('PASS: 20,000 sampled keyboard combinations and '+modes.length*actionIds.length+' overlay action cases match original callback order, arguments, mode/flags, movement keys and default prevention. Mock contracts only; not native browser events.');
