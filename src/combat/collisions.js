import { orbitPush } from './weapon-parameters.js';
import { specialized } from '../growth/build.js';
import { targetable, incomingScale } from './rules.js';
import { pushEnemy, applySlow } from './control.js';
import { segmentEntry, segmentHit } from '../math/geometry.js';
import { advanceEnemyBullet } from './hostile-attacks.js';
import { anomalyActive, frontEffect } from '../world/effects.js';

// Own contact and projectile resolution; app/update.js keeps only execution order.
export function createCollisions({ sessionState, view, statistics, enemyRuntime, weapons, combat, feedback, inspector }) {
  function tickEnemies(dt,s){
    const p=sessionState.run.player;
    for (const e of sessionState.run.enemies) {
      if (e.hp <= 0) continue;
      enemyRuntime.moveEnemy(e, dt);
      if (s.orbit && !specialized('orbit',sessionState.run) && targetable(e,sessionState.run) && sessionState.run.time >= e.orbitHitAt) {
        for (let i = 0; i < s.orbit; i++) { const a = sessionState.run.time * 3 + i * Math.PI * 2 / s.orbit, ox = p.x + Math.cos(a) * s.orbitRadius - e.x, oy = p.y + Math.sin(a) * s.orbitRadius - e.y;
          inspector?.circle(ox+e.x,oy+e.y,8,'orbit');if (ox * ox + oy * oy < (e.radius + 8) ** 2) {  if (sessionState.run.waves.length < 24) feedback.ring(e.x, e.y, e.radius + 7, '#d6c4e2', .15); combat.damage(e, statistics.weaponDamage('orbit', s)); pushEnemy(e, p.x, p.y, orbitPush(s)); e.orbitHitAt = sessionState.run.time + 0.38; break; }
        }
      }
    }
  }

  function tickShots(dt,s){
    for (let i = sessionState.run.shots.length - 1; i >= 0; i--) {
      const shot = sessionState.run.shots[i], oldX = shot.x, oldY = shot.y; shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      const minX = Math.min(oldX,shot.x)-shot.radius, maxX = Math.max(oldX,shot.x)+shot.radius, minY = Math.min(oldY,shot.y)-shot.radius, maxY = Math.max(oldY,shot.y)+shot.radius, contacts = [];
      for (const e of sessionState.run.enemies) {
        if (!targetable(e,sessionState.run) || e.x+e.radius<minX || e.x-e.radius>maxX || e.y+e.radius<minY || e.y-e.radius>maxY || shot.hit.includes(e.id)) continue;
        const t = segmentEntry(oldX,oldY,shot.x,shot.y,e.x,e.y,e.radius+shot.radius); if (Number.isFinite(t)) contacts.push({ e, t });
      }
      inspector?.segment(oldX,oldY,shot.x,shot.y,shot.radius,shot.kind);contacts.sort((a,b) => a.t-b.t || a.e.id-b.e.id);
      for (const { e } of contacts) {
        if (targetable(e,sessionState.run) && segmentHit(oldX,oldY,shot.x,shot.y,e.x,e.y,e.radius+shot.radius)) {
          shot.hit.push(e.id); 

          if (shot.cold && s.frost) applySlow(e, Math.min(0.6, s.frost * 0.12), 1 + s.frost * 0.3,sessionState.run.time); if (shot.kind === 'lance' && sessionState.run.waves.length < 26) feedback.ring(e.x, e.y, e.radius + 10, '#f4c69e', .14); combat.damage(e, shot.kind === 'pulse' ? shot.damage * Math.pow(.87, shot.hit.length - 1) : shot.damage, shot.crit, shot.vx, shot.vy, shot.kind === 'burst' ? shot.burstDepth || 1 : 0);  shot.pierce--; if (shot.pierce <= 0 || view.mode !== 'playing') break;
        }
      }
      if (view.mode !== 'playing') return false;
      if (shot.pierce <= 0 || shot.life <= 0) sessionState.run.shots.splice(i, 1);
    }
    return true;
  }

  function tickBullets(dt,s){
    const p=sessionState.run.player;
    for (let i = sessionState.run.bullets.length - 1; i >= 0; i--) {
      const b = sessionState.run.bullets[i], x = b.x, y = b.y; advanceEnemyBullet(b,dt); b.life -= dt;
      if (weapons.blockProjectile(b, x, y, s)) { sessionState.run.bullets.splice(i, 1); continue; }
      if (anomalyActive('border', 'ward',sessionState.run) && sessionState.run.time >= sessionState.run.anomalyWardAt && Math.hypot(b.x - p.x, b.y - p.y) < 125) {
        sessionState.run.anomalyWardAt = sessionState.run.time + 16; feedback.burst(b.x, b.y, '#a7e1e8', 9); feedback.popup(b.x, b.y, 'WARD', '#a7e1e8'); sessionState.run.bullets.splice(i, 1); continue;
      }
      inspector?.segment(x,y,b.x,b.y,b.radius,'bullet','hostile');const hit = segmentHit(x, y, b.x, b.y, p.x, p.y, 12 + b.radius);
      if (hit) combat.hurtPlayer(Math.round(b.damage * incomingScale(sessionState.run.time) * (b.boss && frontEffect('threshold','expose',sessionState.run) ? 1.12 : 1)));
      if (hit || b.life <= 0) sessionState.run.bullets.splice(i, 1);
    }
  }

  return { tickEnemies, tickShots, tickBullets };
}
