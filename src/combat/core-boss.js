import { refreshSlow } from './control.js';
import { hazardHit } from '../math/geometry.js';
import { incomingScale } from './rules.js';
import { appendRecord } from '../core/profile.js';
import { coreLines } from '../data/world.js';

// 결말 전투 회수(NARRATIVE-REDESIGN.md 5절). 이번 판의 선택이 중심핵 전투를 바꾼다.
//   돌려보낸 감시자 1회당 방패 1개(최대 3): 중심핵 공격 1회를 막는다.
//   분해한 감시자 1회당 연결점 1개 추가(기본 2, 최대 5).
//   태운 신호 1개당 중심핵 HP +6%, 2개 이상이면 2단계에 '목소리' 공격 추가. 기억한 신호 1개당 2단계 진입 시 HP 15 회복.
//   기록원을 들었다면 2단계 공격 예고 +0.3초.
export const CORE_PAYOFF = Object.freeze({ maxShields: 3, baseNodes: 2, maxNodes: 5, burnHp: .06, voiceAt: 2, heardHeal: 15, witnessTell: .3 });
const burned = run => (run.signalChoices || []).filter(x => x === 'burn').length;
const heard = run => (run.signalChoices || []).filter(x => x === 'hear').length;
export const coreHpScale = run => 1 + CORE_PAYOFF.burnHp * burned(run);

export function createCoreBoss({ spawnEnemy, finalRating, hurtPlayer, healPlayer = () => {} }) {
  function ensureCore(run,profile){
    const j=run.journey;if(j.core)return j.core;
    const rating=finalRating(run),fate=run.guardianFate||{spare:0,end:0};j.core={phase:0,cycle:0,next:run.time+1.4,attack:null,power:rating.power,nodeHp:rating.nodeHp,shields:Math.min(CORE_PAYOFF.maxShields,fate.spare)};
    const count=Math.min(CORE_PAYOFF.maxNodes,CORE_PAYOFF.baseNodes+fate.end),salvaged=j.outcomes.some(x=>x.slot===2&&x.success);for(let i=0;i<count;i++){const a=i*Math.PI*2/count,node=spawnEnemy(run,8);node.coreNode=true;node.x=run.player.x+Math.cos(a)*155;node.y=run.player.y+Math.sin(a)*155;node.hp=node.maxHp=Math.round(j.core.nodeHp*(count>CORE_PAYOFF.baseNodes?(salvaged?.65:.8):1));node.radius=20;node.speed=1;}
    if(j.core.shields)appendRecord(profile,run,coreLines.shields);if(fate.end)appendRecord(profile,run,coreLines.shells);
    return j.core;
  }

  function moveCore(run,profile,e,dt){
    if(e.phase===3)return;refreshSlow(e,run.time);const c=ensureCore(run,profile),p=run.player;e.flash=Math.max(0,(e.flash||0)-dt);
    if(!c.phase&&!run.enemies.some(x=>x.coreNode&&x.hp>0)){c.phase=1;c.attack=null;c.next=run.time+1;appendRecord(profile,run,'중심핵 · 바깥의 고리가 멎었다.');
      if(heard(run)){healPlayer(CORE_PAYOFF.heardHeal*heard(run),run);appendRecord(profile,run,coreLines.heard);}
      if(run.npc?.state==='heard')appendRecord(profile,run,coreLines.witness);else if(run.npc?.state==='taken')appendRecord(profile,run,coreLines.taken);
      if(burned(run)>=CORE_PAYOFF.voiceAt)appendRecord(profile,run,coreLines.voice);}
    const d=Math.hypot(p.x-e.x,p.y-e.y)||1, speed=24*(run.time<(e.slowUntil||0)?1-(e.slowAmount||0):1);if(d>160){e.x+=(p.x-e.x)/d*speed*dt;e.y+=(p.y-e.y)/d*speed*dt;}
    if(c.attack){const a=c.attack;e.phase=run.time<a.fireAt?1:4;
      if(run.time>=a.fireAt&&run.time<=a.endAt){const dx=p.x-a.x,dy=p.y-a.y,co=Math.cos(a.angle),si=Math.sin(a.angle),x=dx*co+dy*si,y=-dx*si+dy*co;
        const hit=!a.blocked&&(a.kind==='sweep'?hazardHit({...a,shape:'beam'},p,run.time):a.kind==='ring'?Math.abs(Math.hypot(dx,dy)-110)<23:a.kind==='voice'?Math.abs(Math.hypot(dx,dy)-70)<23||Math.abs(Math.hypot(dx,dy)-150)<23:Math.abs(x)<23||Math.abs(y)<23);
        if(hit&&c.shields>0){c.shields--;a.blocked=true;appendRecord(profile,run,coreLines.blocked.replace('{left}',c.shields));}
        else if(hit)hurtPlayer(Math.round((c.phase?18:14)*incomingScale(run.time)),run);
      }
      if(run.time>a.endAt){c.attack=null;c.next=run.time+(c.phase?.95:1.8)+(run.objectiveOutcomes.relay==='complete'?.32:0);}
    } else if(run.time>=c.next){const tell=1.1+(run.objectiveOutcomes.courier==='complete'?.23:0)+(c.phase&&run.npc?.state==='heard'?CORE_PAYOFF.witnessTell:0),pool=c.phase?(burned(run)>=CORE_PAYOFF.voiceAt?['cross','ring','sweep','voice']:['cross','ring','sweep']):['cross','ring'],kind=pool[c.cycle++%pool.length],sweep=kind==='sweep';c.attack={kind,x:sweep?e.x:p.x,y:sweep?e.y:p.y,angle:sweep?Math.atan2(p.y-e.y,p.x-e.x)-Math.PI/4:run.guardianOrder==='end'?Math.PI/4:0,turn:sweep?Math.PI/2:0,length:400,width:24,fireAt:run.time+tell,endAt:run.time+tell+(sweep?.9:.24)};e.phase=1;}
    if(Math.hypot(p.x-e.x,p.y-e.y)<e.radius+11)hurtPlayer(Math.round(29*incomingScale(run.time)),run);
  }

  function spawnFinalCore(run,profile) {
    if (!run || run.finalStep !== 2 || run.enemies.some(e => e.final && e.hp > 0)) return;
    const e = spawnEnemy(run,3); e.final = true; e.maxHp = e.hp = Math.round(finalRating(run).hp * coreHpScale(run)); e.radius = 42;
    e.speed *= 1.25; e.aiTimer = 1.2; e.phase = 1; e.bossCycle = 0;
    e.x = run.player.x + 340; e.y = run.player.y;ensureCore(run,profile);
  }

  return { ensureCore, moveCore, spawnFinalCore };
}
