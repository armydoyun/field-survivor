import { episodeTitle } from './effects.js';
import { episodeKinds } from '../data/world.js';
import { ENEMY_LIMIT, DESPAWN_RADIUS, RUN_END } from '../core/config.js';
import { branchReady } from '../growth/build.js';
import { keystones } from '../data/progression.js';

export function createJourney({ sessionState, view, platform, progression, session, storage, screen, enemyRuntime, difficulty, statistics }) {
  const { keys } = platform;

  function markJourneyKill(r,enemy){if(r.journey.active?.targetId===enemy.id)r.journey.active.targetDead=true;}

  function resolveEpisode(success) {
    const j=sessionState.run.journey,a=j.active;if(!a||a.slot!==j.step)return;
    j.outcomes.push({slot:a.slot,kind:a.kind,success});j.step++;j.active=null;
    if(success){sessionState.run.gold+=120+a.slot*80;progression.collect(180+a.slot*100);}
    session.record(`${episodeTitle(a.kind)} · ${success?'신호가 끝까지 이어졌다.':'연결이 끊어졌다.'}`);storage.save();
  }

  function journeyTick(dt) {
    const j=sessionState.run.journey,p=sessionState.run.player;
    if(sessionState.run.finalStep)return false;
    if(j.keystonePending){screen.setMode('keystone');return true;}
    if(!j.active&&j.step<4&&sessionState.run.time>=j.plan[j.step].at){
      if(sessionState.run.time>=j.plan[j.step].at+85){j.step++;return false;}
      const plan=j.plan[j.step];let kind=plan.kind;
      if(j.step===1&&sessionState.run.siteDecisions.coordinate==='take')kind=episodeKinds[(episodeKinds.indexOf(kind)+1)%3];
      if(j.step===3&&j.outcomes.some(x=>x.slot===1&&x.kind===kind))kind=episodeKinds[(episodeKinds.indexOf(kind)+1)%3];
      if(kind==='hunt'&&sessionState.run.enemies.length>=ENEMY_LIMIT)return false;
      if(kind==='witness')kind=sessionState.run.npc.state==='heard'?'relay':sessionState.run.npc.state==='taken'?'hunt':'gates';
      if(kind==='guardian')kind=sessionState.run.guardianOrder==='spare'?'relay':sessionState.run.guardianOrder==='end'?'hunt':'gates';
      const a=j.active={slot:j.step,kind,x:p.x+190,y:p.y,baseX:p.x+190,baseY:p.y,start:sessionState.run.time,until:sessionState.run.time+85,reinforce:sessionState.run.time+7,charge:0,gate:0,targetId:0,targetDead:false};
      if(kind==='hunt'&&sessionState.run.enemies.length<ENEMY_LIMIT){const e=enemyRuntime.spawnEnemy(j.step===2?9:7);enemyRuntime.promoteElite(e);e.hp=e.maxHp=Math.round(150*difficulty.paceAt(sessionState.run.time).hp);e.x=a.x;e.y=a.y;a.targetId=e.id;}
      session.record(`${episodeTitle(kind)} · ${j.step===0?(sessionState.run.npc.state==='taken'?'익숙한 목소리가 잔해 안에서 울린다.':'이름 없는 응답이 뒤따라왔다.'):j.step===2?(sessionState.run.guardianOrder==='end'?'부서진 명령들이 한곳으로 모인다.':'감시자의 명령이 새로운 좌표를 가리킨다.'):'벌판 아래에서 좌표가 떠올랐다.'}`);storage.save();
    }
    const a=j.active;
    if(a){
      if(sessionState.run.time>=a.until){resolveEpisode(false);return false;}
      if(a.kind==='hunt'){
        if(a.targetDead){resolveEpisode(true);return false;}
        const e=sessionState.run.enemies.find(e=>e.id===a.targetId&&e.hp>0);
        if(!e){resolveEpisode(false);return false;}
        const d=Math.hypot(e.x-p.x,e.y-p.y);if(d>DESPAWN_RADIUS){e.x=p.x+(e.x-p.x)/d*620;e.y=p.y+(e.y-p.y)/d*620;}
        a.x=e.x;a.y=e.y;
      } else {
        if(a.kind==='relay'){a.x=a.baseX+Math.sin((sessionState.run.time-a.start)*.12)*110;a.y=a.baseY+(sessionState.run.time-a.start)*2;}
        const radius=a.kind==='relay'?88:54;if(Math.hypot(p.x-a.x,p.y-a.y)<radius)a.charge+=dt;
        if(a.charge>=(a.kind==='relay'?14:3)){
          if(a.kind==='gates'&&a.gate<2){a.gate++;a.charge=0;a.x=a.baseX+(a.gate%2?-240:140);a.y=a.baseY+(a.gate===1?100:-110);}else{resolveEpisode(true);return false;}
        }
      }
      if(sessionState.run.time>=a.reinforce){a.reinforce=sessionState.run.time+7;for(let i=0;i<2&&sessionState.run.enemies.length<ENEMY_LIMIT;i++){const e=enemyRuntime.spawnEnemy(a.kind==='gates'?9:1);const angle=(a.gate+i)*Math.PI+sessionState.run.time*.4;e.x=a.x+Math.cos(angle)*260;e.y=a.y+Math.sin(angle)*260;}}
    }
    if(!j.active&&!j.keystone&&sessionState.run.time>=1290&&sessionState.run.time<RUN_END&&!sessionState.run.pending&&!branchReady(sessionState.run)){j.keystonePending=true;keys.clear();screen.setMode('keystone');storage.save();return true;}
    return false;
  }

  function keystoneOptions(){return keystones.slice(0,3).map((k,i)=>({k,i,score:k.weapons.reduce((s,w)=>s+(sessionState.run.up[w]||0)+(w==='pulse'?1:0),0)})).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,2).map(x=>x.k).concat(keystones[3]);}

  function chooseKeystone(id){if(view.mode!=='keystone'||!sessionState.run?.journey.keystonePending||!keystoneOptions().some(x=>x.id===id))return;sessionState.run.journey.keystone=id;sessionState.run.journey.keystonePending=false;sessionState.run.player.hp=Math.min(sessionState.run.player.hp,statistics.maxHpFor(sessionState.run));session.record(`남은 자리 · ${keystones.find(x=>x.id===id).name}`);session.resume();storage.save();}

  return { markJourneyKill, episodeTitle, journeyTick, keystoneOptions, chooseKeystone, resolveEpisode };
}
