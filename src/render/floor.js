import { W, H } from '../core/config.js';
import { paceAt } from '../core/difficulty.js';
import { phases } from '../data/progression.js';
import { PILLAR, pillarsActive, pillarsNear } from '../world/pillars.js';
import { DRIFT, driftActive, driftLive } from '../world/drift.js';

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


// 엄폐 기둥: 3단계 시작 후 2초 동안 솟아오른다. 화면 안 칸만 그린다.
export function drawPillars(ctx, r, cx, cy) {
  if (!pillarsActive(r)) return;
  const rise = Math.min(1, (r.time - phases[PILLAR.fromPhase].at) / 2);
  ctx.save(); ctx.globalAlpha = rise;
  for (const p of pillarsNear(cx, cy, Math.max(W, H) / 2 + 40)) {
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 7, p.r, p.r * .8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a4b56'; ctx.strokeStyle = '#8fa4b0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * rise, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(143,164,176,.45)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * .55 * rise, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// 표류 구역: 예고 중에는 점선 원이 차오르고, 활성 중에는 호박색 빗금이 흐른다.
export function drawDrift(ctx, r) {
  const zones = r.drift?.zones;
  if (!zones?.length || !driftActive(r)) return;
  ctx.save();
  for (const z of zones) {
    const live = driftLive(z, r.time), fade = Math.min(1, (z.endAt - r.time) / 1.2);
    ctx.globalAlpha = fade; ctx.lineWidth = 2;
    if (!live) {
      const f = 1 - (z.liveAt - r.time) / DRIFT.warn;
      ctx.setLineDash([8, 7]); ctx.strokeStyle = '#f0b25a'; ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(240,178,90,.12)'; ctx.beginPath(); ctx.arc(z.x, z.y, z.radius * f, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(240,150,70,.16)'; ctx.strokeStyle = '#f0965a'; ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(240,150,70,.35)'; ctx.beginPath();
    const shift = (r.time * 24) % 28;
    for (let k = -z.radius * 2; k < z.radius * 2; k += 28) { ctx.moveTo(z.x + k + shift - z.radius, z.y - z.radius); ctx.lineTo(z.x + k + shift + z.radius, z.y + z.radius); }
    ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}
