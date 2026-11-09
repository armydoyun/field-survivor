import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { createProgression } from '../src/growth/progression.js';
import { xpNeed } from '../src/growth/experience.js';
import { createSiteDecisions } from '../src/world/site-decisions.js';
import { createStoryDecisions } from '../src/world/story-decisions.js';
import { createEncounterDecisions } from '../src/world/encounter-decisions.js';
import { createEndingDecisions } from '../src/world/ending-decisions.js';
import { createSites } from '../src/world/sites.js';
import { createStory } from '../src/world/story.js';
import { createEncounters } from '../src/world/encounters.js';
import { createFinale } from '../src/world/finale.js';
import { createModalContent } from '../src/ui/modal-content.js';
import { sites, relics, anomalies, legacies, echoes, fronts } from '../src/data/world.js';
import { siteRewards, signalReward, witnessReward, endingReward } from '../src/data/world-choices.js';
import { GUARDIAN_SALVAGE, GEM_LIMIT, ENEMY_LIMIT } from '../src/core/config.js';
import { rewardGold } from '../src/growth/rewards.js';

function state(){const s={profile:initialProfile(),run:null,replaceRun:r=>{s.run=r;}};s.run=createRun(s.profile,{maxHp:100,xpNext:xpNeed(1)});return s;}
function harness(s=state()){
  const statistics=createStatistics({sessionState:s}),progression=createProgression({sessionState:s,statistics}),spawned=[];
  const enemyRuntime={spawnEnemy(kind){const e={id:spawned.length+1,kind,hp:10,maxHp:10};spawned.push(e);s.run.enemies.push(e);return e;},promoteElite:e=>{e.elite=true;}};
  return {s,statistics,progression,spawned,enemyRuntime,site:createSiteDecisions({sessionState:s,statistics,progression,enemyRuntime}),story:createStoryDecisions({sessionState:s,statistics}),encounter:createEncounterDecisions({sessionState:s,statistics})};
}
const snapshot=s=>structuredClone({run:s.run,profile:s.profile});
function noChange(s,action){const before=snapshot(s);assert.ok(!action());assert.deepEqual(snapshot(s),before);}
function prepareSite(s,index){s.run.siteStep=index;s.run.site={id:sites[index].id};s.run.sitePending=true;}
function prepareRelease(r){r.finalStep=3;r.journey.outcomes=[{slot:0,kind:'relay',success:true},{slot:2,kind:'hunt',success:true}];r.echoOutcomes.witness='keep';}

// Each suite operates without DOM, mode, storage, rendering or the application bootstrap.
test('all six site choices retain exact rewards, HP order, enemy patterns and single commitment',()=>{
  for(let i=0;i<sites.length;i++)for(const choice of ['keep','take']){
    const h=harness(),{s}=h;prepareSite(s,i);s.run.player.hp=50;
    assert.equal(h.site.chooseSite(choice).id,sites[i].id);assert.equal(s.run.siteStep,i+1);assert.equal(s.run.sitePending,false);assert.equal(s.run.site,null);assert.equal(s.run.relicPending,sites[i].id);assert.equal(s.profile.memory.sites[sites[i].id][choice],1);
    const expected={coordinate:{keep:[100,50,0,0,0,100,[]],take:[220,50,0,0,0,240,[1,1,1,1,1,1]]},reservoir:{keep:[0,90,0,0,0,240,[]],take:[0,25,2,0,0,0,[4,4,4,4,4]]},archive:{keep:[350,75,0,1,0,0,[]],take:[0,50,0,0,2,350,[2,5,2,5,2,5]]}}[sites[i].id][choice];
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
test('signal routes preserve ordered gold, HP, chapter selection and final exhaustion',()=>{
  for(const [route,chapter]of [[['hear','hear','hear'],'새벽의 기록'],[['burn','burn','burn'],'식지 않는 엔진'],[['hear','burn','burn'],'식지 않는 엔진'],[['burn','hear','hear'],'새벽의 기록']]){
    const h=harness(),{s}=h;s.run.player.hp=50;let gold=0,heard=0;
    noChange(s,()=>h.story.chooseSignal('invalid'));
    for(const [i,choice]of route.entries()){assert.equal(h.story.chooseSignal(choice),true);if(choice==='burn')gold+=100+30*i;else heard++;}
    assert.equal(s.run.gold,gold);assert.equal(s.run.player.hp,50+heard*20);assert.equal(s.run.signalHp,heard*20);assert.deepEqual(s.run.signalChoices,route);assert.ok(s.profile.memory.chapters.includes(chapter));noChange(s,()=>h.story.chooseSignal('hear'));
  }
});
test('every anomaly option retains duration, ward timing, HP clamp and exactly one memory increment',()=>{
  for(const [index,event]of anomalies.entries())for(const option of event.options){const h=harness(),{s}=h;s.run.time=event.at;s.run.anomalyStep=index;s.run.anomalyPending=true;s.run.player.hp=200;
    noChange(s,()=>h.story.chooseAnomaly('invalid'));assert.equal(h.story.chooseAnomaly(option.id),true);assert.equal(s.run.anomalyChoices[event.id],option.id);assert.equal(s.run.anomalyStep,index+1);assert.equal(s.profile.memory.anomalies[event.id][option.id],1);
    if(event.id!=='echo')assert.equal(s.run.anomalyUntil[event.id],event.at+(event.id==='clock'?90:120));else assert.equal(s.run.player.hp,h.statistics.stats().maxHp);
    if(event.id==='border'&&option.id==='ward')assert.equal(s.run.anomalyWardAt,event.at);noChange(s,()=>h.story.chooseAnomaly(option.id));
  }
});
test('guardian decisions keep spare rewards distinct and commit fate before delegated salvage',()=>{
  for(const choice of ['spare','end']){const s=state(),e={id:1,kind:3,phase:3,hp:0,maxHp:100,x:0,y:0};s.run.enemies=[e];s.run.bossChoiceId=1;let kills=0;
    const d=createStoryDecisions({sessionState:s,difficulty:{rewardXp:()=>50},combat:{killEnemy:(enemy,depth,m)=>{kills++;assert.equal(enemy,e);assert.equal(depth,0);assert.equal(m,GUARDIAN_SALVAGE);assert.equal(s.run.guardianOrder,'end');assert.equal(s.profile.memory.guardian.ended,1);}}});
    const result=d.chooseBoss(choice);assert.equal(result.spared,choice==='spare');assert.equal(s.run.bossChoiceId,0);assert.equal(s.run.guardianFate[choice],1);assert.equal(s.run.enemies.length,0);assert.equal(kills,choice==='end'?1:0);
    if(choice==='spare'){assert.equal(s.run.gold,rewardGold(e));assert.equal(s.run.gems[0].xp,50);}noChange(s,()=>d.chooseBoss(choice));
  }
  const s=state(),e={id:1,kind:3,phase:3,x:0,y:0,hp:0};s.run.enemies=[e];s.run.bossChoiceId=1;s.run.gems=Array.from({length:GEM_LIMIT},()=>({xp:1,x:1e5,y:1e5}));const d=createStoryDecisions({sessionState:s,difficulty:{rewardXp:()=>50}});assert.ok(d.chooseBoss('spare'));assert.equal(s.run.xpReserve,50);
});
test('all legacy choices and nonresponse record once and clamp HP using the committed choice',()=>{
  for(const [origin,def]of Object.entries(legacies))for(const choice of [...def.options.map(o=>o.id),'silent']){const h=harness(),{s}=h;s.run.legacyOrigin=origin;s.run.legacySite={x:0,y:0};s.run.player.hp=200;noChange(s,()=>h.story.chooseLegacy('invalid'));assert.equal(h.story.chooseLegacy(choice),true);assert.equal(s.run.legacyChoice,choice);assert.equal(s.profile.memory.legacies[origin][choice],1);assert.equal(s.run.player.hp,Math.min(200,h.statistics.stats().maxHp));assert.equal(s.run.legacySite,null);noChange(s,()=>h.story.chooseLegacy(choice));}
});
test('echo restoration, conversion and nonresponse preserve origin and duplicate guards',()=>{
  for(const [index,e]of echoes.entries())for(const choice of ['keep','use','silent']){const h=harness(),{s}=h;s.run.echoStep=index;s.run.echoSite={id:e.id};s.run.echoSeed[e.id]='none';s.run.echoPending=true;s.run.player.hp=200;
    noChange(s,()=>h.encounter.finishEcho('invalid'));assert.equal(h.encounter.finishEcho(choice),true);assert.equal(s.run.echoOutcomes[e.id],choice);assert.equal(s.profile.memory.echoes[e.id][choice],1);assert.equal(s.run.echoPending,false);assert.equal(s.run.echoStep,index+1);assert.equal(s.run.player.hp,choice==='silent'?200:h.statistics.stats().maxHp);noChange(s,()=>h.encounter.finishEcho(choice));}
});
test('front path choices and nonresponse do not depend on physical position or a modal',()=>{
  for(const [index,front]of fronts.entries())for(const choice of [...front.paths.map(o=>o.id),'silent']){const h=harness(),{s}=h;s.run.frontStep=index;s.run.front={id:front.id};noChange(s,()=>h.encounter.resolveFront('invalid'));assert.equal(h.encounter.resolveFront(choice),true);assert.equal(s.run.frontChoices[front.id],choice);assert.equal(s.profile.memory.fronts[front.id][choice],1);assert.equal(s.run.front,null);noChange(s,()=>h.encounter.resolveFront(choice));}
});
test('final encounter commits phase, clears transient entities and spawns its core once',()=>{
  const s=state(),r=s.run;r.finalStep=1;r.time=1800;for(const field of ['enemies','bullets','shots','hazards'])r[field]=[{}];let spawns=0;
  const d=createEndingDecisions({sessionState:s,enemyRuntime:{spawnFinalCore:()=>{assert.equal(r.finalStep,2);assert.equal(r.enemies.length,0);spawns++;}}});assert.equal(d.beginFinale(),true);assert.equal(r.nextBoss,5400);assert.equal(r.bossChoiceId,0);assert.equal(spawns,1);noChange(s,()=>d.beginFinale());
});
test('release eligibility requires two successful episodes including slot 2 and a used/restored echo',()=>{
  const s=state(),d=createEndingDecisions({sessionState:s});prepareRelease(s.run);assert.equal(d.canRelease(),true);
  for(const mutate of [r=>{r.journey.outcomes=r.journey.outcomes.slice(1);},r=>{r.journey.outcomes[1].slot=1;},r=>{r.journey.outcomes[1].success=false;},r=>{r.echoOutcomes.witness='silent';}]){const fresh=state();prepareRelease(fresh.run);mutate(fresh.run);const x=createEndingDecisions({sessionState:fresh});assert.equal(x.canRelease(),false);noChange(fresh,()=>x.chooseFinale('release'));}
});
test('each ending settles rewards and records once before clearing the run and returns display data',()=>{
  for(const id of ['preserve','consume','release']){const s=state();prepareRelease(s.run);s.run.gold=123;s.run.time=1800;s.run.kills=20;s.profile.gold=10;s.profile.bestTime=2000;
    const d=createEndingDecisions({sessionState:s});noChange(s,()=>d.chooseFinale('invalid'));const result=d.chooseFinale(id);assert.equal(result.gold,523);assert.equal(result.endingId,id);assert.equal(result.scenes.length,3);assert.ok(result.threads.length>0);assert.equal(s.profile.gold,533);assert.equal(s.profile.bestTime,2000);assert.equal(s.profile.bestKills,20);assert.equal(s.profile.memory.endings[id],1);assert.equal(s.profile.memory.lastResolution.ending,id);assert.equal(s.run,null);noChange(s,()=>d.chooseFinale(id));}
});
test('decision factories follow replacement state and reject missing runs without touching previous sessions',()=>{
  const h=harness(),previous=h.s.run,other=state();h.s.profile=other.profile;h.s.run=other.run;assert.equal(h.story.chooseSignal('burn'),true);assert.equal(previous.signalStep,0);assert.equal(other.run.signalStep,1);h.s.run=null;
  for(const action of [()=>h.site.chooseSite('take'),()=>h.site.chooseRelic('mirror'),()=>h.story.chooseWitness('hear'),()=>h.story.acknowledgeSilence(),()=>h.story.chooseBoss('spare'),()=>h.story.chooseSignal('burn'),()=>h.story.chooseAnomaly('keep'),()=>h.story.chooseLegacy('silent'),()=>h.encounter.finishEcho('silent'),()=>h.encounter.resolveFront('silent')])noChange(h.s,action);
});
function screens(s,mode){const calls=[],view={mode},keys=new Set(['KeyD']),screen={setMode:next=>{calls.push(next);view.mode=next;}},storage={save:()=>calls.push('save')};return {sessionState:s,view,platform:{keys},screen,storage,calls};}
test('story workflow blocks wrong-screen commands and double clicks without consuming the next signal',()=>{
  const h=harness(),ui=screens(h.s,'paused'),flow=createStory({...ui,decisions:h.story});noChange(h.s,()=>flow.chooseSignal('burn'));assert.deepEqual(ui.calls,[]);ui.view.mode='signal';flow.chooseSignal('burn');assert.deepEqual(ui.calls,['playing','save']);flow.chooseSignal('burn');assert.equal(h.s.run.signalStep,1);assert.equal(h.s.run.gold,100);assert.deepEqual(ui.calls,['playing','save']);
});
test('site workflow advances to relic then resumes growth and does not save rejected choices',()=>{
  const h=harness(),ui=screens(h.s,'site');prepareSite(h.s,0);const flow=createSites({...ui,decisions:h.site,feedback:{ring:()=>ui.calls.push('ring')},growthActions:{openUpgrade:()=>ui.calls.push('growth')}});
  flow.chooseSite('invalid');assert.deepEqual(ui.calls,[]);flow.chooseSite('keep');assert.deepEqual(ui.calls,['relic','save']);h.s.run.pending=1;flow.chooseRelic(relics.find(r=>r.site===sites[0].id).id);assert.deepEqual(ui.calls,['relic','save','ring','growth','save']);
});
test('automatic echo and legacy nonresponse save without resuming a paused screen',()=>{
  const h=harness(),ui=screens(h.s,'paused');h.s.run.legacyOrigin='preserve';h.s.run.legacySite={};const story=createStory({...ui,decisions:h.story});assert.equal(story.chooseLegacy('silent'),true);assert.deepEqual(ui.calls,['save']);h.s.run.echoSite={id:echoes[0].id};h.s.run.echoSeed[echoes[0].id]='none';const encounter=createEncounters({...ui,decisions:h.encounter});assert.equal(encounter.finishEcho('silent'),true);assert.deepEqual(ui.calls,['save','save']);assert.equal(ui.view.mode,'paused');
});
test('ending workflow stores result, clears input and saves the completed state after screen transition',()=>{
  const s=state(),ui=screens(s,'finalchoice');prepareRelease(s.run);const decisions=createEndingDecisions({sessionState:s}),flow=createFinale({...ui,decisions});flow.chooseFinale('release');assert.equal(ui.view.lastResult.endingId,'release');assert.equal(ui.platform.keys.size,0);assert.equal(s.run,null);assert.deepEqual(ui.calls,['ending','save']);flow.chooseFinale('release');assert.deepEqual(ui.calls,['ending','save']);
});
test('choice descriptions and applied immediate rewards read the same definitions',()=>{
  const h=harness(),s=h.s,view={mode:'site'},content=createModalContent({sessionState:s,view,canRelease:()=>false});
  for(const [i,site]of sites.entries()){s.run.siteStep=i;const html=content.buildModal();for(const reward of Object.values(siteRewards[site.id])){if(reward.gold)assert.ok(html.includes(reward.gold+'G'));if(reward.xp)assert.ok(html.includes('EXP +'+reward.xp));if(reward.enemies)assert.ok(html.includes(reward.enemies.length+'마리'));}}
  view.mode='signal';s.run.signalStep=1;const signal=content.buildModal();assert.ok(signal.includes('+'+signalReward.hp));assert.ok(signal.includes((signalReward.goldBase+2*signalReward.goldStep)+'G'));view.mode='finalchoice';assert.ok(content.buildModal().includes(endingReward+'G'));assert.equal(witnessReward.gold,150);
});
test('world choice modules exclude UI, feedback and storage while workflow choices exclude reward mutation',()=>{
  const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
  for(const file of ['world/site-decisions.js','world/story-decisions.js','world/encounter-decisions.js','world/ending-decisions.js']){const source=read(file);assert.doesNotMatch(source,/\b(?:view|platform|screen|feedback|storage|document|window|localStorage|session)\b/,file);assert.doesNotMatch(source,/from ['"][^'"]*(?:ui|render|app)\//,file);}
  for(const file of ['world/sites.js','world/story.js','world/encounters.js','world/finale.js']){const source=read(file);for(const m of source.matchAll(/ {2}function (?:choose\w+|acknowledgeSilence|finishEcho|resolveFront)\([^]*?(?=\n {2}function |\n {2}return \{)/g)){assert.doesNotMatch(m[0],/sessionState\.(?:run|profile)[\w.]*\s*(?:=(?!=)|\+\+|\+=)/,file);assert.doesNotMatch(m[0],/\b(?:rewardGold|dropXp|reserveXp|appendRecord|killEnemy)\s*\(/,file);}}
  assert.doesNotMatch(read('ui/modals.js'),/sites\.siteEffect/);assert.doesNotMatch(read('world/ending-decisions.js'),/journey\.episodeTitle/);
});
