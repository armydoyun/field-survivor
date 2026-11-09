import { enemyType } from '../data/enemies.js';
import { ENEMY_LIMIT } from '../core/config.js';
import { clamp } from '../core/utils.js';
import { refreshSlow, advancePush } from './control.js';
import { incomingScale } from './rules.js';
import { canWindup } from './hostile-attacks.js';
import { clockFrozen, hasRelic, anomalyActive, frontEffect } from '../world/effects.js';

export function createEnemyBehavior({ stats, paceAt, movementVector, spawnEnemy, moveGuardian, moveCore, attacks, ring, hurtPlayer, random = Math.random }) {
  const { enemyShot, groundMark, enemyProjectileScale } = attacks;

  const enemyContact=(run,e) => {if(Math.hypot(run.player.x-e.x,run.player.y-e.y)<e.radius+11)hurtPlayer(Math.round(enemyType[e.kind].contact*(e.elite?1.15:1)*incomingScale(run.time)),run);};

  function eliteTick(run,e,dt,speed,distance,nx,ny){
    if(![0,1,2,6,8,9].includes(e.kind))return false;
    e.eliteClock=Math.max(0,(e.eliteClock??3)-dt);let a=e.eliteAttack;
    if(!a&&e.eliteClock<=0&&e.phase===0&&distance<420){
      const boss=run.enemies.some(x=>x.kind===3&&x.hp>0&&[1,2].includes(x.phase));
      if(!canWindup(run,e)||run.enemies.filter(x=>x.hp>0&&x.eliteAttack).length>=(boss?1:run.time<1200?2:run.time<1560?3:4)){e.eliteClock=.45+(e.id%7)*.07;return false;}
      let kind='',warn=1,duration=.2,cooldown=9,ok=true,x=run.player.x,y=run.player.y;
      const angle=Math.atan2(ny,nx);
      if(e.kind===0&&distance<220){kind='boost';warn=.7;duration=1.2;cooldown=8;}
      else if(e.kind===1&&distance<300){kind='leap';warn=.9;duration=.5;cooldown=8.5;const v=movementVector(),dx=x+v.x*60-e.x,dy=y+v.y*60-e.y,scale=Math.min(1,200/(Math.hypot(dx,dy)||1));x=e.x+dx*scale;y=e.y+dy*scale;}
      else if(e.kind===2&&distance<245){kind='cast';warn=1;duration=1.1;cooldown=9.5;ok=groundMark(run,e,e.x,e.y,190,warn,duration,14,{shape:'ring',angle:angle+(e.id%2?1:-1)*Math.PI/2,gap:Math.PI*.4,width:16});}
      else if(e.kind===6&&(e.eliteCasts||0)<2&&run.enemies.length<Math.min(ENEMY_LIMIT,paceAt(run.time).cap)){kind='brood';warn=1.1;duration=.15;cooldown=11;}
      else if(e.kind===8){let ally=null,best=260**2;for(const other of run.enemies){if(other===e||other.hp<=0||other.kind===3||other.kind===8||other.coreNode)continue;const d=(other.x-e.x)**2+(other.y-e.y)**2;if(d<best&&d>60**2){ally=other;best=d;}}if(ally){kind='cast';warn=1.1;duration=.9;cooldown=10;ok=groundMark(run,e,e.x,e.y,48,warn,duration,12,{shape:'beam',angle:Math.atan2(ally.y-e.y,ally.x-e.x),turn:0,length:Math.sqrt(best),width:20});}}
      else if(e.kind===9){kind='cast';warn=1.2;duration=1;cooldown=10;ok=groundMark(run,e,e.x,e.y,48,warn,duration,12,{shape:'beam',angle:angle-(e.id%2?1:-1)*Math.PI/6,turn:(e.id%2?1:-1)*Math.PI/3,length:290,width:20});}
      if(kind&&ok){a=e.eliteAttack={kind,x,y,sx:e.x,sy:e.y,elapsed:0,warn,duration,fired:false};e.eliteClock=cooldown;}
      else e.eliteClock=.6+(e.id%5)*.09;
    }
    if(!a)return false;
    a.elapsed+=dt*(a.kind==='leap'&&a.elapsed>=a.warn&&run.time<(e.slowUntil||0)?1-(e.slowAmount||0):1);
    if(a.elapsed<a.warn)return true;
    if(a.kind==='leap'){
      const t=Math.min(1,(a.elapsed-a.warn)/a.duration);e.x=a.sx+(a.x-a.sx)*t;e.y=a.sy+(a.y-a.sy)*t;
      if(t>=1&&!a.fired){a.fired=true;ring(a.x,a.y,42,'#f3bb80',.3,'mine',run);if(Math.hypot(run.player.x-a.x,run.player.y-a.y)<53)hurtPlayer(Math.round(14*incomingScale(run.time)),run);}
    }else if(a.kind==='boost'){const step=Math.min(dt,a.elapsed-a.warn);e.x+=nx*speed*1.55*step;e.y+=ny*speed*1.55*step;}
    else if(a.kind==='brood'&&!a.fired){a.fired=true;e.eliteCasts=(e.eliteCasts||0)+1;for(const side of [-1,1]){if(run.enemies.length>=Math.min(ENEMY_LIMIT,paceAt(run.time).cap))break;const child=spawnEnemy(run,1);Object.assign(child,{x:e.x-ny*side*24,y:e.y+nx*side*24,hp:9,maxHp:9,radius:8});}ring(e.x,e.y,38,'#e0d590',.3,undefined,run);}
    if(a.elapsed>=a.warn+a.duration){e.eliteAttack=null;e.aiTimer=Math.max(e.aiTimer,.8);}
    return true;
  }

  const seederLead=(run,e,speed) => 60+(Math.min(420,speed*(e.elite?2.05:1.8)*.9)-60)*clamp((run.time-900)/300,0,1);

  function moveEnemy(run,profile,e,dt) {
    if (e.coreNode) { e.flash = Math.max(0,(e.flash||0)-dt); return; }
    if (e.final) { moveCore(run,profile,e,dt); return; }
    if(e.phase===1||e.phase===2||e.eliteAttack)e.actionSeen=true;
    refreshSlow(e,run.time);
    if (e.kind !== 3 && (clockFrozen(run) || (hasRelic('clockwork',run) && run.time < run.relicFreezeUntil && Math.hypot(e.x - run.player.x, e.y - run.player.y) <= 225))) return;
    if(!(e.eliteAttack?.kind==='leap'&&e.eliteAttack.elapsed>=e.eliteAttack.warn))advancePush(e,dt);
    if(e.eliteAttack?.kind==='leap'&&e.eliteAttack.elapsed<e.eliteAttack.warn){e.eliteAttack.sx=e.x;e.eliteAttack.sy=e.y;}
    const p = run.player, ex = p.x - e.x, ey = p.y - e.y, distance = Math.hypot(ex, ey) || 1, nx = ex / distance, ny = ey / distance;
    const speed = e.speed * (anomalyActive('clock', 'rush',run) ? 1.12 : 1) * (run.time < (e.slowUntil || 0) ? 1 - (e.slowAmount || 0) : 1) * (frontEffect('legacy','save',run) ? 1.07 : 1);
    e.flash = Math.max(0, (e.flash || 0) - dt); e.aiTimer -= dt;
    if(e.elite&&e.kind!==3&&eliteTick(run,e,dt,speed,distance,nx,ny)){if(e.eliteAttack?.kind!=='leap')enemyContact(run,e);return;}
    if (e.kind === 3) { moveGuardian(run,profile,e,dt,speed,distance,nx,ny); return;
    } else if (e.kind === 4) {
      if(e.phase===1){if(e.aiTimer<=0){enemyShot(run,e,Math.atan2(e.dy,e.dx),205,11,5,e.elite?1.8:3,false,e.elite?{kind:'return',age:0}:null);e.phase=0;e.aiTimer=2+random()*.8;}}
      else{const toward=distance>235?1:distance<155?-1:0,side=e.id%2?1:-1;e.x+=(nx*toward-ny*side*.38)*speed*dt;e.y+=(ny*toward+nx*side*.38)*speed*dt;
        if(e.aiTimer<=0&&distance<510&&canWindup(run,e)){e.phase=1;e.shotScale=enemyProjectileScale(run);e.aiTimer=e.elite?.85:.65;e.dx=nx;e.dy=ny;}}
    } else if (e.kind === 5) {
      if (e.phase === 1) { if (e.aiTimer <= 0) { e.phase = 2; e.aiTimer = 0.36; } }
      else if (e.phase === 2) { const slow=run.time<(e.slowUntil||0)?1-(e.slowAmount||0):1;e.x += e.dx * 390 * slow * dt; e.y += e.dy * 390 * slow * dt; if (e.aiTimer <= 0) { if(e.elite)groundMark(run,e,e.x,e.y,125,.8,.95,14,{shape:'ring',angle:Math.atan2(e.dy,e.dx)+Math.PI,gap:Math.PI*.4,width:16});e.phase = 0; e.aiTimer = e.elite?3.2:2.5; } }
      else { e.x += nx * speed * dt; e.y += ny * speed * dt; if (e.aiTimer <= 0 && distance < 310 && canWindup(run,e)) { e.phase = 1; e.aiTimer = 0.65; e.dx = nx; e.dy = ny; } }
    } else if (e.kind === 7) {
      const side = e.id % 2 ? 1 : -1;
      if (e.phase === 1) { if (e.aiTimer <= 0) { if(e.elite){const a=Math.atan2(e.dy,e.dx);for(const side of [-1,1])enemyShot(run,e,a+side*.75,200,10,4.5,2.5,false,{kind:'arc',turn:-side*1.1,age:0});e.phase=0;e.aiTimer=3.8;}else{e.phase = 2; e.aiTimer = 0.4;} } }
      else if (e.phase === 2) { const slow = run.time < (e.slowUntil || 0) ? 1 - (e.slowAmount || 0) : 1; e.x += e.dx * 380 * slow * dt; e.y += e.dy * 380 * slow * dt; if (e.aiTimer <= 0) { e.phase = 0; e.aiTimer = 2.6; } }
      else {
        const toward = distance > 260 ? 1 : distance < 170 ? -0.35 : 0.12;
        e.x += (nx * toward - ny * side * 0.88) * speed * dt; e.y += (ny * toward + nx * side * 0.88) * speed * dt;
        if (e.aiTimer <= 0 && distance < 320 && canWindup(run,e)) { const a = Math.hypot(nx - ny * side * 0.55, ny + nx * side * 0.55); e.dx = (nx - ny * side * 0.55) / a; e.dy = (ny + nx * side * 0.55) / a; e.phase = 1; e.shotScale=enemyProjectileScale(run);e.aiTimer = e.elite?.9:0.6; }
      }
    } else if (e.kind === 8) {
      let ally = null, best = 330 * 330;
      for (const other of run.enemies) { if (other === e || other.hp <= 0 || other.kind === 3 || other.kind === 8) continue; const d = (other.x - e.x) ** 2 + (other.y - e.y) ** 2; if (d < best) { ally = other; best = d; } }
      const tx = ally ? ally.x - nx * 68 : p.x, ty = ally ? ally.y - ny * 68 : p.y, ax = tx - e.x, ay = ty - e.y, length = Math.hypot(ax, ay);
      if (length > 22) { e.x += ax / length * speed * dt; e.y += ay / length * speed * dt; }
      if (distance < 145) { e.x -= nx * speed * 0.65 * dt; e.y -= ny * speed * 0.65 * dt; }
    } else if (e.kind === 9) {
      const toward = distance > 350 ? 1 : distance < 250 ? -0.7 : 0, side = e.id % 2 ? 1 : -1;
      if (e.phase === 1 && e.aiTimer <= 0) {
        const a = Math.atan2(e.dy, e.dx);
        for (const offset of [-.2,0,.2]) enemyShot(run,e,a+offset,195,9,4.5,3.1);
        e.phase = 0; e.aiTimer = 3 + random() * 0.7;
      } else if (e.phase === 0) {
        e.x += (nx * toward - ny * side * 0.25) * speed * dt; e.y += (ny * toward + nx * side * 0.25) * speed * dt;
        if (e.aiTimer <= 0 && distance < 510 && canWindup(run,e)) { e.phase = 1; e.shotScale=enemyProjectileScale(run);e.aiTimer = 0.75; e.dx = nx; e.dy = ny; }
      }
    } else if(e.kind===10){
      if(e.phase===1){if(e.aiTimer<=0){groundMark(run,e,e.markX,e.markY,e.elite?46:48,e.elite?1.3:1.25,e.elite?1.8:2.1,12);if(e.elite)groundMark(run,e,e.markX-e.dx*100,e.markY-e.dy*100,46,1.65,1.8,12);e.phase=0;e.aiTimer=e.elite?7:5.4;}}
      else{const toward=distance>320?1:distance<235?-.55:0;e.x+=nx*toward*speed*dt;e.y+=ny*toward*speed*dt;
        if(e.aiTimer<=0&&distance<500&&canWindup(run,e)&&run.hazards.filter(h=>!h.boss).length<3){const v=movementVector(),lead=seederLead(run,e,stats(run).speed);e.markX=p.x+v.x*lead;e.markY=p.y+v.y*lead;e.dx=v.x||nx;e.dy=v.y||ny;if(v.x||v.y){e.dx=v.x;e.dy=v.y;}e.phase=1;e.aiTimer=e.elite?.75:.55;}}
    } else { e.x += nx * speed * dt; e.y += ny * speed * dt; }
    enemyContact(run,e);
  }

  return { enemyContact, eliteTick, seederLead, moveEnemy };
}
