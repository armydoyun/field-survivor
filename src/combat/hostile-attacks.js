import { hazardHit } from '../math/geometry.js';
import { incomingScale } from './rules.js';
import { anomalyActive } from '../world/effects.js';

function advanceEnemyBullet(b,dt){
  let rest=dt;const age=b.age||0;
  if(b.kind==='return'&&age<.85){const t=Math.min(rest,.85-age);b.x+=b.vx*t;b.y+=b.vy*t;rest-=t;if(age+dt>=.85){b.vx=-b.vx;b.vy=-b.vy;}}
  if(b.kind==='arc'&&age<1){const t=Math.min(rest,1-age),w=b.turn||0;if(Math.abs(w)>.001){const a=Math.atan2(b.vy,b.vx),speed=Math.hypot(b.vx,b.vy),next=a+w*t;b.x+=speed*(Math.sin(next)-Math.sin(a))/w;b.y+=speed*(Math.cos(a)-Math.cos(next))/w;b.vx=Math.cos(next)*speed;b.vy=Math.sin(next)*speed;}else{b.x+=b.vx*t;b.y+=b.vy*t;}rest-=t;}
  b.x+=b.vx*rest;b.y+=b.vy*rest;if(b.kind)b.age=age+dt;
}

function canWindup(run,e) {
  const boss=run.enemies.some(x=>x.kind===3&&x.hp>0&&(x.phase===1||x.phase===2)),limit=boss?2:run.time<600?3:run.time<1200?4:run.time<1560?5:6;
  return run.enemies.filter(x=>x!==e&&x.hp>0&&(x.eliteAttack||([4,5,7,9,10].includes(x.kind)&&(x.phase===1||([5,7].includes(x.kind)&&x.phase===2))))).length<limit;
}

export { advanceEnemyBullet, canWindup };

export function createHostileAttacks({ lateCombat, pressureProfile, hurtPlayer, inspector }) {
  const enemyProjectileScale=(run) => (1+lateCombat(run)*.22)*pressureProfile(run).shot*(anomalyActive('border','harvest',run)?1.2:1);

  const shotScaleFor=(run,e) => e.shotScale??enemyProjectileScale(run);

  function enemyShot(run,e,angle,speed,damage,radius=5,life=3,boss=false,extra=null) {
    if(run.bullets.length>=(boss?100:70))return false;
    const scale=shotScaleFor(run,e);
    run.bullets.push({x:e.x,y:e.y,vx:Math.cos(angle)*speed*scale,vy:Math.sin(angle)*speed*scale,radius,damage:damage*(e.elite&&!boss?1.1:1),life,boss,...extra});return true;
  }

  function groundMark(run,e,x,y,radius,delay,duration,damage,extra=null) {
    if(run.hazards.length>=6)return false;
    if(e.kind!==3&&run.hazards.filter(h=>!h.boss).length>=3)return false;
    run.hazards.push({sourceId:e.id,boss:e.kind===3,x,y,radius,fireAt:run.time+delay,endAt:run.time+delay+duration,damage,...extra});return true;
  }

  function tickHazards(run) {
    const p=run.player;
    run.hazards=run.hazards.filter(h=>h.endAt>run.time&&run.enemies.some(e=>e.id===h.sourceId&&e.hp>0&&!(e.kind===3&&e.phase===3)));
    for(const h of run.hazards)if(run.time>=h.fireAt){inspector?.hazard(h,run.time);if(hazardHit(h,p,run.time))hurtPlayer(Math.round(h.damage*incomingScale(run.time)),run);}
  }

  return { enemyProjectileScale, shotScaleFor, enemyShot, groundMark, tickHazards };
}
