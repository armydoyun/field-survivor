import { fusionRecipes } from '../data/fusions.js';
import { canControlLiveCombat } from '../core/view-policy.js';
import { upgrades } from '../data/upgrades.js';
import { branches } from '../data/specializations.js';

import { enemyInfo, enemyType } from '../data/enemies.js';
import { refreshBuild } from '../growth/build.js';
import { retireWeaponAttacks } from '../combat/loadout.js';
import { makeDirector } from '../core/run.js';
import { initialProfile, hydrateProfile } from '../core/profile.js';
import { encodeSave, readSave } from '../save/format.js';
import { restoreRun } from '../save/restore-run.js';
import { ENEMY_LIMIT } from '../core/config.js';

// Development commands live outside the production import graph. Never write the real storage backend.
export function createDebugCommands(context, settings) {
  const {sessionState,view,platform,statistics,session,screen,enemyRuntime,inspector,hud}=context;
  const weaponIds=branches.map(b=>b.id),undo=[],listeners=new Set();let checkpoint=null,disposed=false;
  const wrap=(object,name,handler)=>{const original=object[name];if(typeof original!=='function')return;object[name]=(...args)=>handler(original,...args);undo.push(()=>{object[name]=original;});};
  const allowed=()=>!disposed&&!view.panic;
  const run=()=>{if(!allowed()||!sessionState.run)throw Error('실험 판을 먼저 시작하세요.');return sessionState.run;};
  const number=(value,min,max)=>{const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw Error(`${min}~${max} 범위의 숫자를 입력하세요.`);return n;};
  function notify(){hud.updateHud();for(const listener of listeners)listener();}
  function resetAttacks(r){retireWeaponAttacks(r,weaponIds);r.shots=[];r.mines=[];r.beacons=[];r.arsenal.fields=[];r.arsenal.states={};r.fusionStates={};r.fusionTrail=[];r.fusionPushHits=[];for(const key of ['attackClock','novaClock','chainClock','lanceClock','mineClock','riftClock','beaconClock'])r[key]=0;inspector.beginStep();}
  function giveSkill(id,level=4,{isolate=false}={}){
    const r=run(),amount=Math.floor(number(level,1,12));let branch=null,upgrade=null,fusion=null;
    if(typeof id!=='string')throw Error('스킬 ID가 올바르지 않습니다.');
    if(id.startsWith('fusion:')||id.startsWith('fusion_')){fusion=fusionRecipes.find(f=>f.id===id.slice(7));if(!fusion)throw Error('융합 ID가 올바르지 않습니다.');}
    else if(id.startsWith('spec:')){
      const [,weapon,option]=id.split(':'),b=branches.find(b=>b.id===weapon);if(!b?.options.some(o=>o.id===option))throw Error('전문화 ID가 올바르지 않습니다.');branch={weapon,option};
    }else{upgrade=upgrades.find(u=>u.id===id);if(!upgrade)throw Error('스킬 ID가 올바르지 않습니다.');}
    if(isolate){r.up={};r.branches={};r.pending=0;r.choices=null;settings.basePulse=fusion?false:branch?branch.weapon==='pulse':!weaponIds.includes(id)||id==='pulse';}
    if(fusion){for(const [w,b]of fusion.needs){r.up[w]=5;r.branches[w]=b;}if(fusion.base)r.up['fusion_'+fusion.base]=4;r.up['fusion_'+fusion.id]=Math.min(amount,4);}
    else if(branch){
      const {weapon,option}=branch;r.up[weapon]=Math.max(3,Math.min(amount,upgrades.find(u=>u.id===weapon).max));r.branches[weapon]=option;
    }else{if(weaponIds.includes(id)){delete r.branches[id];}r.up[id]=Math.min(amount,upgrade.max);}
    resetAttacks(r);refreshBuild(r);r.choices=null;r.player.hp=Math.min(r.player.hp,statistics.stats().maxHp);if(['branch','levelup','fusion'].includes(view.mode))screen.setMode('playing');notify();return id;
  }
  function clearBuild(){const r=run();r.up={};r.branches={};r.pending=0;r.choices=null;resetAttacks(r);r.player.hp=Math.min(r.player.hp,statistics.stats().maxHp);if(['branch','levelup','fusion'].includes(view.mode))screen.setMode('playing');notify();}
  function clearThreats(){const r=run();r.enemies=[];r.bullets=[];r.hazards=[];r.bossChoiceId=0;if(r.objective?.targetId)r.objective=null;if(r.journey.active?.targetId)r.journey.active=null;r.journey.core=null;if(r.finalStep===2)r.finalStep=0;if(view.mode==='bosschoice')screen.setMode('playing');inspector.beginStep();notify();}
  function clearEffects(){const r=run();r.fx=[];r.popups=[];r.waves=[];r.arcs=[];context.feedback.tickSkillEchoes(100);notify();}
  function spawn(kind,count=1,{elite=false,distance=180,angle=0,formation='ring',hp}={}){
    const r=run(),k=Math.floor(number(kind,0,enemyType.length-1)),n=Math.floor(number(count,1,50)),d=number(distance,0,1000),a=number(angle,-3600,3600)*Math.PI/180;
    if(!['ring','line','point'].includes(formation))throw Error('배치 종류가 올바르지 않습니다.');const health=hp==null||hp===''?null:number(hp,1,1e9),created=[];
    for(let i=0;i<n&&r.enemies.length<ENEMY_LIMIT;i++){
      const e=enemyRuntime.spawnEnemy(k);if(!e)break;if(elite)enemyRuntime.promoteElite(e);
      const at=a+(formation==='ring'?i*Math.PI*2/n:0),side=formation==='line'?(i-(n-1)/2)*45:0;
      e.x=r.player.x+Math.cos(at)*d-Math.sin(at)*side;e.y=r.player.y+Math.sin(at)*d+Math.cos(at)*side;if(health!=null)e.hp=e.maxHp=health;created.push(e.id);
    }
    notify();return created;
  }
  function spawnCore(){const r=run();clearThreats();r.finalStep=2;enemyRuntime.spawnFinalCore();notify();return r.enemies.filter(e=>e.final||e.coreNode).map(e=>e.id);}
  function start(seed=42){
    if(!allowed())return false;const value=Math.floor(number(seed,0,0xffffffff));sessionState.replaceRun(session.newRun(undefined,value));view.resetIdle=false;platform.keys.clear();screen.setMode('playing');inspector.setHeld(true);notify();return value;
  }
  function setTime(value){const r=run(),time=number(value,0,7200);clearThreats();resetAttacks(r);r.time=time;r.director=makeDirector();r.invulnUntil=0;r.recoveryUntil=0;r.nextBoss=time+150;r.spawnClock=.9;r.waveIndex=time<360?0:1+Math.floor((time-360)/300);clearEffects();inspector.beginStep();notify();return time;}
  function setHp(value){run().player.hp=number(value,1,statistics.stats().maxHp);notify();}
  function hurt(value){context.combat.hurtPlayer(number(value,1,10000));notify();}
  function heal(){const r=run();r.player.hp=statistics.stats().maxHp;r.player.hurt=0;notify();}
  function teleport(x,y){const r=run(),nextX=number(x,-1e6,1e6),nextY=number(y,-1e6,1e6);r.player.x=nextX;r.player.y=nextY;context.cameraView.followCamera(0);platform.keys.clear();notify();}
  function configure(key,value){
    if(!allowed())return false;if(!Object.hasOwn(settings,key))throw Error('지원하지 않는 설정입니다.');
    settings[key]=key==='timeScale'?number(value,.1,4):!!value;if(key==='playerAttacks'&&!settings[key]&&sessionState.run)resetAttacks(sessionState.run);if(key==='basePulse'&&!settings[key]&&sessionState.run&&!sessionState.run.branches.pulse)sessionState.run.shots=sessionState.run.shots.filter(s=>s.kind!=='pulse');if(key==='choices'&&!settings[key]&&['branch','levelup'].includes(view.mode))screen.setMode('playing');notify();return settings[key];
  }
  function loadSnapshot(text){
    run();if(typeof text!=='string'||text.length>5e6)throw Error('스냅샷 크기를 확인하세요.');const data=readSave(text);if(!data)throw Error('지원하지 않는 스냅샷입니다.');
    const profile=initialProfile();hydrateProfile(profile,data.profile);const restored=restoreRun(data.run,profile);if(!restored)throw Error('복원할 수 있는 생존 중인 판이 없습니다.');
    sessionState.profile=profile;sessionState.replaceRun(restored);platform.keys.clear();screen.setMode('playing');session.resume();inspector.setHeld(true);notify();return true;
  }
  const snapshot=()=>{run();return encodeSave(sessionState.profile,sessionState.run);};
  function saveCheckpoint(){checkpoint=snapshot();return true;}
  function loadCheckpoint(){if(!checkpoint)throw Error('저장한 체크포인트가 없습니다.');return loadSnapshot(checkpoint);}
  function report(){const r=sessionState.run;return {mode:view.mode,panic:view.panic,held:inspector.held,settings:{...settings},time:r?.time||0,seed:r?.rng?.seed,hp:r?.player.hp,maxHp:r?statistics.stats().maxHp:0,regen:r?statistics.stats().regen:0,enemies:r?.enemies.length||0,shots:r?.shots.length||0,bullets:r?.bullets.length||0,fields:r?.arsenal?.fields.length||0,fx:r?.fx.length||0,waves:r?.waves.length||0,arcs:r?.arcs.length||0,effects:r?Object.values(r.fusionStates||{}).reduce((n,q)=>n+(q.effects?.length||0)+(q.visuals?.length||0),0):0,kills:r?.kills||0,level:r?.level||0,build:r?{up:{...r.up},branches:{...r.branches}}:null,checkpoint:!!checkpoint};}

  wrap(context.population,'spawnPopulation',(next,...args)=>settings.autoSpawn?next(...args):undefined);
  for(const [object,names]of [[context.weapons,['weaponTick']],[context.specializations,['specializationTick']],[context.fusions,['fusionTick']]])for(const name of names)wrap(object,name,(next,...args)=>settings.playerAttacks?next(...args):false);
  wrap(context.weapons,'fire',(next,...args)=>settings.playerAttacks&&settings.basePulse?next(...args):false);
  wrap(enemyRuntime,'moveEnemy',(next,...args)=>settings.enemyAI?next(...args):undefined);
  wrap(enemyRuntime,'tickHazards',(next,...args)=>{if(settings.hostileProjectiles)return next(...args);const r=sessionState.run;if(r){r.bullets=[];r.hazards=[];}});
  wrap(context.cameraView,'reducedMotion',(next)=>settings.reducedMotion||next());
  wrap(context.primitives,'visualDetail',(next)=>!settings.lowDetail&&next());
  wrap(context.combat,'hurtPlayer',(next,...args)=>settings.godMode?undefined:next(...args));
  wrap(context.combat,'damage',(next,...args)=>settings.blockEnemyDamage?undefined:next(...args));
  wrap(screen,'setMode',(next,mode)=>!settings.choices&&['branch','levelup'].includes(mode)?undefined:next(mode));
  for(const [object,names]of [[context.story,['spawnWitness','tickWitness','openSignal','openAnomaly']],[context.sites,['spawnSite']],[context.objectives,['spawnObjective','updateObjective']],[context.journey,['journeyTick']],[context.finale,['openFinale']]])for(const name of names)wrap(object,name,(next,...args)=>settings.worldEvents?next(...args):false);
  inspector.advance=(dt,next)=>{
    let remaining=inspector.held?1/60:dt*settings.timeScale,total=0;
    while(remaining>1e-9&&canControlLiveCombat(view)){const step=Math.min(.035,remaining);next(step);total+=step;remaining-=step;}return total;
  };
  return {giveSkill,clearBuild,clearThreats,clearEffects,spawn,spawnCore,start,setTime,setHp,hurt,heal,teleport,configure,snapshot,loadSnapshot,saveCheckpoint,loadCheckpoint,report,
    hold:value=>{if(!allowed())return false;return inspector.setHeld(value);},step:()=>{if(!allowed())return false;return inspector.requestStep();},
    resetCooldowns:()=>{resetAttacks(run());notify();},subscribe:fn=>{listeners.add(fn);return ()=>listeners.delete(fn);},
    catalog:{skills:[...fusionRecipes.map(f=>({id:'fusion:'+f.id,name:f.name+(f.base?' / '+fusionRecipes.find(b=>b.id===f.base).name:''),max:4})),...upgrades.filter(u=>!u.id.startsWith('fusion_')).map(u=>({id:u.id,name:u.name,max:u.max})),...branches.flatMap(b=>b.options.map(o=>({id:`spec:${b.id}:${o.id}`,name:`${b.name} / ${o.name}`,max:5})))],enemies:enemyInfo.map((info,kind)=>({kind,name:info[1]}))},
    dispose(){if(disposed)return;disposed=true;for(const restore of undo.reverse())restore();listeners.clear();delete inspector.advance;}
  };
}
