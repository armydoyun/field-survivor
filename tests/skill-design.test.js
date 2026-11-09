import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSkillDesign, fusionStyle, skillStyle, skillDetail } from '../src/render/skill-style.js';
import { createDebugGame } from '../src/debug/create-debug-game.js';
import { visualGameplaySample } from './visual-fixture.js';
import { fusionRecipes } from '../src/data/fusions.js';
import { createFusionView } from '../src/render/fusions.js';
import { createFeedback } from '../src/render/feedback.js';
const baseline=JSON.parse(readFileSync(new URL('visual-gameplay-baseline.json',import.meta.url),'utf8'));
for(const [id,hash]of Object.entries(baseline.hashes))test('visual changes preserve complete seeded gameplay: '+id,()=>assert.equal(visualGameplaySample(createDebugGame,id),hash));
function context(){
 let state={globalAlpha:1,globalCompositeOperation:'source-over',lineWidth:1},stack=[],calls=[];
 const ctx=new Proxy({save(){stack.push({...state});},restore(){state=stack.pop();},setLineDash(...args){calls.push(['setLineDash',...args]);}},{get:(target,key)=>key in target?target[key]:key in state?state[key]:(...args)=>{assert.ok(args.filter(v=>typeof v==='number').every(Number.isFinite),key+' finite');calls.push([key,...args]);},set:(target,key,value)=>{if(key==='globalAlpha')assert.ok(Number.isFinite(value)&&value>=0&&value<=1,'bounded opacity');state[key]=value;calls.push(['set',key,value]);return true;}});
 return {ctx,calls,read:()=>({...state}),depth:()=>stack.length};
}
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const item of Object.values(value))freeze(item);}return value;};
test('all original and higher motifs have an explicit shared palette, with bounded interior opacity',()=>{
 for(const f of fusionRecipes)assert.ok(fusionStyle[f.code]?.every(v=>typeof v==='string'));assert.ok(skillStyle.fill<=.05);assert.ok(skillStyle.band<=.08);
 for(const r of [{enemies:[],shots:[],fusionStates:{}},{enemies:Array(120),shots:[],fusionStates:{}},{enemies:[],shots:[],fusionStates:{f:{effects:Array(150)}}}])assert.equal(skillDetail(r),!r.enemies.length&&!Object.keys(r.fusionStates).length);
 assert.equal(skillDetail({enemies:[],shots:[],fusionStates:{}},true),false);
});
test('every shared primitive restores Canvas state and never uses expensive full-screen glow',()=>{
 const h=context(),d=createSkillDesign(h.ctx),before=h.read(),run=detail=>{
 d.bolt(10,20,1,5,'#abc',{detail});d.lightning(1,2,120,80,'#abc',{detail});d.slash(1,2,1,80,35,'#abc',{detail});d.area(1,2,100,'#abc',{detail,zone:true});d.annulus(1,2,100,30,'#abc',{detail,back:true});d.front(1,2,1,300,80,'#abc',{detail});d.rail(1,2,50,80,40,'#abc',{detail});d.mine(1,2,'#abc',{detail,chain:true});
 };
 run(true);assert.deepEqual(h.read(),before);assert.equal(h.depth(),0);const normal=h.calls.length;h.calls.length=0;run(false);assert.ok(h.calls.length<normal);assert.deepEqual(h.read(),before);assert.ok(!h.calls.some(c=>['shadowBlur','filter'].includes(c[1])));
});
function fusionFixture({duplicates=1,detail=true,offscreen=false}={}){
 const f=fusionRecipes.find(f=>f.id==='fs_mobile_transmission'),h=context(),q={effects:[{type:'trail',channel:'trails',x:450,y:270,x2:540,y2:270,width:40,age:.1,life:1}],visuals:Array.from({length:duplicates},()=>({type:'line',layer:'base',x:450,y:270,x2:540,y2:270,width:40,age:.02,life:.1})),units:[]};
 const run={up:{chain:5,beacon:5,['fusion_'+f.id]:1},branches:{chain:'return',beacon:'rover'},player:{x:480,y:270},enemies:[],shots:[],fusionStates:{[f.id]:q},time:1},sessionState={run};
 const v=createFusionView({sessionState,platform:{ctx:h.ctx},statistics:{stats:()=>({damage:100,crit:.1,critMult:2})},primitives:{visualDetail:()=>detail},cameraView:{camera:{x:offscreen?1e5:480,y:270},reducedMotion:()=>false}});return {...h,sessionState,view:v};
}
test('continuous damaging trails are solid and duplicate afterimages do not stack opacity',()=>{
 const a=fusionFixture({duplicates:1}),b=fusionFixture({duplicates:80});a.view.drawFusions();b.view.drawFusions();assert.equal(b.calls.length,a.calls.length);assert.ok(!a.calls.some(c=>c[0]==='setLineDash'&&c[1].length));
});
test('fusion drawing is pure, off-screen effects are culled and quality fallback retains the damage lane',()=>{
 const h=fusionFixture(),before=JSON.stringify(h.sessionState);freeze(h.sessionState);h.view.drawFusions();assert.equal(JSON.stringify(h.sessionState),before);assert.equal(h.depth(),0);
 const reduced=fusionFixture({detail:false});reduced.view.drawFusions();assert.ok(reduced.calls.some(c=>c[0]==='lineTo'));assert.ok(reduced.calls.length<h.calls.length);
 const far=fusionFixture({offscreen:true});far.view.drawFusions();assert.equal(far.calls.length,0);
});
test('rapid hit labels aggregate display values without losing damage or leaking across runs',()=>{
 const ctx=context().ctx,r={time:1,popups:[],fx:[],waves:[]},s={run:r},e={x:50,y:60,radius:10},feedback=createFeedback({sessionState:s,platform:{ctx},primitives:{visualDetail:()=>false},weaponView:{},cameraView:{}});
 feedback.showEnemyHit(e,10.4,false);feedback.showEnemyHit(e,20.4,true);assert.equal(r.popups.length,1);assert.equal(r.popups[0].value,'31');assert.equal(r.popups[0].color,'#ffe1a0');assert.equal(r.fx.length,0);
 r.time+=.1;feedback.showEnemyHit(e,4,false);assert.equal(r.popups.length,2);s.run={...r,popups:[]};feedback.showEnemyHit(e,7,false);assert.equal(s.run.popups.length,1);assert.equal(s.run.popups[0].value,'7');
});
