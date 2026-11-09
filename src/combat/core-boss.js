import { refreshSlow } from './control.js';
import { hazardHit } from '../math/geometry.js';
import { incomingScale } from './rules.js';
import { frontEffect } from '../world/effects.js';
import { appendRecord } from '../core/profile.js';

export function createCoreBoss({ spawnEnemy, finalRating, hurtPlayer }) {
  function ensureCore(run,_profile){
    const j=run.journey;if(j.core)return j.core;
    const rating=finalRating(run);j.core={phase:0,cycle:0,next:run.time+1.4,attack:null,power:rating.power,nodeHp:rating.nodeHp};
    const count=run.guardianOrder==='end'?3:2,salvaged=j.outcomes.some(x=>x.slot===2&&x.success);for(let i=0;i<count;i++){const a=i*Math.PI*2/count,node=spawnEnemy(run,8);node.coreNode=true;node.x=run.player.x+Math.cos(a)*155;node.y=run.player.y+Math.sin(a)*155;node.hp=node.maxHp=Math.round(j.core.nodeHp*(count===3?(salvaged?.65:.8):1));node.radius=20;node.speed=1;}
    return j.core;
  }

  function moveCore(run,profile,e,dt){
    if(e.phase===3)return;refreshSlow(e,run.time);const c=ensureCore(run,profile),p=run.player;e.flash=Math.max(0,(e.flash||0)-dt);
    if(!c.phase&&!run.enemies.some(x=>x.coreNode&&x.hp>0)){c.phase=1;c.attack=null;c.next=run.time+1;appendRecord(profile,run,'중심핵 · 바깥의 고리가 멎었다.');}
    const d=Math.hypot(p.x-e.x,p.y-e.y)||1, speed=24*(run.time<(e.slowUntil||0)?1-(e.slowAmount||0):1);if(d>160){e.x+=(p.x-e.x)/d*speed*dt;e.y+=(p.y-e.y)/d*speed*dt;}
    if(c.attack){const a=c.attack;e.phase=run.time<a.fireAt?1:4;
      if(run.time>=a.fireAt&&run.time<=a.endAt){const dx=p.x-a.x,dy=p.y-a.y,co=Math.cos(a.angle),si=Math.sin(a.angle),x=dx*co+dy*si,y=-dx*si+dy*co;
        const hit=a.kind==='sweep'?hazardHit({...a,shape:'beam'},p,run.time):a.kind==='ring'?Math.abs(Math.hypot(dx,dy)-110)<23:Math.abs(x)<23||Math.abs(y)<23;
        if(hit)hurtPlayer(Math.round((c.phase?18:14)*incomingScale(run.time)*(frontEffect('threshold','expose',run)?1.12:1)),run);
      }
      if(run.time>a.endAt){c.attack=null;c.next=run.time+(c.phase?.95:1.8)+(run.objectiveOutcomes.relay==='complete'?.32:0);}
    } else if(run.time>=c.next){const tell=1.1+(frontEffect('threshold','shield',run)?.28:0)+(run.objectiveOutcomes.courier==='complete'?.23:0),pool=c.phase?['cross','ring','sweep']:['cross','ring'],kind=pool[c.cycle++%pool.length],sweep=kind==='sweep';c.attack={kind,x:sweep?e.x:p.x,y:sweep?e.y:p.y,angle:sweep?Math.atan2(p.y-e.y,p.x-e.x)-Math.PI/4:run.guardianOrder==='end'?Math.PI/4:0,turn:sweep?Math.PI/2:0,length:400,width:24,fireAt:run.time+tell,endAt:run.time+tell+(sweep?.9:.24)};e.phase=1;}
    if(Math.hypot(p.x-e.x,p.y-e.y)<e.radius+11)hurtPlayer(Math.round(29*incomingScale(run.time)),run);
  }

  function spawnFinalCore(run,profile) {
    if (!run || run.finalStep !== 2 || run.enemies.some(e => e.final && e.hp > 0)) return;
    const e = spawnEnemy(run,3); e.final = true; e.maxHp = e.hp = finalRating(run).hp; e.radius = 42;
    e.speed *= 1.25; e.aiTimer = 1.2; e.phase = 1; e.bossCycle = 0;
    e.x = run.player.x + 340; e.y = run.player.y;ensureCore(run,profile);
  }

  return { ensureCore, moveCore, spawnFinalCore };
}
