import { runRandom } from '../core/random.js';
import { chainReach, beaconRange, beaconInterval, lanceRadius } from './weapon-parameters.js';
import { targetable } from './rules.js';
import { nearestEnemyIn, nearestEnemy } from './targeting.js';
import { segmentHit } from '../math/geometry.js';
import { applySlow, pushEnemy } from './control.js';
import { specialized, weaponConsumed, pulseActive } from '../growth/build.js';
import { hasRelic } from '../world/effects.js';

export function createWeapons({ sessionState, view, statistics, feedback, cameraView, combat, inspector }) {
  function explodeMine(mine, s) {
    const radius=statistics.mineRadius(s),color='#e4ad8c'; inspector?.circle(mine.x,mine.y,radius,'mine'); feedback.ring(mine.x,mine.y,radius,color,.34,'mine');
    if (Math.hypot(mine.x - sessionState.run.player.x, mine.y - sessionState.run.player.y) < 260) cameraView.cameraKick(.44);
    for (const e of sessionState.run.enemies) if (targetable(e,sessionState.run) && Math.hypot(e.x - mine.x, e.y - mine.y) <= radius + e.radius) combat.damage(e, statistics.weaponDamage('mine', s));
    feedback.burst(mine.x,mine.y,color,9);
  }
  function skillTick(dt, s) {
    const p = sessionState.run.player;
    if (s.rift && (sessionState.run.riftClock -= dt) <= 0) {
      const first = nearestEnemyIn(sessionState.run,statistics.riftLength(s));
      if (first) {
        const base = Math.atan2(first.y - p.y, first.x - p.x), length = statistics.riftLength(s), dmg = statistics.weaponDamage('rift',s);
        for (const offset of [-.28,0,.28]) {
          const a = base + offset, x = p.x + Math.cos(a) * length, y = p.y + Math.sin(a) * length;
          if (sessionState.run.arcs.length < 90) sessionState.run.arcs.push({ x1: p.x, y1: p.y, x2:x, y2:y, kind:'rift', life:.35, max:.35 });
          inspector?.segment(p.x,p.y,x,y,10,'rift');
          for (const e of sessionState.run.enemies) if (targetable(e,sessionState.run) && segmentHit(p.x,p.y,x,y,e.x,e.y,e.radius+10)) { combat.damage(e,dmg * (offset ? .68 : 1)); }
        }
        feedback.ring(p.x,p.y,32,'#e7b7fa',.26); sessionState.run.riftClock = statistics.riftInterval(s);
      }
      else sessionState.run.riftClock = .15;
    }
    if (s.beacon && (sessionState.run.beaconClock -= dt) <= 0) {
      if (sessionState.run.beacons.length >= 2) {const old=sessionState.run.beacons.shift();feedback.addSkillEcho('circle',{x:old.x,y:old.y,radius:9,color:'#a3dbf6'});}
      sessionState.run.beacons.push({x:p.x,y:p.y,life:11,clock:.2}); feedback.ring(p.x,p.y,24,'#a2e4ff',.25); sessionState.run.beaconClock = beaconInterval(s);
    }
    for (let i=sessionState.run.beacons.length-1;i>=0;i--) {
      const b=sessionState.run.beacons[i]; b.life-=dt;
      if (b.life<=0) {feedback.addSkillEcho('circle',{x:b.x,y:b.y,radius:9,color:'#a3dbf6'});sessionState.run.beacons.splice(i,1); continue; }
      if ((b.clock-=dt)>0) continue;
      const range = (beaconRange(s)), target = nearestEnemyIn(sessionState.run,range,b.x,b.y);
      if (!target) { b.clock=.18; continue; }
      if(sessionState.run.shots.length<250){
        const a=Math.atan2(target.y-b.y,target.x-b.x);
        sessionState.run.shots.push({kind:'beacon',x:b.x,y:b.y,vx:Math.cos(a)*570,vy:Math.sin(a)*570,damage:statistics.weaponDamage('beacon',s),crit:false,radius:4,life:1.15,pierce:1,hit:[],cold:s.frost>0});
      }
      feedback.ring(b.x,b.y,15,'#99dbe6',.19); b.clock=statistics.beaconShotInterval(s);
    }
    if (s.lance && (sessionState.run.lanceClock -= dt) <= 0) {
      const target = nearestEnemy(sessionState.run);
      if (target && sessionState.run.shots.length < 250) {
        const a = Math.atan2(target.y - p.y, target.x - p.x);
        sessionState.run.shots.push({ kind: 'lance', x: p.x, y: p.y, vx: Math.cos(a) * 690, vy: Math.sin(a) * 690, damage: statistics.weaponDamage('lance', s), crit: false, radius: lanceRadius(s), life: 1.05, pierce: statistics.lanceTargets(s), hit: [], cold: false });
        sessionState.run.lanceClock = statistics.lanceInterval(s);
      }
      else sessionState.run.lanceClock = 0.18;
    }
    if (s.mine && (sessionState.run.mineClock -= dt) <= 0) {
      const target = s.placement ? nearestEnemyIn(sessionState.run,300) : null, d = target ? Math.hypot(target.x-p.x,target.y-p.y) || 1 : 1, offset = Math.min(d*.7, 50+s.placement*20);
      const x = target ? p.x+(target.x-p.x)/d*offset : p.x, y = target ? p.y+(target.y-p.y)/d*offset : p.y;
      if (sessionState.run.mines.length >= 8) sessionState.run.mines.shift();
      sessionState.run.mines.push({ x, y, life: 12 }); feedback.ring(x, y, 16, '#dba88b', .22, 'ring'); sessionState.run.mineClock = statistics.mineInterval(s);
    }
    for (const m of [...sessionState.run.mines].reverse()) {
      const i = sessionState.run.mines.indexOf(m);
      if (i < 0) continue;
      m.life -= dt;
      if (m.life <= 0) {feedback.addSkillEcho('circle',{x:m.x,y:m.y,radius:6,color:'#e6ca8f'});sessionState.run.mines.splice(i, 1);  if (view.mode !== 'playing') return; continue; }
      inspector?.circle(m.x,m.y,14+s.placement*4,'mine:sensor','sensor');
      if (sessionState.run.enemies.some(e => targetable(e,sessionState.run) && Math.hypot(e.x - m.x, e.y - m.y) < e.radius + 14 + s.placement*4)) { sessionState.run.mines.splice(i, 1); explodeMine(m, s); }
      if (view.mode !== 'playing') return;
    }
  }
  function tickBaseWeapons(dt, s) {
    const p = sessionState.run.player;
    if (s.nova && (sessionState.run.novaClock -= dt) <= 0) {
      const radius = statistics.novaRadius(s), color = '#8ee1d7'; inspector?.circle(p.x,p.y,radius,'nova'); feedback.ring(p.x, p.y, radius, color, .36, 'nova');
      cameraView.cameraKick(.3);
      for (const e of sessionState.run.enemies) if (targetable(e,sessionState.run) && Math.hypot(e.x - p.x, e.y - p.y) <= radius + e.radius) {
        applySlow(e, .20, .8,sessionState.run.time); combat.damage(e, statistics.weaponDamage('nova', s)); pushEnemy(e, p.x, p.y, statistics.novaPush(s));
      }
      sessionState.run.novaClock = statistics.novaInterval(s.nova);
    }
    if (view.mode === 'playing') skillTick(dt, s);
    sessionState.run.chainClock = Math.max(0, sessionState.run.chainClock - dt);
    if (view.mode === 'playing' && s.chain && sessionState.run.chainClock <= 0) { const first = nearestEnemyIn(sessionState.run,460); if (first) chainHit(first, s); }
  }
  function chainHit(first, s) {
    if (specialized('chain',sessionState.run) || weaponConsumed('chain',sessionState.run) || !s.chain || sessionState.run.chainClock > 0 || view.mode !== 'playing') return;
    sessionState.run.chainClock = statistics.chainReload(s); let x = sessionState.run.player.x, y = sessionState.run.player.y, target = first;
    const seen = new Set(), count = statistics.chainTargets(s), reach = chainReach(s);
    // If PULSE killed the first enemy, propagate from its impact position without wasting hop 0.
    if (!targetable(first,sessionState.run)) {
      seen.add(first.id); x = first.x; y = first.y; let best = reach ** 2; target = null;
      for (const e of sessionState.run.enemies) { const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (targetable(e,sessionState.run) && !seen.has(e.id) && d < best) { target = e; best = d; } }
    }
    for (let i = 0; i < count && target && view.mode === 'playing'; i++) {
      seen.add(target.id);
      if (sessionState.run.arcs.length < 90) sessionState.run.arcs.push({ x1: x, y1: y, x2: target.x, y2: target.y, kind:'chain',life:0.26,max:0.26,cold:false,seed: target.id * 1.37 + sessionState.run.time });
      feedback.impact(target.x,target.y,'#f5d69c'); inspector?.circle(target.x,target.y,target.radius,'chain target'); x = target.x; y = target.y;
      combat.damage(target, statistics.weaponDamage('chain', s, i)); target = null; let best = reach ** 2;
      for (const e of sessionState.run.enemies) { const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (targetable(e,sessionState.run) && !seen.has(e.id) && d < best) { target = e; best = d; } }
    }
  }
  function blockProjectile(b, oldX, oldY, s) {
    if (!s.orbit) return false;
    for (let i = 0; i < s.orbit; i++) {
      if (sessionState.run.time < (sessionState.run.orbitGuards[i] || 0)) continue;
      const angle = sessionState.run.time * 3 + i * Math.PI * 2 / s.orbit; const unit=sessionState.run.arsenal.states.orbit?.units?.[i];
      if(specialized('orbit',sessionState.run)&&!unit?.guard)continue;
      const x = specialized('orbit',sessionState.run)?unit.x:sessionState.run.player.x + Math.cos(angle) * s.orbitRadius, y = specialized('orbit',sessionState.run)?unit.y:sessionState.run.player.y + Math.sin(angle) * s.orbitRadius;
      if (!segmentHit(oldX, oldY, b.x, b.y, x, y, b.radius + 8)) continue;
      sessionState.run.orbitGuards[i] = sessionState.run.time + statistics.orbitReload(); feedback.burst(x, y, '#d6c4e2', 5); feedback.ring(x, y, 22, '#d6c4e2', .23, 'block');
      feedback.popup(x, y - 16, 'BLOCK', '#d6c4e2');
      if (hasRelic('mirror',sessionState.run) && sessionState.run.shots.length < 250) {
        let target = null, best = 600 * 600;
        for (const e of sessionState.run.enemies) { const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (targetable(e,sessionState.run) && d < best) { target = e; best = d; } }
        if (target) {
          const a = Math.atan2(target.y - y, target.x - x); sessionState.run.arcs.push({ x1: x, y1: y, x2: target.x, y2: target.y, kind: 'reflect', life: .16, max: .16 });
          sessionState.run.shots.push({ kind: 'mirror', x, y, vx: Math.cos(a) * 530, vy: Math.sin(a) * 530, damage: s.damage * 0.8, crit: false, radius: 4, life: 1.2, pierce: 1, hit: [] });
          feedback.popup(x, y - 26, 'REFLECT', '#d6c4e2');
        }
      }
      return true;
    }
    return false;
  }
  function fire() {
    if(specialized('pulse',sessionState.run)||!pulseActive(sessionState.run))return false;
    const target = nearestEnemy(sessionState.run);
    if (!target) return false;
    const s = statistics.stats(), angle = Math.atan2(target.y - sessionState.run.player.y, target.x - sessionState.run.player.x);
    for (let i = 0, count = s.shots; i < count && sessionState.run.shots.length < 250; i++) {
      const offset = i ? (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.14 : 0, a = angle + offset;
      const crit = runRandom(sessionState.run) < statistics.pulseCritChance(s), damage = statistics.weaponDamage('pulse', s) * (i ? 0.38 : 1) * (crit ? s.critMult : 1);
      sessionState.run.shots.push({ kind: 'pulse', x: sessionState.run.player.x, y: sessionState.run.player.y, vx: Math.cos(a) * 530, vy: Math.sin(a) * 530, damage, crit, aux: i > 0, radius: s.radius, cold: s.frost > 0, life: 1.35, pierce: s.pierce, hit: [] });
    }
    if (sessionState.run.waves.length < 28) feedback.ring(sessionState.run.player.x, sessionState.run.player.y, 18, '#f0dfad', .12, 'muzzle');
    return true;
  }
  function weaponTick(dt,s){tickBaseWeapons(dt,s);feedback.tickWeaponEffects(sessionState.run,dt);}
  return { blockProjectile, fire, weaponTick };
}
