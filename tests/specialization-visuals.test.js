import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, makeJourney } from '../src/core/run.js';
import { initialProfile } from '../src/core/profile.js';
import { createStatistics } from '../src/core/statistics.js';
import { makeRandomState } from '../src/core/random.js';
import { createSpecializations } from '../src/combat/specializations.js';
import { specTiming, novaEdgeWidth } from '../src/combat/weapon-parameters.js';
import { createWeaponView } from '../src/render/weapons.js';
import { createFeedback } from '../src/render/feedback.js';
import { createSpecField } from '../src/combat/attack-state.js';
import { branches } from '../src/data/specializations.js';
import { encodeSave } from '../src/save/format.js';
import { restoreRun } from '../src/save/restore-run.js';

function fixture(id,branch,{reduced=false,detail=true}={}){
  const profile=initialProfile(),run=createRun(profile,{maxHp:100,xpNext:28,journey:makeJourney([{slot:0,at:450,kind:'witness'},{slot:1,at:840,kind:'relay'},{slot:2,at:1200,kind:'guardian'},{slot:3,at:1590,kind:'hunt'}])}),sessionState={profile,run},calls=[],draws=[],renderState={opacity:1},view={mode:'playing'};
  run.rng=makeRandomState(42);run.up[id]=4;run.branches[id]=branch;
  run.enemies=[{id:1,kind:0,x:run.player.x+70,y:run.player.y,hp:1e8,maxHp:1e8,radius:11}];
  const ctx=new Proxy({},{get:(_,name)=>(...args)=>draws.push([name,...args]),set:(_,name,value)=>{draws.push(['set',name,value]);return true;}}),platform={ctx};
  const primitives=Object.fromEntries(['skillLine','skillCircle','skillArrow','skillCraft','skillBrackets','skillFlow','skillDisk','skillEmitter','drawShape'].map(name=>[name,(...args)=>calls.push([name,...args])]));
  primitives.skillColor=()=> '#aaddff';primitives.visualDetail=()=>detail;
  const statistics=createStatistics({sessionState}),cameraView={reducedMotion:()=>reduced},weaponView={},feedback=createFeedback({sessionState,platform,primitives,weaponView,cameraView}),hits=[];
  const combat={damage:(...args)=>hits.push(args)},specializations=createSpecializations({sessionState,view,statistics,feedback,combat});
  Object.assign(weaponView,createWeaponView({sessionState,renderState,platform,primitives,statistics,cameraView,feedback}));
  const tick=(dt=1/60)=>{run.time+=dt;feedback.tickSkillEchoes(dt);specializations.specializationTick(dt,statistics.stats());};
  const until=predicate=>{for(let i=0;i<1500;i++){tick();if(predicate())return;}assert.fail('phase not reached '+id+':'+branch);};
  const draw=()=>{calls.length=0;draws.length=0;const before=JSON.stringify(sessionState.run);weaponView.drawSpecializations();assert.equal(JSON.stringify(sessionState.run),before);assert.equal(renderState.opacity,1);return calls;};
  return {sessionState,run,profile,view,calls,draws,renderState,statistics,feedback,weaponView,hits,tick,until,draw};
}
const field=h=>h.run.arsenal.fields[0];
const activeLines=h=>h.calls.filter(c=>c[0]==='skillLine'&&c[7]===true);

test('shared phase durations retain combat values and are immutable',()=>{
  assert.ok(Object.isFrozen(specTiming));assert.equal(novaEdgeWidth,7);
  for(const [key,value]of Object.entries({novaExpand:.45,novaHold:.65,novaReturn:.5,chainHop:.065,chainTurn:.12,chainLoop:1.25,lanceStay:1.35,lancePulse:.45,mineArm:.35,mineJump:.48,minePressure:2.5,riftAim:.18,riftFold:.36,riftOpen:.2,riftGlow:.16,pulseBurst:.09,pulseAim:.14,pulseRelease:.045,orbitOut:.48,beaconAim:.42,beaconFlight:.22,beaconLife:11,beaconPack:.25,beaconDeploy:.3}))assert.equal(specTiming[key],value,key);
});
test('attack stamps are run-owned presentation state and cannot leak into saves or restored objects',()=>{
  const h=fixture('lance','stake'),f=createSpecField(h.run,'lance',{phase:'stay',x1:0,y1:0,dx:1,dy:0,count:0,pierce:5}),before=encodeSave(h.profile,h.run);
  h.feedback.markSkillAttack(f,{kind:'line',x1:0,y1:0,x2:10,y2:0,width:7});assert.equal(h.feedback.skillAttackVisual(f).at,0);assert.equal(encodeSave(h.profile,h.run),before);
  const restored=restoreRun(h.run,h.profile);assert.ok(restored);assert.equal(h.feedback.skillAttackVisual(restored.arsenal.fields[0]),undefined);h.sessionState.run=restored;assert.equal(h.feedback.skillAttackVisual(f),undefined);
});
test('NOVA draws the actual annulus and hold timer rather than filling its safe interior',()=>{
  const h=fixture('nova','boundary');h.until(()=>field(h)?.phase==='hold');h.draw();const f=field(h),arcs=h.draws.filter(c=>c[0]==='arc');assert.equal(arcs[0][3],f.length+7);assert.equal(arcs[1][3],Math.max(0,f.length-7));assert.equal(arcs[1].at(-1),true);
  const timer=h.calls.find(c=>c[0]==='skillCircle'&&c[3]===f.length+11);assert.ok(timer);assert.equal(timer.at(-1),-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,(.45+.65-f.age)/.65)));assert.equal(h.calls.some(c=>c[0]==='skillDisk'),false);
});
test('NOVA reflux keeps the same collision radius and clearly reverses its direction arrows',()=>{
  const h=fixture('nova','reflux');h.until(()=>field(h)?.phase==='return');h.draw();const f=field(h),arrows=h.calls.filter(c=>c[0]==='skillArrow');assert.equal(arrows[0][3],Math.PI);assert.equal(h.calls.find(c=>c[0]==='skillCircle')[3],f.length);
});
test('CHAIN return shows the executed reverse segment, while stored history and waiting are passive',()=>{
  const h=fixture('chain','return');h.run.enemies.push({id:2,kind:0,x:h.run.player.x+140,y:h.run.player.y,hp:1e8,radius:11});h.until(()=>field(h)?.phase==='reverse'&&h.feedback.skillAttackVisual(field(h))?.kind==='line');const f=field(h),hit=h.feedback.skillAttackVisual(f);h.draw();assert.equal(activeLines(h).length,1);assert.deepEqual(activeLines(h)[0].slice(1,5),[hit.x1,hit.y1,hit.x2,hit.y2]);assert.equal(activeLines(h)[0][8],8);
  h.run.time+=.02;h.draw();assert.equal(activeLines(h).length,0);
});
test('CHAIN circuit keeps only its closed boundary live with the real half-width',()=>{
  const h=fixture('chain','circuit');h.until(()=>field(h)?.phase==='loop');h.tick();h.draw();const f=field(h),lines=activeLines(h);assert.equal(lines.length,f.points.length);assert.ok(lines.every(c=>c[8]===5));assert.equal(h.calls.some(c=>c[0]==='skillDisk'),false);
});
test('LANCE stake opens a full-path damage band only on the actual periodic pulse',()=>{
  const h=fixture('lance','stake');h.until(()=>field(h)?.phase==='stay');h.tick();const f=field(h),hit=h.feedback.skillAttackVisual(f);h.draw();assert.deepEqual([hit.x1,hit.y1],[f.x1,f.y1]);assert.equal(activeLines(h).length,1);assert.equal(activeLines(h)[0][8],h.statistics.lanceRadius(h.statistics.stats()));
  h.tick(.1);h.draw();assert.equal(activeLines(h).length,0);assert.ok(h.calls.some(c=>c[0]==='skillLine'&&c[7]===false));
});
test('LANCE return carries its actual swept contact geometry and retains an active returning body',()=>{
  const h=fixture('lance','return');h.until(()=>field(h)?.phase==='back');h.tick();const f=field(h),hit=h.feedback.skillAttackVisual(f);h.draw();assert.equal(hit.kind,'line');assert.equal(activeLines(h)[0][3],f.x);assert.equal(h.calls.find(c=>c[0]==='skillCraft')[6],true);
});
test('pressure mine remains a sensor until explosion and its warning never becomes a live damage disk',()=>{
  const h=fixture('mine','pressure');h.run.enemies[0].x=h.run.player.x+10;h.until(()=>field(h)?.phase==='pressed');h.draw();assert.equal(h.hits.length,0);assert.ok(h.calls.some(c=>c[0]==='skillCircle'&&c[3]===14&&c[5]===false));assert.ok(h.calls.some(c=>c[0]==='skillCircle'&&c[3]===h.statistics.mineRadius(h.statistics.stats())&&c[5]===false));
});
test('airborne mine hides the ground sensor and keeps its destination passive in both motion modes',()=>{
  for(const reduced of [false,true]){const h=fixture('mine','leap',{reduced});h.until(()=>field(h)?.phase==='jump');h.tick(.1);h.draw();const f=field(h);assert.equal(h.hits.length,0);assert.equal(h.calls.some(c=>c[0]==='skillCircle'&&c[1]===f.x&&c[2]===f.y&&c[3]===14),false);assert.ok(h.calls.some(c=>c[0]==='skillCircle'&&c[1]===f.tx&&c[2]===f.ty&&c[5]===false));assert.equal(activeLines(h).length,0);}
});
test('fold RIFT preparation does not fill a damage region; folding paints only its real swept strips',()=>{
  const h=fixture('rift','fold');h.tick();h.draw();assert.equal(h.draws.some(c=>c[0]==='fillRect'),false);assert.equal(activeLines(h).length,0);
  h.until(()=>field(h)?.phase==='fold');h.draw();const f=field(h),stamp=h.feedback.skillAttackVisual(f),fills=h.draws.filter(c=>c[0]==='fillRect');assert.equal(fills.length,2);assert.ok(fills.every(c=>c[3]===f.length&&c[4]===stamp.outer-stamp.inner+10));
});
test('tracking RIFT marks only the cut frame active and its afterglow stays passive',()=>{
  const h=fixture('rift','trail');h.until(()=>field(h)?.phase==='open');h.draw();assert.equal(activeLines(h).length,1);assert.equal(activeLines(h)[0][8],field(h).width);h.tick(.02);h.draw();assert.equal(field(h).phase,'open');assert.equal(activeLines(h).length,0);assert.ok(h.draws.some(c=>c[0]==='setLineDash'&&c[1].length===2));
});
test('escort ORBIT return is harmless and its return guide points at the actual moving orbit slot',()=>{
  const h=fixture('orbit','escort');h.until(()=>h.run.arsenal.states.orbit?.units.some(u=>u.phase==='back'));h.tick();h.draw();const q=h.run.arsenal.states.orbit,u=q.units.find(u=>u.phase==='back');assert.ok(u);const guide=h.calls.find(c=>c[0]==='skillLine'&&c[1]===u.x&&c[2]===u.y&&c[7]===false),s=h.statistics.stats();assert.ok(guide);assert.equal(guide[3],h.run.player.x+Math.cos(u.orbitPhase)*s.orbitRadius);assert.equal(guide[4],h.run.player.y+Math.sin(u.orbitPhase)*s.orbitRadius);
});
test('eccentric ORBIT shows contact strokes only for outer attacking satellites',()=>{
  const h=fixture('orbit','eccentric');h.tick();h.draw();const q=h.run.arsenal.states.orbit;for(const u of q.units){const stamp=h.feedback.skillAttackVisual(u);assert.equal(!!stamp,!u.guard);}assert.ok(h.calls.some(c=>c[0]==='skillCraft'&&c[6]===true));
});
test('relay BEACON follows the live target while preparing, then locks the committed aim and barrel',()=>{
  const h=fixture('beacon','relay');h.until(()=>h.run.arsenal.states.beacon?.phase==='prepare');const q=h.run.arsenal.states.beacon,target=h.run.enemies[0];target.x+=35;target.y+=10;h.draw();assert.ok(h.calls.some(c=>c[0]==='skillCircle'&&c[1]===target.x&&c[2]===target.y&&c[3]===55));
  h.until(()=>q.phase==='flight');const x=q.tx,y=q.ty;target.x+=90;h.draw();assert.ok(h.calls.some(c=>c[0]==='skillCircle'&&c[1]===x&&c[2]===y&&c[3]===55));const u=q.units[q.index||0],emitter=h.calls.filter(c=>c[0]==='skillEmitter')[q.index||0];assert.equal(emitter[3],Math.atan2(y-u.y,x-u.x));assert.equal(activeLines(h).length,0);
});
test('rover BEACON travel and deployment have passive guides and an inactive emitter',()=>{
  const h=fixture('beacon','rover');h.until(()=>h.run.arsenal.states.beacon?.units.some(u=>u.phase==='move'));h.draw();const q=h.run.arsenal.states.beacon,i=q.units.findIndex(u=>u.phase==='move');assert.equal(h.calls.filter(c=>c[0]==='skillEmitter')[i][5],false);assert.equal(activeLines(h).length,0);
  h.until(()=>q.units.some(u=>u.phase==='deploy'));h.draw();assert.ok(h.calls.some(c=>c[0]==='skillCircle'&&c[3]===15&&c[5]===false));
});
test('tracking PULSE emits its muzzle cue on real shots and not on an aim/wait state',()=>{
  const h=fixture('pulse','tracking');h.tick();const q=h.run.arsenal.states.pulse;assert.equal(h.feedback.skillAttackVisual(q),undefined);h.tick();assert.equal(h.feedback.skillAttackVisual(q).kind,'muzzle');h.draw();assert.ok(h.calls.some(c=>c[0]==='skillArrow'));q.phase='aim';q.clock=.1;h.run.time+=.2;h.draw();assert.equal(h.calls.some(c=>c[0]==='skillArrow'),false);
});
test('reservoir PULSE shows remaining volleys during release and keeps the final-shot cue after charge resets',()=>{
  const h=fixture('pulse','reservoir');h.until(()=>h.run.arsenal.states.pulse?.phase==='release'&&h.run.arsenal.states.pulse.left===2);h.draw();assert.equal(h.calls.filter(c=>c[0]==='skillCircle'&&c[3]===4&&c[5]===true).length,2);
  h.until(()=>h.run.arsenal.states.pulse?.phase==='charge'&&h.feedback.skillAttackVisual(h.run.arsenal.states.pulse)?.at===h.run.time);h.draw();assert.ok(h.calls.some(c=>c[0]==='skillArrow'));assert.equal(h.calls.filter(c=>c[0]==='skillCircle'&&c[3]===4&&c[5]===true).length,0);
});
test('retired specialization fields and RIFT afterimages are explicitly passive',()=>{
  const h=fixture('rift','trail'),f={type:'rift',phase:'open',x:0,y:0,points:[{x:0,y:0},{x:100,y:0}]};h.feedback.retireSkillField(f);h.feedback.drawSkillEchoes();assert.ok(h.draws.some(c=>c[0]==='setLineDash'&&c[1].join(',')==='3,6'));
  let args;h.weaponView.drawRiftScar=(...a)=>{args=a;};h.feedback.addSkillEcho('riftCut',{x:0,y:0,x2:100,y2:0,width:10,color:'#fff'});h.feedback.drawSkillEchoes();assert.equal(args[8],false);
});

// Every specialization is exercised in normal, reduced-motion and low-detail presentation.
for(const b of branches)for(const option of b.options)test('phase/restore presentation: '+b.id+':'+option.id,()=>{
  for(const mode of [{},{reduced:true,detail:false},{detail:false}]){
    const h=fixture(b.id,option.id,mode);let checkpoint=null;
    for(let i=0;i<120;i++){h.tick();if(i%6===0)h.draw();if(i===30)checkpoint=restoreRun(h.run,h.profile);}
    assert.ok(checkpoint);h.sessionState.run=checkpoint;const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const value of Object.values(x))freeze(value);}return x;};freeze(checkpoint);h.draw();assert.equal(h.renderState.opacity,1);
  }
});


test('circuit phase entry does not advertise a damaging boundary before its first actual loop test',()=>{
  const h=fixture('chain','circuit');h.until(()=>field(h)?.phase==='loop');h.draw();assert.equal(activeLines(h).filter(c=>c[8]===5).length,0);h.tick();h.draw();assert.ok(activeLines(h).some(c=>c[8]===5));
});
