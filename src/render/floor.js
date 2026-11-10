import { W, H } from '../core/config.js';
import { paceAt } from '../core/difficulty.js';
import { phases } from '../data/progression.js';

// 단계별 바닥(NEXT-UPDATE-PLAN.md 3순위의 렌더 부분). 단계가 바뀌면 바닥 색과 격자가 6초에 걸쳐 바뀐다.
// 그리기만 바꾸며 판 상태 · 난수는 건드리지 않는다.
export const FLOORS = Object.freeze([
  { bg: [21, 35, 45], line: [37, 52, 62], mark: null },
  { bg: [22, 34, 42], line: [42, 58, 64], mark: 'cross' },
  { bg: [26, 31, 41], line: [52, 52, 72], mark: 'cross' },
  { bg: [31, 28, 38], line: [66, 48, 68], mark: 'diag' },
  { bg: [36, 25, 31], line: [84, 46, 54], mark: 'diag' },
  { bg: [40, 22, 26], line: [104, 44, 46], mark: 'ring' }
]);
const mix = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v) * f));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
export function floorAt(time) {
  const { index } = paceAt(time), cur = FLOORS[Math.min(index, FLOORS.length - 1)], prev = FLOORS[Math.max(0, Math.min(index, FLOORS.length - 1) - 1)];
  const f = index === 0 ? 1 : Math.min(1, (time - phases[index].at) / 6);
  return { bg: rgb(mix(prev.bg, cur.bg, f)), line: rgb(mix(prev.line, cur.line, f)), mark: cur.mark, markAlpha: f, index };
}

// 격자 교차점마다 단계 무늬를 찍는다(교차 · 사선 · 고리). 화면 안 교차점만 그린다.
export function drawFloorMarks(ctx, floor, cx, cy) {
  ctx.save(); ctx.globalAlpha = .55 * floor.markAlpha; ctx.strokeStyle = floor.line; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let x = Math.floor((cx - W / 2) / 96) * 96; x <= cx + W / 2; x += 96) for (let y = Math.floor((cy - H / 2) / 96) * 96; y <= cy + H / 2; y += 96) {
    if (floor.mark === 'cross') { ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); }
    else if (floor.mark === 'diag') { ctx.moveTo(x - 7, y + 7); ctx.lineTo(x + 7, y - 7); ctx.moveTo(x + 41, y + 55); ctx.lineTo(x + 55, y + 41); }
    else { ctx.moveTo(x + 7, y); ctx.arc(x, y, 7, 0, Math.PI * 2); }
  }
  ctx.stroke(); ctx.restore();
}

