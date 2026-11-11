import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialProfile, hydrateProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { createProgression } from '../src/growth/progression.js';
import { xpNeed, xpBonus } from '../src/growth/experience.js';
import { createSiteDecisions } from '../src/world/site-decisions.js';
import { createStoryDecisions } from '../src/world/story-decisions.js';
import { createEndingDecisions } from '../src/world/ending-decisions.js';
import { createSites } from '../src/world/sites.js';
import { createStory } from '../src/world/story.js';
import { createFinale } from '../src/world/finale.js';
import { createModalContent } from '../src/ui/modal-content.js';
import { sites, relics, anomalies, startEffects, startScenes, firstSignalAfterPreserve, witnessAfterRelease, deathLines, truthPieces, truthFound, truthReveal, witnessReactions } from '../src/data/world.js';
import { createSession } from '../src/core/session.js';
import { siteRewards, signalReward, witnessReward, endingReward } from '../src/data/world-choices.js';
import { endingTexts, endingScenes, stokerLines, guardianLines } from '../src/data/world.js';
import { GUARDIAN_SALVAGE, ENEMY_LIMIT, GUARDIAN_REACH, GUARDIAN_YIELD } from '../src/core/config.js';

function state(){const s={profile:initialProfile(),run:null,replaceRun:r=>{s.run=r;}};s.run=createRun(s.profile,{maxHp:100,xpNext:xpNeed(1)});return s;}
function harness(s=state()){
  const statistics=createStatistics({sessionState:s}),progression=createProgression({sessionState:s,statistics}),spawned=[];
  const enemyRuntime={spawnEnemy(kind){const e={id:spawned.length+1,kind,hp:10,maxHp:10};spawned.push(e);s.run.enemies.push(e);return e;},promoteElite:e=>{e.elite=true;}};
  return {s,statistics,progression,spawned,enemyRuntime,site:createSiteDecisions({sessionState:s,statistics,progression,enemyRuntime}),story:createStoryDecisions({sessionState:s,statistics})};
}
const snapshot=s=>structuredClone({run:s.run,profile:s.profile});
function noChange(s,action){const before=snapshot(s);assert.ok(!action());assert.deepEqual(snapshot(s),before);}
function prepareSite(s,index){s.run.siteStep=index;s.run.site={id:sites[index].id};s.run.sitePending=true;}
// 해방 경로: 감시자 분해 0 · 돌려보냄 2 · 기록원을 듣고 옆에서 멈춤 · 기억 축 0 이상(기록원 +1)
function prepareRelease(r){r.finalStep=3;r.time=1800;r.guardianFate={spare:2,end:0};r.npc.state='heard';r.npc.silenced=true;}
function prepareRoute(r,memory){r.finalStep=3;r.time=1800;const choices=[...Array(Math.abs(memory)).fill(memory>0?'hear':'burn')];r.signalChoices=choices.slice(0,3);const rest=choices.slice(3);if(rest.length){r.npc.state=memory>0?'heard':'taken';rest.shift();}for(const [i,site]of sites.entries())if(rest[i])r.siteDecisions[site.id]=memory>0?'keep':'take';}

// Each suite operates without DOM, mode, storage, rendering or the application bootstrap.
test('all six site choices retain exact rewards, HP order, enemy patterns and single commitment',()=>{
  for(let i=0;i<sites.length;i++)for(const choice of ['keep','take']){
    const h=harness(),{s}=h;prepareSite(s,i);s.run.player.hp=50;
    assert.equal(h.site.chooseSite(choice).id,sites[i].id);assert.equal(s.run.siteStep,i+1);assert.equal(s.run.sitePending,false);assert.equal(s.run.site,null);assert.equal(s.run.relicPending,sites[i].id);assert.equal(s.profile.memory.sites[sites[i].id][choice],1);
    const expected={coordinate:{keep:[100,50,0,0,0,100,[]],take:[220,50,0,0,0,240,[1,1,1,1,1,1]]},reservoir:{keep:[0,90,0,0,0,240,[]],take:[0,25,siteRewards.reservoir.take.power,0,0,0,[4,4,4,4,4]]},archive:{keep:[350,75,0,1,0,0,[]],take:[0,50,0,0,siteRewards.archive.take.haste,350,[2,5,2,5,2,5]]}}[sites[i].id][choice];
    const [gold,hp,power,vitality,haste,xp,kinds]=expected;assert.equal(s.run.gold,gold);assert.equal(s.run.player.hp,hp);assert.equal(s.run.up.power||0,power);assert.equal(s.run.up.vitality||0,vitality);assert.equal(s.run.up.haste||0,haste);
    assert.equal(s.run.xp+[...Array(s.run.level-1)].reduce((sum,_,j)=>sum+xpNeed(j+1),0),xp);
    assert.deepEqual(h.spawned.map(e=>e.kind),kinds);if(i===2&&choice==='take')assert.ok(h.spawned.every(e=>e.elite));noChange(s,()=>h.site.chooseSite(choice));
  }
});
test('site invalid IDs, stale sites, pending relics and already owned site relics reject before rewards',()=>{
  for(const mutate of [()=>{},s=>{s.run.site.id='stale';},s=>{s.run.relicPending=sites[0].id;},s=>{s.run.relics=[relics.find(r=>r.site===sites[0].id).id];}]){
    const h=harness();prepareSite(h.s,0);mutate(h.s);noChange(h.s,()=>h.site.chooseSite('invalid'));
    if(h.s.run.site.id==='stale'||h.s.run.relicPending||h.s.run.relics.length)noChange(h.s,()=>h.site.chooseSite('take'));
    assert.equal(h.spawned.length,0);
  }
  const h=harness();prepareSite(h.s,2);h.s.run.enemies=Array(ENEMY_LIMIT).fill({hp:1});assert.ok(h.site.chooseSite('take'));assert.equal(h.spawned.length,0);
});
test('each relic commits once, enforces its site, and mirror awakens exactly one satellite',()=>{
  for(const relic of relics){const h=harness(),{s}=h;s.run.relicPending=relic.site;assert.equal(h.site.chooseRelic(relic.id),true);assert.deepEqual(s.run.relics,[relic.id]);assert.equal(s.profile.memory.relics[relic.id],1);assert.equal(s.run.relicPending,null);if(relic.id==='mirror')assert.equal(s.run.up.orbit,1);noChange(s,()=>h.site.chooseRelic(relic.id));}
  const h=harness();h.s.run.relicPending=sites[0].id;const foreign=relics.find(r=>r.site!==sites[0].id);noChange(h.s,()=>h.site.chooseRelic(foreign.id));noChange(h.s,()=>h.site.chooseRelic('invalid'));
});
test('witness and silence results are independent of screens and clamp after permanent HP activation',()=>{
  for(const choice of ['hear','take']){const h=harness(),{s}=h;s.run.npc.encounterPending=true;s.run.player.hp=90;assert.equal(h.story.chooseWitness(choice),true);assert.equal(s.profile.memory.witness.met,1);assert.equal(s.run.player.hp,choice==='hear'?100:90);assert.equal(s.run.gold,choice==='take'?150:0);noChange(s,()=>h.story.chooseWitness(choice));
    if(choice==='hear'){s.run.npc.secretPending=true;assert.equal(h.story.acknowledgeSilence(),true);assert.equal(s.profile.memory.witness.quiet,true);assert.equal(s.run.player.hp,110);noChange(s,()=>h.story.acknowledgeSilence());}
  }
});
test('signal routes preserve ordered gold, HP and final exhaustion without the retired chapter memory',()=>{
  for(const route of [['hear','hear','hear'],['burn','burn','burn'],['hear','burn','burn'],['burn','hear','hear']]){
    const h=harness(),{s}=h;s.run.player.hp=50;let gold=0,heard=0;
    noChange(s,()=>h.story.chooseSignal('invalid'));
    for(const [i,choice]of route.entries()){assert.equal(h.story.chooseSignal(choice),true);if(choice==='burn')gold+=100+30*i;else heard++;}
    assert.equal(s.run.gold,gold);assert.equal(s.run.player.hp,50+heard*20);assert.equal(s.run.signalHp,heard*20);assert.deepEqual(s.run.signalChoices,route);assert.equal(s.profile.memory.chapters,undefined);noChange(s,()=>h.story.chooseSignal('hear'));
  }
});
test('every anomaly option retains duration, ward timing, HP clamp and exactly one memory increment',()=>{
  for(const [index,event]of anomalies.entries())for(const option of event.options){const h=harness(),{s}=h;s.run.time=event.at;s.run.anomalyStep=index;s.run.anomalyPending=true;s.run.player.hp=200;
    noChange(s,()=>h.story.chooseAnomaly('invalid'));assert.equal(h.story.chooseAnomaly(option.id),true);assert.equal(s.run.anomalyChoices[event.id],option.id);assert.equal(s.run.anomalyStep,index+1);assert.equal(s.profile.memory.anomalies[event.id][option.id],1);
    if(event.id!=='echo')assert.equal(s.run.anomalyUntil[event.id],event.at+(event.id==='clock'?90:120));else assert.equal(s.run.player.hp,h.statistics.stats().maxHp);
    if(event.id==='border'&&option.id==='ward')assert.equal(s.run.anomalyWardAt,event.at);noChange(s,()=>h.story.chooseAnomaly(option.id));
  }
});
test('guardian decisions: returning gives only a token, dismantling keeps double salvage, leaving counts nothing',()=>{
  for(const choice of ['spare','end']){const s=state(),e={id:1,kind:3,named:true,phase:3,hp:0,maxHp:100,x:0,y:0};s.run.enemies=[e];s.run.bossChoiceId=1;let kills=0;
    const d=createStoryDecisions({sessionState:s,combat:{killEnemy:(enemy,depth,m)=>{kills++;assert.equal(enemy,e);assert.equal(depth,0);assert.equal(m,GUARDIAN_SALVAGE);assert.equal(s.run.guardianOrder,'end');assert.equal(s.profile.memory.guardian.ended,1);}}});
    const result=d.chooseBoss(choice);assert.equal(result.spared,choice==='spare');assert.equal(s.run.bossChoiceId,0);assert.equal(s.run.guardianFate[choice],1);assert.equal(s.run.enemies.length,0);assert.equal(kills,choice==='end'?1:0);
    if(choice==='spare'){assert.equal(s.run.gold,0);assert.equal(s.run.gems.length,0);assert.equal(s.profile.memory.guardian.spared,1);}noChange(s,()=>d.chooseBoss(choice));
  }
  const s=state(),e={id:1,kind:3,named:true,phase:3,hp:0,x:0,y:0};s.run.enemies=[e];s.run.bossChoiceId=1;const d=createStoryDecisions({sessionState:s});assert.equal(d.guardianLeaves(),true);assert.deepEqual(s.run.guardianFate,{spare:0,end:0});assert.equal(s.run.enemies.length,0);assert.equal(s.run.bossChoiceId,0);noChange(s,()=>d.guardianLeaves());
  const shell=state();shell.run.enemies=[{id:1,kind:3,hollow:true,phase:3,hp:0}];shell.run.bossChoiceId=1;const x=createStoryDecisions({sessionState:shell});noChange(shell,()=>x.chooseBoss('spare'));noChange(shell,()=>x.guardianLeaves());
});
test('a yielding guardian is returned by standing still nearby, dismantled with E in reach, and leaves when time runs out',()=>{
  const setup=()=>{const h=harness(),ui=screens(h.s,'playing'),e={id:1,kind:3,named:true,phase:3,hp:0,maxHp:100,x:h.s.run.player.x+GUARDIAN_REACH-1,y:h.s.run.player.y,yieldUntil:h.s.run.time+GUARDIAN_YIELD,yieldStill:0};h.s.run.enemies=[e];h.s.run.bossChoiceId=1;
    const decisions=createStoryDecisions({sessionState:h.s,statistics:h.statistics,combat:{killEnemy(enemy){enemy.hp=0;}}}),records=[];const story=createStory({...ui,session:{record:line=>records.push(line)},decisions,feedback:{burst(){}}});return {h,ui,e,story,records};};
  let t=setup();for(let i=0;i<29;i++)t.story.tickGuardian(.1,false);assert.equal(t.h.s.run.guardianFate.spare,0);t.story.tickGuardian(.1,false);assert.equal(t.h.s.run.guardianFate.spare,1);assert.equal(t.h.s.run.enemies.length,0);assert.ok(t.records.some(x=>x.includes('무기를 내렸다')));
  t=setup();for(let i=0;i<20;i++)t.story.tickGuardian(.1,false);t.story.tickGuardian(.1,true);for(let i=0;i<20;i++)t.story.tickGuardian(.1,false);assert.equal(t.h.s.run.guardianFate.spare,0);
  t=setup();t.e.x+=2;for(let i=0;i<40;i++)t.story.tickGuardian(.1,false);assert.equal(t.h.s.run.guardianFate.spare,0);assert.equal(t.story.dismantleGuardian(),false);t.e.x-=2;assert.equal(t.story.dismantleGuardian(),true);assert.equal(t.h.s.run.guardianFate.end,1);
  t=setup();t.ui.view.mode='paused';assert.equal(t.story.dismantleGuardian(),false);t.ui.view.mode='playing';t.h.s.run.time=t.e.yieldUntil;t.story.tickGuardian(.1,true);assert.deepEqual(t.h.s.run.guardianFate,{spare:0,end:0});assert.equal(t.h.s.run.enemies.length,0);
});
test('the previous ending becomes a start scene: witness timing, hollow absence and changed first lines',()=>{
  const spawnAt=(origin,variant='')=>{const h=harness(),ui=screens(h.s,'playing');h.s.run.legacyOrigin=origin;h.s.run.legacyVariant=variant;const story=createStory({...ui,session:{record(){}},decisions:h.story,feedback:{}});for(const t of [10,startEffects.dividedWitnessAt,startEffects.witnessAt-1,startEffects.witnessAt,300]){h.s.run.time=t;story.spawnWitness();if(h.s.run.npc.spawned)return t;}return null;};
  assert.equal(spawnAt(null),startEffects.witnessAt);assert.equal(spawnAt('divided'),startEffects.dividedWitnessAt);assert.equal(spawnAt('consume','hollow'),null);assert.equal(spawnAt('consume'),startEffects.witnessAt);
  const h=harness(),s=h.s,view={mode:'signal'},content=createModalContent({sessionState:s,view,route:()=>null});s.run.signalStep=0;assert.ok(!content.buildModal().includes(firstSignalAfterPreserve));s.run.legacyOrigin='preserve';assert.ok(content.buildModal().includes(firstSignalAfterPreserve));s.run.signalStep=1;assert.ok(!content.buildModal().includes(firstSignalAfterPreserve));
  view.mode='encounter';assert.ok(!content.buildModal().includes(witnessAfterRelease));s.run.legacyOrigin='release';assert.ok(content.buildModal().includes(witnessAfterRelease));
  for(const id of ['preserve','consume','divided','release','hollow'])assert.ok(startScenes[id].line&&startScenes[id].change,id);
});
test('final encounter commits phase, clears transient entities and spawns its core once',()=>{
  const s=state(),r=s.run;r.finalStep=1;r.time=1800;for(const field of ['enemies','bullets','shots','hazards'])r[field]=[{}];let spawns=0;
  const d=createEndingDecisions({sessionState:s,enemyRuntime:{spawnFinalCore:()=>{assert.equal(r.finalStep,2);assert.equal(r.enemies.length,0);spawns++;}}});assert.equal(d.beginFinale(),true);assert.equal(r.nextBoss,5400);assert.equal(r.bossChoiceId,0);assert.equal(spawns,1);noChange(s,()=>d.beginFinale());
});
test('memory axis decides the confirmable ending and every other ending ID is rejected',()=>{
  for(let memory=-7;memory<=7;memory++){const s=state();prepareRoute(s.run,memory);const d=createEndingDecisions({sessionState:s}),expected=memory>=3?'preserve':memory<=-3?'consume':'divided';
    assert.equal(d.route().axes.memory,memory);assert.equal(d.route().ending,expected);assert.equal(d.route().release,false);
    for(const id of ['preserve','consume','divided','release','invalid'].filter(x=>x!==expected))noChange(s,()=>d.chooseFinale(id));
    assert.equal(d.chooseFinale(expected).endingId,expected);}
});
test('release opens only with no dismantled guardian, two returns, this run\'s stillness and a non-negative memory axis',()=>{
  const s=state();prepareRelease(s.run);assert.equal(createEndingDecisions({sessionState:s}).route().release,true);
  for(const mutate of [r=>{r.guardianFate.end=1;},r=>{r.guardianFate.spare=1;},r=>{r.npc.silenced=false;},r=>{r.signalChoices=['burn','burn'];}]){const fresh=state();prepareRelease(fresh.run);mutate(fresh.run);const x=createEndingDecisions({sessionState:fresh});assert.equal(x.route().release,false);noChange(fresh,()=>x.chooseFinale('release'));}
  const permanent=state();prepareRelease(permanent.run);permanent.run.npc.silenced=false;permanent.profile.memory.witness.quiet=true;assert.equal(createEndingDecisions({sessionState:permanent}).route().release,false);
});
test('each ending settles rewards and records once before clearing the run and returns display data',()=>{
  for(const [id,prepare]of [['preserve',r=>prepareRoute(r,4)],['consume',r=>prepareRoute(r,-4)],['divided',r=>prepareRoute(r,0)],['release',prepareRelease]]){const s=state();prepare(s.run);s.run.gold=123;s.run.time=1800;s.run.kills=20;s.profile.gold=10;s.profile.bestTime=2000;
    const d=createEndingDecisions({sessionState:s});noChange(s,()=>d.chooseFinale('invalid'));const result=d.chooseFinale(id);assert.equal(result.gold,523);assert.equal(result.endingId,id);assert.equal(result.scenes.length,3);assert.ok(result.scenes.every(x=>typeof x==='string'&&x.length>10));assert.ok(result.scenes[2].endsWith(endingTexts[id].tail));assert.ok(result.threads.length>0);assert.equal(s.profile.gold,533);assert.equal(s.profile.bestTime,2000);assert.equal(s.profile.bestKills,20);assert.equal(s.profile.memory.endings[id],1);assert.equal(s.profile.memory.lastResolution.ending,id);assert.equal(s.run,null);noChange(s,()=>d.chooseFinale(id));}
});
test('ending scenes follow the witness, guardians and the lost coordinate; the hollow variant needs dismantling and extraction',()=>{
  const scenes=(prepare,id)=>{const s=state();prepare(s.run);return createEndingDecisions({sessionState:s}).chooseFinale(id);};
  let result=scenes(r=>{prepareRoute(r,4);r.npc.state='heard';r.guardianFate={spare:1,end:0};r.siteDecisions.coordinate='keep';},'preserve');
  assert.deepEqual(result.scenes.slice(0,2),[endingScenes.witness.heard.preserve,endingScenes.guardian.spared]);assert.ok(result.scenes[2].startsWith(endingScenes.exit.keep));assert.equal(result.variant,'');
  result=scenes(r=>{prepareRoute(r,-6);r.guardianFate={spare:0,end:3};},'consume');assert.equal(result.variant,'hollow');assert.deepEqual(result.scenes.slice(0,2),[endingScenes.witness.hollow,endingScenes.guardian.hollow]);
  result=scenes(r=>{prepareRoute(r,-6);r.guardianFate={spare:0,end:2};},'consume');assert.equal(result.variant,'');assert.equal(result.scenes[0],`${endingScenes.witness.taken} ${stokerLines.ending}`);
  result=scenes(r=>{prepareRelease(r);r.siteDecisions.coordinate='keep';},'release');assert.deepEqual(result.scenes.slice(0,2),[endingScenes.witness.release,`${endingScenes.guardian.release} ${guardianLines.signal}`]);assert.ok(result.scenes[2].startsWith(endingScenes.exit.release));
  result=scenes(r=>{prepareRoute(r,0);r.time=1800;},'divided');assert.ok(result.scenes[2].includes('지나친 표식 3개'));
});
test('decision factories follow replacement state and reject missing runs without touching previous sessions',()=>{
  const h=harness(),previous=h.s.run,other=state();h.s.profile=other.profile;h.s.run=other.run;assert.equal(h.story.chooseSignal('burn'),true);assert.equal(previous.signalStep,0);assert.equal(other.run.signalStep,1);h.s.run=null;
  for(const action of [()=>h.site.chooseSite('take'),()=>h.site.chooseRelic('mirror'),()=>h.story.chooseWitness('hear'),()=>h.story.acknowledgeSilence(),()=>h.story.chooseBoss('spare'),()=>h.story.chooseSignal('burn'),()=>h.story.chooseAnomaly('keep')])noChange(h.s,action);
});
function screens(s,mode){const calls=[],view={mode},keys=new Set(['KeyD']),screen={setMode:next=>{calls.push(next);view.mode=next;}},storage={save:()=>calls.push('save')};return {sessionState:s,view,platform:{keys},screen,storage,calls};}
test('story workflow blocks wrong-screen commands and double clicks without consuming the next signal',()=>{
  const h=harness(),ui=screens(h.s,'paused'),flow=createStory({...ui,decisions:h.story});noChange(h.s,()=>flow.chooseSignal('burn'));assert.deepEqual(ui.calls,[]);ui.view.mode='signal';flow.chooseSignal('burn');assert.deepEqual(ui.calls,['playing','save']);flow.chooseSignal('burn');assert.equal(h.s.run.signalStep,1);assert.equal(h.s.run.gold,100);assert.deepEqual(ui.calls,['playing','save']);
});
test('site workflow advances to relic then resumes growth and does not save rejected choices',()=>{
  const h=harness(),ui=screens(h.s,'site');prepareSite(h.s,0);const flow=createSites({...ui,decisions:h.site,feedback:{ring:()=>ui.calls.push('ring')},growthActions:{openUpgrade:()=>ui.calls.push('growth')}});
  flow.chooseSite('invalid');assert.deepEqual(ui.calls,[]);flow.chooseSite('keep');assert.deepEqual(ui.calls,['relic','save']);h.s.run.pending=1;flow.chooseRelic(relics.find(r=>r.site===sites[0].id).id);assert.deepEqual(ui.calls,['relic','save','ring','growth','save']);
});
test('ending workflow stores result, clears input and saves the completed state after screen transition',()=>{
  const s=state(),ui=screens(s,'finalchoice');prepareRoute(s.run,4);const decisions=createEndingDecisions({sessionState:s}),flow=createFinale({...ui,decisions});flow.chooseFinale('release');assert.deepEqual(ui.calls,[]);flow.chooseFinale('preserve');assert.equal(ui.view.lastResult.endingId,'preserve');assert.equal(ui.platform.keys.size,0);assert.equal(s.run,null);assert.deepEqual(ui.calls,['ending','save']);flow.chooseFinale('preserve');assert.deepEqual(ui.calls,['ending','save']);
});
test('standing still for 4.5 seconds on the final screen opens the release ending only on the release route',()=>{
  const run=(prepare,inputs)=>{const s=state(),ui=screens(s,'finalchoice');prepare(s.run);const flow=createFinale({...ui,decisions:createEndingDecisions({sessionState:s})});let t=1000;flow.watchStillness(t);
    for(const step of inputs){t+=step.after;if(step.input)ui.view.inputSeen=true;flow.watchStillness(t);}return ui;};
  let ui=run(prepareRelease,[{after:4499}]);assert.deepEqual(ui.calls,[]);
  ui=run(prepareRelease,[{after:4500}]);assert.equal(ui.view.lastResult.endingId,'release');assert.deepEqual(ui.calls,['ending','save']);
  ui=run(prepareRelease,[{after:3000,input:true},{after:3000}]);assert.deepEqual(ui.calls,[]);
  ui=run(prepareRelease,[{after:3000,input:true},{after:4500}]);assert.equal(ui.view.lastResult.endingId,'release');
  ui=run(r=>prepareRoute(r,4),[{after:60000}]);assert.deepEqual(ui.calls,[]);
  const paused=state(),other=screens(paused,'paused');prepareRelease(paused.run);const flow=createFinale({...other,decisions:createEndingDecisions({sessionState:paused})});flow.watchStillness(0);flow.watchStillness(9000);assert.deepEqual(other.calls,[]);assert.equal(other.view.finalStillSince,null);
});
test('choice descriptions and applied immediate rewards read the same definitions',()=>{
  const h=harness(),s=h.s,view={mode:'site'},content=createModalContent({sessionState:s,view,route:()=>({ending:'preserve',release:false})});
  for(const [i,site]of sites.entries()){s.run.siteStep=i;const html=content.buildModal();for(const reward of Object.values(siteRewards[site.id])){if(reward.gold)assert.ok(html.includes(reward.gold+'G'));if(reward.xp)assert.ok(html.includes('EXP +'+reward.xp));if(reward.enemies)assert.ok(html.includes(reward.enemies.length+'마리'));}}
  view.mode='signal';s.run.signalStep=1;const signal=content.buildModal();assert.ok(signal.includes('+'+signalReward.hp));assert.ok(signal.includes((signalReward.goldBase+2*signalReward.goldStep)+'G'));view.mode='finalchoice';assert.ok(content.buildModal().includes(endingReward+'G'));assert.equal(witnessReward.gold,150);
});
test('world choice modules exclude UI, feedback and storage while workflow choices exclude reward mutation',()=>{
  const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
  for(const file of ['world/site-decisions.js','world/story-decisions.js','world/ending-decisions.js']){const source=read(file);assert.doesNotMatch(source,/\b(?:view|platform|screen|feedback|storage|document|window|localStorage|session)\b/,file);assert.doesNotMatch(source,/from ['"][^'"]*(?:ui|render|app)\//,file);}
  for(const file of ['world/sites.js','world/story.js','world/encounters.js','world/finale.js']){const source=read(file);for(const m of source.matchAll(/ {2}function (?:choose\w+|acknowledgeSilence)\([^]*?(?=\n {2}function |\n {2}return \{)/g)){assert.doesNotMatch(m[0],/sessionState\.(?:run|profile)[\w.]*\s*(?:=(?!=)|\+\+|\+=)/,file);assert.doesNotMatch(m[0],/\b(?:rewardGold|dropXp|reserveXp|appendRecord|killEnemy)\s*\(/,file);}}
  assert.doesNotMatch(read('ui/modals.js'),/sites\.siteEffect/);assert.doesNotMatch(read('world/ending-decisions.js'),/journey\.episodeTitle/);
});
test('death is part of the story: deaths and the phase are remembered, the witness and game over screen respond',()=>{
  const s=state(),view={mode:'playing'},calls=[];s.run.time=1000;
  const session=createSession({sessionState:s,view,platform:{keys:new Set()},screen:{setMode:m=>calls.push(m)},storage:{save:()=>calls.push('save')}});
  session.finish();assert.equal(s.profile.memory.deaths,1);assert.equal(s.profile.memory.lastDeathPhase,'세계의 반응');assert.equal(s.run,null);assert.deepEqual(calls,['gameover','save']);assert.ok(s.profile.memory.archive.includes(deathLines.gameover));
  s.profile.memory.witness.met=1;const content=createModalContent({sessionState:s,view:{mode:'gameover',lastResult:{time:1000,kills:1,gold:2,level:3}},route:()=>null});const over=content.buildModal();assert.ok(over.includes(deathLines.gameover));assert.ok(over.includes(deathLines.witness[0].line));
  s.profile.memory.deaths=4;s.run=createRun(s.profile,{maxHp:100,xpNext:xpNeed(1)});const talk=createModalContent({sessionState:s,view:{mode:'encounter'},route:()=>null}).buildModal();assert.ok(talk.includes("또 '세계의 반응'에서 멈췄구나"));
  const hydrated=initialProfile();hydrateProfile(hydrated,{memory:{deaths:7,lastDeathPhase:'없는 단계'}});assert.equal(hydrated.memory.deaths,7);assert.equal(hydrated.memory.lastDeathPhase,'');
});
test('truth pieces open one by one from endings and the stillness secret, and the full truth only when all are found',()=>{
  const s=state(),view={mode:'ledger'},content=createModalContent({sessionState:s,view,route:()=>null}),count=()=>Number(/진실 조각 (\d)\//.exec(content.buildModal())[1]);
  assert.equal(count(),0);assert.ok(!content.buildModal().includes(truthReveal));
  s.profile.memory.witness.quiet=true;assert.equal(count(),1);
  for(const [i,id]of ['preserve','consume','divided'].entries()){s.profile.memory.endings[id]=1;assert.equal(count(),i+2);assert.ok(!content.buildModal().includes(truthReveal));}
  s.profile.memory.endings.release=2;assert.equal(count(),truthPieces.length-1);assert.ok(!content.buildModal().includes(truthReveal));
  s.profile.memory.stoker.origin=true;assert.equal(count(),truthPieces.length);assert.ok(content.buildModal().includes(truthReveal));
  const fresh=state();prepareRoute(fresh.run,4);createEndingDecisions({sessionState:fresh}).chooseFinale('preserve');assert.ok(fresh.profile.memory.archive.includes(truthFound));
  const again=state();again.profile.memory.endings.preserve=1;prepareRoute(again.run,4);createEndingDecisions({sessionState:again}).chooseFinale('preserve');assert.ok(!again.profile.memory.archive.includes(truthFound));
});
test('route rewards: remembering and listening add experience, burning and extraction add the tuned damage',()=>{
  const profile=initialProfile(),base=createRun(profile,{maxHp:100,xpNext:xpNeed(1)});
  assert.equal(xpBonus(profile,base),1);
  const kept={...base,signalChoices:['hear','hear','burn'],npc:{...base.npc,state:'heard'}};
  assert.ok(Math.abs(xpBonus(profile,kept)-(1+2*signalReward.xp+witnessReward.xp))<1e-12);
  const s={profile,run:createRun(profile,{maxHp:100,xpNext:xpNeed(1)}),replaceRun(){}},statistics=createStatistics({sessionState:s}),plain=statistics.stats().damage;
  s.run.signalPower=3;s.run.npc.state='taken';
  assert.ok(Math.abs(statistics.stats().damage/plain-(1+3*signalReward.burnPower)*(1+witnessReward.takeDamage))<1e-9);
});
test('the witness reacts to memory-axis choices: a voice if heard, static if extracted, silence before meeting',()=>{
  for(const [state,expect]of [['none',null],['waiting',null],['taken','taken'],['heard','voice']]){
    const h=harness(),{s}=h;s.run.npc.state=state;h.story.chooseSignal('hear');h.story.chooseSignal('hear');h.story.chooseSignal('burn');
    const logs=s.run.logs.join('\n');
    if(expect===null)assert.ok(!logs.includes('기록원 · "')&&!logs.includes(witnessReactions.taken),state);
    if(expect==='taken')assert.ok(logs.includes(witnessReactions.taken));
    if(expect==='voice'){assert.ok(logs.includes(witnessReactions.keep[0]));assert.ok(logs.includes(witnessReactions.keep[1]));assert.ok(logs.includes(witnessReactions.burn[0]));}
  }
  const h=harness(),{s}=h;s.run.npc.state='heard';prepareSite(h.s,0);h.site.chooseSite('take');assert.ok(s.run.logs.includes(witnessReactions.burn[0]));
  const relic=relics.find(r=>r.site===sites[0].id);h.site.chooseRelic(relic.id);assert.ok(s.run.logs.includes(witnessReactions.relic.replace('{relic}',relic.name)));
});
test('the stoker answers burning when the witness was not heard; the archivist keeps the voice when heard',()=>{
  for(const state of ['none','taken']){const h=harness(),{s}=h;s.run.npc.state=state;h.story.chooseSignal('burn');h.story.chooseSignal('burn');const logs=s.run.logs.join('\n');assert.ok(logs.includes(stokerLines.burn[0]),state);assert.ok(logs.includes(stokerLines.burn[1]),state);}
  const h=harness(),{s}=h;s.run.npc.state='heard';h.story.chooseSignal('burn');assert.ok(!s.run.logs.join('\n').includes('화부 ·'));
});
test('ending and ledger screens draw the run\'s axis position; the result keeps the axes for the ledger',()=>{
  const s=state();prepareRoute(s.run,4);s.run.guardianFate={spare:2,end:1};const result=createEndingDecisions({sessionState:s}).chooseFinale('preserve');
  assert.deepEqual({memory:result.axes.memory,spared:result.axes.spared,ended:result.axes.ended},{memory:4,spared:2,ended:1});
  assert.deepEqual(s.profile.memory.lastResolution.axes,result.axes);
  const ending=createModalContent({sessionState:s,view:{mode:'ending',lastResult:result},route:()=>null}).buildModal();
  assert.ok(ending.includes('route-axis'));assert.ok(ending.includes(`left:${Math.round((4+7)/14*100)}%`));assert.ok(ending.includes('돌려보냄 2 / 분해 1'));
  const ledger=createModalContent({sessionState:s,view:{mode:'ledger'},route:()=>null}).buildModal();assert.ok(ledger.includes('route-axis'));
  const restored=initialProfile();hydrateProfile(restored,{memory:{lastResolution:{ending:'preserve',threads:[],scenes:[],axes:{memory:99,spared:-3,ended:2,stillness:'yes'}}}});
  assert.deepEqual({memory:restored.memory.lastResolution.axes.memory,spared:restored.memory.lastResolution.axes.spared,stillness:restored.memory.lastResolution.axes.stillness},{memory:7,spared:0,stillness:false});
});
