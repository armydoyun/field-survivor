// 전장 안 무기 줄(v3.1): 오른쪽 아래에 가진 무기 아이콘과 재사용 대기 고리를 그린다.
// 아이콘은 무기 이름 옆과 같은 SVG(weapon-icons.js)를 이미지로 만들어 쓴다. 그리기만 하며 판 상태는 바꾸지 않는다.
import { W, H } from '../core/config.js';
import { weaponSvgPaths } from '../ui/weapon-icons.js';
import { specialized, weaponConsumed, pulseActive } from '../growth/build.js';

export const STRIP_ORDER = Object.freeze(['pulse', 'orbit', 'nova', 'chain', 'lance', 'mine', 'rift', 'beacon']);
const ICON_COLOR = '#dfe9ec';
const images = new Map();

function iconImage(id) {
  if (images.has(id)) return images.get(id);
  let img = null;
  if (typeof Image === 'function' && weaponSvgPaths[id]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="32" height="32" color="${ICON_COLOR}">${weaponSvgPaths[id]}</svg>`;
    img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  images.set(id, img);
  return img;
}

// 남은 대기 비율(1 = 막 발사, 0 = 준비 완료). 계산할 수 없으면 null(고리 없음).
export function weaponCooldown(id, r, s, statistics) {
  const ratio = (clock, interval) => (interval > 0 ? Math.max(0, Math.min(1, (clock || 0) / interval)) : null);
  if (specialized(id, r)) return null;
  if (id === 'pulse') return ratio(r.attackClock, s.interval);
  if (id === 'nova') return ratio(r.novaClock, statistics.novaInterval(s.nova));
  if (id === 'rift') return ratio(r.riftClock, statistics.riftInterval(s));
  if (id === 'lance') return ratio(r.lanceClock, statistics.lanceInterval(s));
  if (id === 'mine') return ratio(r.mineClock, statistics.mineInterval(s));
  if (id === 'chain') return ratio(r.chainClock, statistics.chainReload(s));
  if (id === 'beacon') return ratio(r.beaconClock, statistics.beaconInterval(s));
  return null;
}

export function stripWeapons(r) {
  // 펄스는 레벨 0이어도 기본 사격이 살아 있으면 보인다(시작 무기가 다르면 휴면).
  return STRIP_ORDER.filter(id => (id === 'pulse' ? pulseActive(r) : (r.up?.[id] || 0) > 0) && !weaponConsumed(id, r));
}

export function drawWeaponStrip(ctx, r, s, statistics) {
  const list = stripWeapons(r);
  if (!list.length) return;
  if (images.size < STRIP_ORDER.length) STRIP_ORDER.forEach(iconImage); // 첫 프레임에 전부 미리 만든다.
  const size = 28, gap = 6, x0 = W - 12 - list.length * (size + gap) + gap, y = H - 12 - size;
  ctx.save();
  list.forEach((id, i) => {
    const x = x0 + i * (size + gap), cx = x + size / 2, cy = y + size / 2, wait = weaponCooldown(id, r, s, statistics);
    ctx.fillStyle = 'rgba(10,20,26,.62)'; ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
    const img = iconImage(id);
    if (img?.complete && img.naturalWidth) { ctx.globalAlpha = wait > .02 ? .55 : 1; ctx.drawImage(img, cx - 8, cy - 8, 16, 16); ctx.globalAlpha = 1; }
    if (wait != null) {
      ctx.strokeStyle = 'rgba(223,233,236,.22)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, size / 2 - 1.5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = wait > .02 ? '#9fd6c7' : '#e8f6f1'; ctx.beginPath(); ctx.arc(cx, cy, size / 2 - 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - wait)); ctx.stroke();
    }
    if (r.up[id] > 0) { ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = '#dfe9ec'; ctx.fillText(String(r.up[id]), x + size + 1, y + size + 1); }
  });
  ctx.restore();
}
