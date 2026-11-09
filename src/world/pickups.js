import { runRandom } from '../core/random.js';

export function createPickups({ sessionState, statistics, feedback, progression }) {
  function updatePickups(dt) {
    const p = sessionState.run.player; sessionState.run.pickupClock -= dt;
    if (sessionState.run.pickupClock <= 0) {
      if (sessionState.run.pickups.length < 2) {
        const types = ['magnet', 'shield', 'heal'], type = types[Math.floor(runRandom(sessionState.run) * (p.hp < statistics.stats().maxHp * .9 ? 3 : 2))];
        const a = runRandom(sessionState.run) * Math.PI * 2, dist = 155 + runRandom(sessionState.run) * 80;
        sessionState.run.pickups.push({ type, x: p.x + Math.cos(a) * dist, y: p.y + Math.sin(a) * dist, life: 80 });
      }
      sessionState.run.pickupClock = 65 + runRandom(sessionState.run) * 25;
    }
    for (let i = sessionState.run.pickups.length - 1; i >= 0; i--) {
      const q = sessionState.run.pickups[i], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
      q.life -= dt;
      if (q.life <= 0 || d2 > 1250 ** 2) { sessionState.run.pickups.splice(i, 1); continue; }
      if (d2 > 26 ** 2 || (q.type === 'heal' && p.hp >= statistics.stats().maxHp)) continue;
      if (q.type === 'magnet') {
        const total = progression.collectAll();
        feedback.popup(p.x, p.y - 40, `EXP +${Math.floor(total)}`, '#9cdedb');
      } else if (q.type === 'heal') {
        const gained = Math.min(statistics.stats().maxHp - p.hp, Math.ceil(statistics.stats().maxHp * .3)); p.hp += gained;
        feedback.popup(p.x, p.y - 40, `HP +${Math.ceil(gained)}`, '#aee8b0');
      } else { sessionState.run.invulnUntil = Math.max(sessionState.run.invulnUntil, sessionState.run.time) + 5; feedback.popup(p.x, p.y - 40, '무적 5초', '#e6d5a7'); }
      feedback.ring(p.x, p.y, 58, '#c3e8db', .35); sessionState.run.pickups.splice(i, 1);
    }
  }

  return { updatePickups };
}
