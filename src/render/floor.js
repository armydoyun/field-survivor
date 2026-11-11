import { W, H } from '../core/config.js';
import { paceAt } from '../core/difficulty.js';
import { phases } from '../data/progression.js';
import { PILLAR, pillarsActive, pillarsNear } from '../world/pillars.js';
import { DRIFT, driftActive, driftLive } from '../world/drift.js';
import { STOKER } from '../world/stoker.js';

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

// 표류 구역: 예고 중에는 점선 원이 차오르고, 활성 중에는 종류별 무늬가 흐른다.
// 연소는 주황 빗금, 정체는 청회색 가로줄, 흡인은 보라 동심원이 안쪽으로 줄어든다.
const DRIFT_COLORS = { burn: [240, 150, 70], still: [140, 170, 190], pull: [180, 140, 230] };
const DRIFT_NAMES = { burn: '연소', still: '정체', pull: '흡인' };
export function drawDrift(ctx, r, labels = false) {
  const zones = r.drift?.zones;
  if (!zones?.length || !driftActive(r)) return;
  ctx.save();
  for (const z of zones) {
    const live = driftLive(z, r.time), fade = Math.min(1, (z.endAt - r.time) / 1.2), [cr, cg, cb] = DRIFT_COLORS[z.kind] || DRIFT_COLORS.burn, c = a => `rgba(${cr},${cg},${cb},${a})`;
    ctx.globalAlpha = fade; ctx.lineWidth = 2;
    if (!live) {
      const f = 1 - (z.liveAt - r.time) / DRIFT.warn;
      ctx.setLineDash([8, 7]); ctx.strokeStyle = c(1); ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c(.12); ctx.beginPath(); ctx.arc(z.x, z.y, z.radius * f, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = c(.16); ctx.strokeStyle = c(1); ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.clip(); ctx.strokeStyle = c(.35); ctx.beginPath();
    const shift = (r.time * 24) % 28;
    if (z.kind === 'pull') for (let k = 0; k < 4; k++) { const rr = z.radius * (1 - ((r.time * .6 + k / 4) % 1)); ctx.moveTo(z.x + rr, z.y); ctx.arc(z.x, z.y, rr, 0, Math.PI * 2); }
    else if (z.kind === 'still') for (let k = -z.radius; k < z.radius; k += 18) { ctx.moveTo(z.x - z.radius, z.y + k + (shift % 18) / 3); ctx.lineTo(z.x + z.radius, z.y + k + (shift % 18) / 3); }
    else for (let k = -z.radius * 2; k < z.radius * 2; k += 28) { ctx.moveTo(z.x + k + shift - z.radius, z.y - z.radius); ctx.lineTo(z.x + k + shift + z.radius, z.y + z.radius); }
    ctx.stroke(); ctx.restore();
    if (labels) { ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = c(1); ctx.fillText(DRIFT_NAMES[z.kind] || DRIFT_NAMES.burn, z.x, z.y + 4); }
  }
  ctx.restore();
}

// 화부: 불씨 옆의 인물. 기다리는 동안 불꽃이 흔들리고, 곁에 멈춰 있으면 꺼져 가는 고리가 찬다.
export function drawStoker(ctx, r) {
  const k = r.stoker;
  if (!k || k.state !== 'waiting') return;
  const near = Math.hypot(r.player.x - k.x, r.player.y - k.y) <= STOKER.reach, flick = Math.sin(r.time * 9) * 2;
  ctx.save();
  ctx.fillStyle = 'rgba(240,150,70,.18)'; ctx.beginPath(); ctx.arc(k.x, k.y, 30 + flick, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0965a'; ctx.beginPath(); ctx.moveTo(k.x - 7, k.y + 6); ctx.quadraticCurveTo(k.x - 8, k.y - 8, k.x, k.y - 17 - flick); ctx.quadraticCurveTo(k.x + 8, k.y - 8, k.x + 7, k.y + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2b2321'; ctx.fillRect(k.x - 9, k.y + 6, 18, 6);
  if (k.still > 0) { ctx.strokeStyle = '#9fc7d6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(k.x, k.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k.still / STOKER.still)); ctx.stroke(); }
  if (near) { ctx.textAlign = 'center'; ctx.font = 'bold 12px system-ui'; ctx.fillStyle = '#f7d2b4'; ctx.fillText('E · 불을 지핀다 / 멈춰 서면 불을 끈다', k.x, k.y - 34); }
  ctx.restore();
}

// 감시자 조준(v3.1): 켜져 있으면 감시자 둘레에 회전하는 조준선, 꺼져 있으면 'T · 조준' 안내만 작게.
export function drawGuardianFocus(ctx, r) {
  const g = r.enemies?.find(e => e.kind === 3 && e.hp > 0 && e.phase !== 3);
  if (!g) return;
  const radius = (g.radius || 26) + 12;
  ctx.save();
  if (r.focusGuardian) {
    const spin = r.time * 1.6; ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 2.2;
    for (let k = 0; k < 4; k++) { const a = spin + k * Math.PI / 2; ctx.beginPath(); ctx.arc(g.x, g.y, radius, a - .32, a + .32); ctx.stroke(); }
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { const a = spin + Math.PI / 4 + k * Math.PI / 2; ctx.moveTo(g.x + Math.cos(a) * (radius + 3), g.y + Math.sin(a) * (radius + 3)); ctx.lineTo(g.x + Math.cos(a) * (radius + 11), g.y + Math.sin(a) * (radius + 11)); }
    ctx.stroke();
  } else {
    ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,224,160,.8)'; ctx.fillText('T · 조준', g.x, g.y + radius + 16);
  }
  ctx.restore();
}
