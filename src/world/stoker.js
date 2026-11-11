import { stokerLines, startEffects } from '../data/world.js';
import { routeAxes } from './route.js';
import { stokerReward } from '../data/world-choices.js';
import { appendRecord } from '../core/profile.js';

// 화부 만남(NEXT-UPDATE-PLAN.md 8절 1순위). 감시자와 같은 문법: 곁에서 멈춰 서면 불을 끄고(보존), E로 불을 지핀다(연소).
// 기록원을 들어 주지 않은 판에서만 13분에 나타난다. 판에는 나타날 때 run.stoker 필드가 생긴다.
export const STOKER = Object.freeze({ at: 780, reach: 80, still: 3, stay: 40, offset: 150, heardMemory: 1 });

// 기록원을 듣지 않은 판, 또는 들었지만 기억 축이 가운데(+1 이하)에 머문 판. 직전 결말이 합창이면 6:30에 온다.
export function stokerEligible(r) {
  if (!r || r.stoker || r.finalStep >= 1) return false;
  const at = r.legacyVariant === 'chorus' ? startEffects.chorusStokerAt : STOKER.at;
  return r.time >= at && (r.npc?.state !== 'heard' || routeAxes(r).memory <= STOKER.heardMemory || r.legacyVariant === 'chorus');
}

export function stokerWaiting(r) { return r?.stoker?.state === 'waiting'; }

export function createStoker({ sessionState, statistics, feedback, storage }) {
  const record = line => appendRecord(sessionState.profile, sessionState.run, line);
  const memory = () => (sessionState.profile.memory.stoker ??= { met: 0, stoked: 0, quenched: 0, origin: false });
  const near = (r) => Math.hypot(r.player.x - r.stoker.x, r.player.y - r.stoker.y) <= STOKER.reach;

  function spawnStoker() {
    const r = sessionState.run;
    if (!stokerEligible(r)) return false;
    const p = r.player, a = (r.time * 2.399) % (Math.PI * 2);
    r.stoker = { state: 'waiting', x: p.x + Math.cos(a) * STOKER.offset, y: p.y + Math.sin(a) * STOKER.offset, still: 0, until: r.time + STOKER.stay };
    record(stokerLines.arrive);
    return true;
  }

  function settle(state) {
    const r = sessionState.run, m = memory();
    r.stoker.state = state; r.stoker.still = 0; m.met++;
    if (state === 'stoked') { m.stoked++; r.signalPower = (r.signalPower || 0) + stokerReward.power; record(stokerLines.stoked); feedback?.burst?.(r.stoker.x, r.stoker.y, '#f0965a', 22); feedback?.sound?.('stoke'); }
    else { m.quenched++; r.player.hp = Math.min(statistics.stats().maxHp, r.player.hp + stokerReward.heal); record(stokerLines.quenched); feedback?.burst?.(r.stoker.x, r.stoker.y, '#9fc7d6', 18); feedback?.sound?.('quench'); }
    storage?.save?.();
    return true;
  }

  // 매 프레임: 곁에서 멈춰 있으면 불을 끄고, 시간이 지나면 떠난다.
  function tickStoker(dt, moving) {
    const r = sessionState.run;
    if (!stokerWaiting(r)) return false;
    if (r.finalStep >= 1 || r.time >= r.stoker.until) { r.stoker.state = 'left'; record(stokerLines.left); return false; }
    r.stoker.still = near(r) && !moving ? r.stoker.still + dt : 0;
    if (r.stoker.still >= STOKER.still) return settle('quenched');
    return false;
  }

  // E: 가까이 있으면 불을 지핀다.
  function stokeFire() {
    const r = sessionState.run;
    if (!stokerWaiting(r) || !near(r)) return false;
    return settle('stoked');
  }

  return { spawnStoker, tickStoker, stokeFire };
}
