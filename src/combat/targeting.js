import { targetable } from './rules.js';

// 감시자 조준(v3.1): 플레이어가 T로 켜면, 플레이어 위치나 플레이어 곁(FOCUS_NEAR 안)에 붙은 장치에서 고르는 표적은
// 사거리 안의 감시자가 먼저다. 멀리 설치된 장치는 자기 주변 표적을 그대로 고른다. 필드가 없으면(기본) 이전과 같다.
export const FOCUS_NEAR = 120;
function focusedGuardian(run, radius, x, y, exclude) {
  if (!run.focusGuardian || Math.hypot(x - run.player.x, y - run.player.y) > FOCUS_NEAR) return null;
  let best = null, dmin = radius * radius;
  for (const e of run.enemies) { if (e.kind !== 3 || !targetable(e, run) || exclude?.includes(e.id)) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < dmin) { best = e; dmin = d; } }
  return best;
}

function nearestEnemyIn(run,radius, x = run.player.x, y = run.player.y, exclude = null) { const focus = focusedGuardian(run, radius, x, y, exclude); if (focus) return focus; let best = null, dmin = radius * radius; for (const e of run.enemies) { const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy; if (targetable(e,run) && (!exclude || !exclude.includes(e.id)) && d < dmin) { best = e; dmin = d; } } return best; }

function nearestEnemy(run) {
  const focus = focusedGuardian(run, 490, run.player.x, run.player.y, null); if (focus) return focus;
  let best = null, bestDist = 490 * 490;
  for (const e of run.enemies) { if (!targetable(e,run)) continue; const dx = e.x - run.player.x, dy = e.y - run.player.y, d = dx * dx + dy * dy; if (d < bestDist) { best = e; bestDist = d; } }
  return best;
}

export { nearestEnemyIn, nearestEnemy, focusedGuardian };
