import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { initialProfile } from '../src/core/profile.js';
import { createRun, makeJourney } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { paceAt } from '../src/core/difficulty.js';
import { createSession, resumeMode } from '../src/core/session.js';
import { createStorage } from '../src/core/storage.js';
import { encodeSave, readSave, SAVE_VERSION } from '../src/save/format.js';
import { restoreRun } from '../src/save/restore-run.js';
import { restoreJourney } from '../src/save/restore-world.js';
import { xpNeed } from '../src/growth/experience.js';
import { commitFusion } from '../src/growth/commands.js';
import { fusionRecipes } from '../src/data/fusions.js';
import { sites } from '../src/data/world.js';
import { upgrades } from '../src/data/upgrades.js';
import { SAVE_KEY, RECOVERY_DELAY } from '../src/core/config.js';

const plan=[{slot:0,at:450,kind:'witness'},{slot:1,at:840,kind:'relay'},{slot:2,at:1200,kind:'guardian'},{slot:3,at:1590,kind:'hunt'}];
function fresh(profile=initialProfile()){return createRun(profile,{maxHp:100,xpNext:xpNeed(1),journey:makeJourney(plan.map(x=>({...x})))});}
function state(){const s={profile:initialProfile(),run:null,replaceRun:r=>{s.run=r;},resetState(){s.profile=initialProfile();s.run=null;}};s.run=fresh(s.profile);return s;}
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;}
function adapter(s=state()){
  const messages=[],operations=[],view={resetIdle:false};let text=null;
  const backend={setItem:(key,value)=>{operations.push(['set',key]);text=value;},getItem:key=>{operations.push(['get',key]);return text;},removeItem:key=>{operations.push(['remove',key]);text=null;}};
  return {s,view,messages,operations,backend,setText:v=>{text=v;},getText:()=>text,storage:createStorage({sessionState:s,view,screen:{toast:m=>messages.push(m)},backend:()=>backend})};
}

test('save envelope keeps v:1 and excludes only transient feedback without changing the run',()=>{
  const s=state();for(const field of ['fx','popups','arcs','waves'])s.run[field]=[{secret:field}];s.run.shots=[{kind:'pulse',x:1,y:2}];
  const rawRun=structuredClone(s.run),profile=structuredClone(s.profile),data=readSave(encodeSave(s.profile,s.run));assert.equal(SAVE_VERSION,1);assert.deepEqual(Object.keys(data),['v','profile','run']);assert.equal(data.v,1);
  for(const field of ['fx','popups','arcs','waves'])assert.equal(Object.hasOwn(data.run,field),false);assert.deepEqual(data.run.shots,s.run.shots);assert.deepEqual(s.run,rawRun);assert.deepEqual(s.profile,profile);assert.equal(readSave(encodeSave(s.profile,null)).run,null);
});
test('envelope rejects missing and unsupported versions before profile/run access and reports malformed JSON',()=>{
  for(const value of [null,{},[],{v:2,profile:{}},{v:1},{v:1,profile:null}])assert.equal(readSave(JSON.stringify(value)),null);
  assert.throws(()=>readSave('{bad'),SyntaxError);const data=readSave('{"v":1,"profile":{},"run":null}');assert.deepEqual(data,{v:1,profile:{},run:null});
});
test('restore uses explicit frozen inputs, consumes no RNG and returns independent mutable runs',()=>{
  const profile=initialProfile(),raw=fresh(profile);raw.player.hp=80;raw.gems=[{x:0,y:0,xp:5,count:2}];freeze(profile);freeze(raw);const previous=Math.random;Math.random=()=>{throw Error('restore must not consume RNG');};
  try{const a=restoreRun(raw,profile),b=restoreRun(raw,profile);assert.deepEqual(a,b);a.player.x=999;a.gems[0].count++;a.journey.plan[0].at++;assert.notEqual(a.player.x,b.player.x);assert.equal(b.gems[0].count,2);assert.equal(b.journey.plan[0].at,450);assert.equal(raw.gems[0].count,2);}finally{Math.random=previous;}
});
test('invalid run shapes, invalid journey and lethal saved HP cannot become playable runs',()=>{
  const profile=initialProfile();for(const raw of [null,{},[],{player:{},enemies:[],shots:[],gems:[]},...['player','enemies','shots','gems'].map(field=>({...fresh(profile),[field]:null}))])assert.equal(restoreRun(raw,profile),null);
  const dead=fresh(profile);dead.player.hp=0;assert.equal(restoreRun(dead,profile),null);assert.equal(restoreJourney({plan:[]},0),null);
});
test('restored HP uses the supplied profile and committed world/loadout modifiers before clamping',()=>{
  const weak=initialProfile(),strong=initialProfile();strong.perks.health=3;strong.memory.witness.quiet=true;
  const raw=fresh();raw.player.hp=1e6;raw.up.vitality=2;raw.relics=['glass'];raw.anomalyChoices.echo='keep';raw.journey.keystone='control';
  for(const profile of [weak,strong]){const r=restoreRun(raw,profile),expected=createStatistics({sessionState:{profile,run:null}}).stats(r).maxHp;assert.equal(r.player.hp,expected);assert.equal(r.up.vitality,2);}
  assert.ok(restoreRun(raw,strong).player.hp>restoreRun(raw,weak).player.hp);
});
test('scalar restoration preserves XP rescaling, perk caps, phase derivation and recovery bounds',()=>{
  const profile=initialProfile();profile.perks.reroll=2;const raw=fresh(profile);Object.assign(raw,{time:960,level:10,xpNext:999,xp:500,rerolls:100,xpReserve:1e12,recoveryUntil:1e9,harvestBudget:-1,stage:999,pending:999,choices:['invalid','power']});raw.up.power=999;
  const r=restoreRun(raw,profile);assert.equal(r.xpNext,xpNeed(10));assert.equal(r.xp,Math.floor(500/999*xpNeed(10)));assert.equal(r.rerolls,2);assert.equal(r.xpReserve,1e8);assert.equal(r.recoveryUntil,960+RECOVERY_DELAY);assert.equal(r.harvestBudget,0);assert.equal(r.stage,paceAt(960).index);assert.equal(r.pending,100);assert.equal(r.up.power,upgrades.find(u=>u.id==='power').max);assert.deepEqual(r.choices,[]);
});
test('journey restoration limits plans, deduplicates outcomes and validates active/core phases',()=>{
  const raw=makeJourney(plan);raw.plan=raw.plan.map(x=>({...x,at:1e6}));raw.step=4;raw.outcomes=[{slot:0,kind:'relay',success:true},{slot:0,kind:'hunt',success:true},{slot:5,kind:'hunt',success:true}];raw.active={slot:1,kind:'hunt'};raw.keystone='invalid';raw.core={phase:1,cycle:9,nodeHp:1e9,attack:{kind:'ring',length:1e9}};
  const j=restoreJourney(raw,1800);assert.deepEqual(j.plan.map(x=>x.at),[465,855,1215,1605]);assert.deepEqual(j.outcomes,[{slot:0,kind:'relay',success:true}]);assert.equal(j.active,null);assert.equal(j.keystone,null);assert.equal(j.core.nodeHp,4000);assert.equal(j.core.attack.length,450);
});
test('world restore keeps matched pending sites, drops stale ones, and ignores the retired echo/front/reply fields',()=>{
  const profile=initialProfile(),raw=fresh(profile);raw.siteStep=1;raw.site={id:sites[1].id,x:1,y:2};raw.sitePending=true;Object.assign(raw,{echoStep:0,echoSite:{id:'witness',x:1,y:2},echoPending:true,frontStep:0,front:{id:'breach',x:1,y:2},legacySite:{x:1,y:2},legacyPending:true,legacyChoice:'share'});raw.legacyOrigin='preserve';
  let r=restoreRun(raw,profile);assert.equal(r.sitePending,true);assert.equal(r.legacyOrigin,'preserve');assert.equal(r.legacyVariant,'');for(const key of ['echoStep','echoSite','echoPending','echoSeed','echoOutcomes','frontStep','front','frontChoices','legacySite','legacyPending','legacyChoice'])assert.equal(key in r,false,key);
  raw.site.id='stale';raw.legacyOrigin='consume';raw.legacyVariant='hollow';r=restoreRun(raw,profile);assert.equal(r.site,null);assert.equal(r.sitePending,false);assert.equal(r.legacyVariant,'hollow');
  raw.legacyOrigin='unknown';r=restoreRun(raw,profile);assert.equal(r.legacyOrigin,null);assert.equal(r.legacyVariant,'');
});
test('combat restore preserves the zero-HP guardian choice and validates live hazard sources',()=>{
  const profile=initialProfile(),raw=fresh(profile);raw.time=960;raw.bossChoiceId=42;raw.nextId=1;raw.enemies=[{id:42,kind:3,phase:3,x:1,y:2,hp:0,pushX:20,pushY:30},{id:7,kind:0,x:1,y:2,hp:10},{id:8,kind:0,x:1,y:2,hp:0}];raw.hazards=[{sourceId:7,x:1,y:2,fireAt:960,endAt:962},{sourceId:8,x:1,y:2,fireAt:960,endAt:962},{sourceId:99,x:1,y:2,fireAt:960,endAt:962}];
  const r=restoreRun(raw,profile);assert.deepEqual(r.enemies.map(e=>e.id),[42,7]);assert.equal(r.bossChoiceId,42);assert.equal(r.enemies[0].hp,0);assert.equal(r.enemies[0].pushX,0);assert.equal(r.nextId,43);assert.equal(r.hazards.length,1);assert.equal(r.hazards[0].sourceId,7);
  raw.enemies=[];assert.equal(restoreRun(raw,profile).bossChoiceId,0);
});
test('weapon restore respects consumed owners and rejects unrecognized fusion state versions',()=>{
 for(const f of fusionRecipes){const profile=initialProfile(),raw=fresh(profile);for(const [w,b]of f.needs){raw.up[w]=5;raw.branches[w]=b;}if(f.base){assert.ok(commitFusion(raw,f.base));raw.up['fusion_'+f.base]=4;}assert.ok(commitFusion(raw,f.id));raw.fusionStates[f.id].version=999;raw.fusionStates.unknown={phase:'active',clock:0};raw.shots=f.needs.map(([kind])=>({kind,x:1,y:2,life:1}));raw.arsenal.states[f.needs[0][0]]={phase:'wait',clock:1};
 const r=restoreRun(raw,profile);assert.equal(r.fusionStates.unknown,undefined);assert.equal(r.fusionStates[f.id],undefined);assert.equal(r.shots.length,0);assert.equal(r.arsenal.states[f.needs[0][0]],undefined);}
});
test('storage adapter uses one key, preserves profile identity and hydrates before run HP restoration',()=>{
  const h=adapter(),profile=h.s.profile,raw=fresh();raw.player.hp=1000;const saved=initialProfile();saved.perks.health=2;h.setText(encodeSave(saved,raw));h.storage.load();assert.equal(h.s.profile,profile);assert.equal(h.s.run.player.hp,130);assert.equal(h.messages.length,0);assert.deepEqual(h.operations,[['get',SAVE_KEY]]);assert.equal(h.storage.save(),true);assert.equal(readSave(h.getText()).v,1);assert.deepEqual(h.operations[1],['set',SAVE_KEY]);assert.equal(h.storage.clear(),true);assert.equal(h.getText(),null);assert.deepEqual(h.operations[2],['remove',SAVE_KEY]);
});
test('storage lookup failures are caught lazily and reset-idle saves never access the backend',()=>{
  const s=state(),messages=[],view={resetIdle:false};let lookups=0;const storage=createStorage({sessionState:s,view,screen:{toast:m=>messages.push(m)},backend:()=>{lookups++;throw Error('blocked');}});assert.equal(lookups,0);assert.equal(storage.save(),false);storage.load();assert.equal(storage.clear(),false);assert.equal(lookups,3);assert.equal(messages.length,3);view.resetIdle=true;assert.equal(storage.save(),true);assert.equal(lookups,3);
});
test('unsupported saves leave the session alone, malformed JSON reports failure, and absent runs clear only run',()=>{
  const h=adapter(),run=h.s.run,profile=h.s.profile;for(const value of [null,{v:2,profile:{}},{v:1}]){h.setText(JSON.stringify(value));h.storage.load();assert.equal(h.s.run,run);assert.equal(h.s.profile,profile);}assert.equal(h.messages.length,0);h.setText('{');h.storage.load();assert.equal(h.messages.length,1);assert.equal(h.s.run,run);h.setText(encodeSave(initialProfile(),null));h.storage.load();assert.equal(h.s.run,null);assert.equal(h.s.profile,profile);
});

test('resume priority is read-only and retains precedence when multiple pending events coexist',()=>{
  const r=fresh();r.finalStep=3;r.journey.keystonePending=true;r.bossChoiceId=1;r.enemies=[{id:1,kind:3,phase:3}];Object.assign(r.npc,{secretPending:true,encounterPending:true});Object.assign(r,{sitePending:true,site:{},relicPending:'coordinate',anomalyPending:true,pending:2});r.up.pulse=3;
  const steps=[['finalchoice',()=>{r.finalStep=1;}],['finalintro',()=>{r.finalStep=2;}],['keystone',()=>{r.journey.keystonePending=false;}],['secret',()=>{r.npc.secretPending=false;}],['encounter',()=>{r.npc.encounterPending=false;}],['site',()=>{r.site=null;}],['relic',()=>{r.relicPending=null;}],['anomaly',()=>{r.anomalyPending=false;}],['branch',()=>{r.branches.pulse='tracking';}],['levelup',()=>{r.pending=0;}],['playing',()=>{}]];
  for(const [expected,next]of steps){const before=structuredClone(r);assert.equal(resumeMode(r),expected);assert.deepEqual(r,before);next();}assert.equal(resumeMode(null),null);
});
test('resume creates the final core before selecting subsequent pending UI and prepares growth on demand',()=>{
  const s=state(),keys=new Set(['KeyD']),calls=[];s.run.finalStep=2;s.run.pending=1;const session=createSession({sessionState:s,view:{},platform:{keys},enemyRuntime:{spawnFinalCore:()=>calls.push('core')},progression:{choices:()=>calls.push('choices')},screen:{setMode:m=>calls.push(m)}});session.resume();assert.deepEqual(calls,['core','choices','levelup']);assert.equal(keys.size,0);
});
test('record reset leaves all state intact after failed deletion and clears only after successful deletion',()=>{
  for(const allowed of [false,true]){const s=state(),old=s.run,view={mode:'resetconfirm',lastResult:{}},keys=new Set(['KeyD']),calls=[];const session=createSession({sessionState:s,view,platform:{keys},storage:{clear:()=>{calls.push('clear');return allowed;}},screen:{setMode:m=>calls.push(m),toast:()=>calls.push('toast')}});session.resetAllRecords();assert.equal(calls[0],'clear');if(allowed){assert.equal(s.run,null);assert.equal(view.lastResult,null);assert.equal(view.resetIdle,true);assert.equal(keys.size,0);assert.deepEqual(calls,['clear','menu','toast']);}else{assert.equal(s.run,old);assert.equal(keys.size,1);assert.equal(view.resetIdle,undefined);assert.deepEqual(calls,['clear']);}}
});
test('save modules exclude browser/current-session dependencies and storage no longer calls session/statistics',()=>{
  const root=new URL('../src/',import.meta.url);for(const name of readdirSync(new URL('save/',root))){const source=readFileSync(new URL('save/'+name,root),'utf8');assert.doesNotMatch(source,/\b(?:localStorage|document|window|screen|view|platform)\b/,name);assert.doesNotMatch(source,/from ['"][^'"]*(?:state|session|storage)\.js/,name);assert.doesNotMatch(source,/from ['"][^'"]*(?:ui|render|app)\//,name);}
  const storage=readFileSync(new URL('core/storage.js',root),'utf8');assert.doesNotMatch(storage,/\bsession\.|\bdifficulty\.|\bstatistics\.|function restore(?:Run|Journey|Arsenal)/);const session=readFileSync(new URL('core/session.js',root),'utf8');assert.doesNotMatch(session,/\blocalStorage\b|\bSAVE_KEY\b/);
});
