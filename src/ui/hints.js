// 첫 플레이 안내 배너. 조건 검사와 표시만 하며 판 상태는 바꾸지 않는다(본 안내 ID만 프로필에 남긴다).
import { hints, HINT_SECONDS } from '../data/hints.js';
import { routeAxes } from '../world/route.js';
import { fusionRecipes } from '../data/fusions.js';
import { fusionReady } from '../growth/build.js';
import { W } from '../core/config.js';

const triggers = {
  witness: r => r.npc?.spawned && r.npc.state === 'waiting',
  guardian: r => r.enemies.some(e => e.kind === 3 && e.named && e.phase === 3 && e.id === r.bossChoiceId),
  route: r => Math.abs(routeAxes(r).memory) >= 2,
  fusion: r => fusionRecipes.some(f => fusionReady(f, r)),
  shield: r => r.finalStep === 2 && r.journey?.core?.shields > 0,
};

export function createHints({ sessionState, platform }) {
  const { ctx } = platform;
  let current = null, owner = null;

  function tickHints() {
    const r = sessionState.run, memory = sessionState.profile.memory;
    if (!r) { current = null; return null; }
    if (owner !== r) { owner = r; current = null; }
    if (current && r.time < current.until) return current;
    current = null;
    const seen = memory.hints || (memory.hints = []);
    const next = hints.find(h => !seen.includes(h.id) && triggers[h.id](r));
    if (!next) return null;
    seen.push(next.id);
    current = { id: next.id, text: next.text, until: r.time + HINT_SECONDS };
    return current;
  }

  function drawHint() {
    const r = sessionState.run;
    if (!current || !r || r.time >= current.until) return;
    const left = current.until - r.time, alpha = Math.min(1, left / .6, (HINT_SECONDS - left) / .3 + .2);
    ctx.save(); ctx.globalAlpha = Math.max(0, alpha); ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const width = Math.min(W - 40, ctx.measureText(current.text).width + 36), x = W / 2 - width / 2, y = 18;
    ctx.fillStyle = 'rgba(12,24,32,.88)'; ctx.strokeStyle = '#8fcfc0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.rect(x, y, width, 32); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8f4ef'; ctx.fillText(current.text, W / 2, y + 16, width - 24); ctx.restore();
  }

  return { tickHints, drawHint, current: () => current };
}
