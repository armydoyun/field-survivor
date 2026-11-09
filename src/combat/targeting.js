import { targetable } from './rules.js';

function nearestEnemyIn(run,radius, x = run.player.x, y = run.player.y, exclude = null) { let best = null, dmin = radius * radius; for (const e of run.enemies) { const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy; if (targetable(e,run) && (!exclude || !exclude.includes(e.id)) && d < dmin) { best = e; dmin = d; } } return best; }

function nearestEnemy(run) {
  let best = null, bestDist = 490 * 490;
  for (const e of run.enemies) { if (!targetable(e,run)) continue; const dx = e.x - run.player.x, dy = e.y - run.player.y, d = dx * dx + dy * dy; if (d < bestDist) { best = e; bestDist = d; } }
  return best;
}

export { nearestEnemyIn, nearestEnemy };
