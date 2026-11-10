import { paceAt } from '../core/difficulty.js';
import { segmentHit } from '../math/geometry.js';

// 엄폐 기둥(NEXT-UPDATE-PLAN.md 3순위): 3단계(전술 확장)부터 전장에 서서 적 탄만 막는다.
// 위치는 월드 좌표의 격자 칸에서 결정적으로 정해지므로 저장할 상태가 없다. 플레이어와 적은 지나간다.
export const PILLAR = Object.freeze({ cell: 460, radius: 24, fromPhase: 2, keepClear: 260 });

const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function pillarsActive(r) { return !!r && r.finalStep < 2 && paceAt(r.time).index >= PILLAR.fromPhase; }

// 칸마다 0 또는 1개. 시작 지점 근처는 비워 둔다.
function pillarIn(gx, gy) {
  if (hash(gx, gy) > .42) return null;
  const x = (gx + .2 + hash(gx + 91, gy) * .6) * PILLAR.cell, y = (gy + .2 + hash(gx, gy + 37) * .6) * PILLAR.cell;
  return Math.hypot(x, y) < PILLAR.keepClear ? null : { x, y, r: PILLAR.radius };
}

export function pillarsNear(x, y, range) {
  const list = [], c = PILLAR.cell;
  for (let gx = Math.floor((x - range) / c); gx <= Math.floor((x + range) / c); gx++)
    for (let gy = Math.floor((y - range) / c); gy <= Math.floor((y + range) / c); gy++) { const p = pillarIn(gx, gy); if (p) list.push(p); }
  return list;
}

// 탄이 이번 프레임에 지나간 선분이 기둥에 닿았는지.
export function pillarBlocks(x0, y0, x1, y1, radius) {
  const c = PILLAR.cell;
  for (let gx = Math.floor((Math.min(x0, x1) - c) / c); gx <= Math.floor((Math.max(x0, x1) + c) / c); gx++)
    for (let gy = Math.floor((Math.min(y0, y1) - c) / c); gy <= Math.floor((Math.max(y0, y1) + c) / c); gy++) {
      const p = pillarIn(gx, gy);
      if (p && segmentHit(x0, y0, x1, y1, p.x, p.y, p.r + radius)) return p;
    }
  return null;
}
