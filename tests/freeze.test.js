import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { initialProfile, hasRecords } from '../src/core/profile.js';
import { createRun, makeJourney } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { createDifficulty } from '../src/core/difficulty.js';
import { createBuildModel } from '../src/ui/build-model.js';
import { createGrowthMetrics } from '../src/ui/growth-metrics.js';
import { createHudModel } from '../src/ui/hud-model.js';
import { createHud } from '../src/ui/hud.js';
import { createModalContent } from '../src/ui/modal-content.js';
import { createModals } from '../src/ui/modals.js';
import { createScreen } from '../src/ui/screen.js';
import { createScene } from '../src/render/scene.js';
import { escapeHtml, number, percent, decision } from '../src/ui/html.js';
import { makeFusionState, resetFusionCycle, createSpecField, recordAttackHit } from '../src/combat/attack-state.js';
import * as parameters from '../src/combat/weapon-parameters.js';
import { branches } from '../src/data/specializations.js';
import { xpNeed } from '../src/growth/experience.js';

const root=new URL('../src/',import.meta.url),source=file=>readFileSync(new URL(file,root),'utf8');
function fixture(){const profile=initialProfile(),run=createRun(profile,{maxHp:100,xpNext:xpNeed(1),journey:makeJourney([{slot:0,at:450,kind:'witness'},{slot:1,at:840,kind:'relay'},{slot:2,at:1200,kind:'guardian'},{slot:3,at:1590,kind:'hunt'}])}),sessionState={profile,run},view={mode:'playing'},statistics=createStatistics({sessionState}),difficulty=createDifficulty({sessionState,statistics}),buildModel=createBuildModel({sessionState}),growthMetrics=createGrowthMetrics({sessionState,statistics,buildModel});return {sessionState,view,statistics,difficulty,buildModel,growthMetrics};}
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;}

test('UI formatting is standalone, preserves escaping and uses numeric precision consistently',()=>{
  assert.equal(escapeHtml('<b a="x">&\'</b>'),'&lt;b a=&quot;x&quot;&gt;&amp;&#39;&lt;/b&gt;');assert.equal(number(2),'2');assert.equal(number(2.125),'2.13');assert.equal(percent(.125),'12.50%');
  const html=decision('EVENT','Title','Line',[{id:'test',name:'A & B',effect:'EXP <100'}]);assert.ok(html.includes('A &amp; B'));assert.ok(html.includes('EXP &lt;100'));assert.ok(html.includes('기본·보석 EXP'));assert.doesNotMatch(source('ui/html.js'),/\b(?:window|document|screen|sessionState|platform)\b/);
});
test('record existence is a profile/run predicate independent of any UI instance',()=>{
  const profile=initialProfile();assert.equal(hasRecords(profile,null),false);assert.equal(hasRecords(profile,{}),true);profile.memory.witness.quiet=true;assert.equal(hasRecords(profile,null),true);
});
test('screen transition closes auxiliary screens before rendering, HUD refresh and scene focus',()=>{
  const calls=[],view={mode:'paused',shopOpen:true,skillInfoOpen:true,buildOpen:true},nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{focus:()=>calls.push('focus:'+id),querySelector:()=>node('button')});return nodes.get(id);};
  const screen=createScreen({view,platform:{$:node,canvas:node('canvas')},shop:{toggleShop:()=>{calls.push('shop-close');view.shopOpen=false;},buildShop:()=>calls.push('shop-render')},buildGuide:{closeUpgradeInfo:()=>{calls.push('info-close');view.skillInfoOpen=false;},toggleBuildGuide:()=>{calls.push('guide-close');view.buildOpen=false;}},modals:{renderModal:()=>{assert.equal(view.mode,'playing');calls.push('modal');}},hud:{updateHud:()=>calls.push('hud')}});
  screen.setMode('playing');assert.deepEqual(calls,['shop-close','info-close','guide-close','modal','shop-render','hud','focus:canvas']);assert.equal(node('pauseButton').disabled,false);assert.equal(node('pauseButton').innerHTML,'일시정지 <kbd>ESC</kbd>');
});
test('focus policy prioritizes privacy, shop, gameplay canvas and the modal button',()=>{
  const calls=[],view={mode:'playing'},node=id=>({focus:()=>calls.push(id),querySelector:()=>({focus:()=>calls.push('modal')})}),screen=createScreen({view,platform:{$:node,canvas:node('canvas')}});view.panic=true;screen.focusScene();view.panic=false;view.shopOpen=true;screen.focusScene();view.shopOpen=false;screen.focusScene();view.mode='paused';screen.focusScene();assert.deepEqual(calls,['privacy','closeShop','canvas','modal']);
});
test('HUD model reads frozen state without DOM, RNG, input mutation or implicit cache mutation',()=>{
  const h=fixture();h.sessionState.run.legacyOrigin='preserve';h.sessionState.run.legacyChoice='seal';h.sessionState.run.journey.active={kind:'relay',slot:0,until:90,charge:1};freeze(h.sessionState.profile);freeze(h.sessionState.run);freeze(h.view);const model=createHudModel(h),before=JSON.stringify(h.sessionState),random=Math.random;Math.random=()=>{throw Error('HUD must not consume RNG');};
  try{const previous=freeze({}),first=model.readHud(previous);assert.equal(first.text.hudLevel,'01');assert.ok(first.text.frontStatus.includes('지난 결말'));assert.ok(first.text.journeyStatus.includes('움직이는 중계'));assert.ok(first.html.weaponList.includes('펄스 코어'));assert.deepEqual(previous,{});const second=model.readHud(freeze({...first.keys}));assert.equal(second.html.weaponList,undefined);assert.equal(second.html.relicList,undefined);assert.equal(JSON.stringify(h.sessionState),before);}finally{Math.random=random;}
});
test('HUD adapter owns DOM writes and avoids repeating unchanged cached HTML',()=>{
  const nodes=new Map();let writes=0,reads=0;const $=id=>{if(!nodes.has(id))nodes.set(id,{style:{},dataset:{},set innerHTML(value){writes++;this.html=value;},setAttribute(k,v){this[k]=v;}});return nodes.get(id);};
  const hud=createHud({platform:{$},model:{readHud:keys=>{reads++;if(reads>1)assert.equal(keys.weaponList,'v1');return {text:{hudLevel:'02'},html:{weaponList:'same'},width:{hpFill:'50%'},hidden:{endingMemory:true},keys:{weaponList:'v1'},fusionDisabled:false,fusionExpanded:'false'};}}});hud.updateHud();hud.updateHud();assert.equal(writes,1);assert.equal($('hudLevel').textContent,'02');assert.equal($('hpFill').style.width,'50%');assert.equal($('endingMemory').hidden,true);assert.equal($('openFusion')['aria-expanded'],'false');
});
test('modal content builds supported screen HTML without DOM or state mutation',()=>{
  const h=fixture(),r=h.sessionState.run;r.legacyOrigin='preserve';r.echoSeed.witness='none';r.up.pulse=3;r.pending=1;r.choices=['power'];const content=createModalContent({...h,keystoneOptions:()=>[],rewardXp:h.difficulty.rewardXp,fusionHtml:()=>'<div>fusion</div>',canRelease:()=>true});
  for(const mode of ['menu','keystone','ledger','newconfirm','resetconfirm','paused','bosschoice','encounter','secret','signal','anomaly','site','legacy','echo','relic','fusion','branch','levelup','finalintro','finalchoice','ending','gameover']){h.view.mode=mode;const before=JSON.stringify(h.sessionState),html=content.buildModal();assert.equal(typeof html,'string',mode);assert.ok(html.length>0);assert.equal(JSON.stringify(h.sessionState),before,mode);}
});
test('modal adapter respects playing visibility and branch-content null without replacing prior HTML',()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document'),overlay={innerHTML:'previous',querySelectorAll:()=>[]},view={mode:'playing'};Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelector:()=>({classList:{toggle(){}}})}});
  try{let reads=0;const modals=createModals({view,platform:{$:()=>overlay},content:{buildModal:()=>{reads++;return null;}}});modals.renderModal();assert.equal(overlay.hidden,true);assert.equal(reads,0);view.mode='branch';modals.renderModal();assert.equal(overlay.hidden,false);assert.equal(overlay.innerHTML,'previous');}finally{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;}
});
test('specialization display model distinguishes missing, pending, selected and blocked paths',()=>{
  const h=fixture(),b=branches.find(b=>b.id==='orbit'),[a,other]=b.options,r=h.sessionState.run;assert.equal(h.buildModel.specializationGuide(b,a).state,'missing');r.up.orbit=2;assert.equal(h.buildModel.specializationGuide(b,a).state,'pending');r.up.orbit=3;assert.equal(h.buildModel.specializationGuide(b,a).state,'ready');r.branches.orbit=a.id;assert.equal(h.buildModel.specializationGuide(b,a).state,'active');assert.equal(h.buildModel.specializationGuide(b,other).state,'blocked');
});
test('attack state factories isolate all arrays; cycle reset keeps exactly the existing reset contract',()=>{
  const a=makeFusionState('one'),b=makeFusionState('two');for(const key of ['hits','lines','units','points','cells','order','occupants','path'])assert.notEqual(a[key],b[key]);a.hits.push({id:1});a.points.push({x:1});a.lines.push({});a.units.push({});resetFusionCycle(a,2);assert.equal(a.phase,'wait');assert.equal(a.clock,2);assert.deepEqual(a.lines,[]);assert.deepEqual(a.units,[]);assert.equal(a.hits.length,1);assert.equal(a.points.length,1);assert.equal(b.hits.length,0);
});
test('specialization field creation respects the cap, default ownership and supplied timing',()=>{
  const h=fixture(),r=h.sessionState.run,f=createSpecField(r,'nova',{life:1.6,phase:'expand',radius:100});assert.equal(f.owner,'nova');assert.equal(f.type,'nova');assert.equal(f.life,1.6);assert.equal(f.x,r.player.x);while(r.arsenal.fields.length<40)createSpecField(r,'rift',{});const before=JSON.stringify(r.arsenal.fields);assert.equal(createSpecField(r,'mine',{}),null);assert.equal(JSON.stringify(r.arsenal.fields),before);
});
test('attack hit windows enforce exact gap, count limit, independent tags and fusion capacity',()=>{
  const hits=[];assert.equal(recordAttackHit(hits,1,10,.4,3,'sweep',2),true);assert.equal(recordAttackHit(hits,1,10.3,.4,3,'sweep',2),false);assert.equal(recordAttackHit(hits,1,10.5,.4,3,'sweep',2),true);assert.equal(recordAttackHit(hits,1,11,.4,3,'sweep',2),true);assert.equal(recordAttackHit(hits,1,12,.4,3,'sweep',2),false);assert.equal(recordAttackHit(hits,1,12,0,1,'collapse',2),true);assert.equal(recordAttackHit(hits,2,12,0,1,'sweep',2),false);assert.deepEqual(Object.keys(hits[0]),['id','tag','at','count']);const spec=[];recordAttackHit(spec,2,10);assert.deepEqual(Object.keys(spec[0]),['id','at','count']);
});
test('statistics exposes the same shared timing/dimension function identities used by execution and UI',()=>{
  const h=fixture();for(const name of ['novaRadius','mineRadius','chainTargets','lanceTargets','orbitReload','chainReload','riftLength','mineInterval','lanceInterval','novaPush','riftInterval','beaconShotInterval','chainReach','beaconRange','beaconInterval','lanceRadius','orbitPush'])assert.equal(h.statistics[name],parameters[name],name);
  const s={chain:5,conduction:4,beacon:5,machinery:4,placement:3,wavecraft:4,repulsion:3,rift:5};assert.equal(parameters.chainReach(s),247);assert.equal(parameters.beaconRange(s),465);assert.equal(parameters.orbitPush(s),30);assert.equal(parameters.lanceRadius(s),11.4);assert.equal(parameters.beaconInterval(s),5.25);assert.equal(parameters.riftInterval(s),2.3000000000000003);
});
test('scene owns frame setup and draw ordering while entity renderers receive stable frame inputs',()=>{
  const h=fixture(),calls=[],ctx=new Proxy({},{get:()=>()=>{},set:()=>true}),methods=names=>Object.fromEntries(names.map(n=>[n,(...args)=>calls.push([n,...args])])),scene=createScene({sessionState:h.sessionState,platform:{ctx},cameraView:{camera:{owner:h.sessionState.run,x:10,y:20}},statistics:{stats:()=>({tag:'s'})},primitives:{visualDetail:()=>true},worldView:methods(['drawJourney','drawMarkers','drawCollectibles']),weaponView:methods(['drawAuxiliaryFields','drawBaseDevices','drawPlayerShots','drawCombatWaves','drawCombatArcs','drawSpecializations','drawEnemyBullets']),feedback:methods(['drawSkillEchoes','drawFeedback']),fusionView:methods(['drawFusions']),enemyView:methods(['drawHostileMarks','drawEnemyTelegraphs','drawEnemies']),playerView:methods(['drawOrbitAndMotion','drawStatus']),navigation:methods(['drawNavigation'])});scene.draw();assert.deepEqual(calls.map(x=>x[0]),['drawJourney','drawMarkers','drawAuxiliaryFields','drawBaseDevices','drawCollectibles','drawSkillEchoes','drawPlayerShots','drawCombatWaves','drawCombatArcs','drawSpecializations','drawFusions','drawHostileMarks','drawEnemyTelegraphs','drawEnemyBullets','drawEnemies','drawOrbitAndMotion','drawStatus','drawFeedback','drawNavigation']);assert.deepEqual(calls.find(x=>x[0]==='drawEnemies').slice(1),[true,10,20]);
});
test('frozen architecture separates helpers, view models, adapters, attack state and scene composition',()=>{
  assert.equal(existsSync(new URL('ui/common.js',root)),false);
  for(const name of ['ui/html.js','ui/build-model.js','ui/hud-model.js','ui/modal-content.js','combat/attack-state.js','combat/weapon-parameters.js'])assert.doesNotMatch(source(name),/\b(?:document|window|localStorage|platform|screen)\b/,name);
  for(const name of ['ui/growth-metrics.js','ui/build-guide.js'])assert.doesNotMatch(source(name),/from ['"]\.\/screen\.js|\bscreen\./,name);
  assert.ok(source('render/scene.js').length<3500);assert.ok(source('ui/hud.js').length<2000);assert.ok(source('ui/modals.js').length<1500);assert.doesNotMatch(source('render/scene.js'),/for \(const e of|for \(const fx of|function drawGem/);
  assert.match(source('growth/commands.js'),/makeFusionRuntime\(id\)/);assert.match(source('combat/specializations.js'),/recordAttackHit/);
});
