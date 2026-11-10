import { paceAt } from '../core/difficulty.js';

// 표류 구역(NEXT-UPDATE-PLAN.md 3순위): 4단계(세계의 반응, 16분)부터 플레이어 근처에 천천히 움직이는 위험 구역이 생긴다.
// 예고 후 들어가 있으면 피격 판정(무적 시간 적용)으로 최대 체력의 일부를 잃는다. 중심핵 전투에서는 사라진다.
// 위치는 생성 순번의 해시로 정하므로 판 난수를 쓰지 않는다. 판에는 구역이 처음 생길 때만 run.drift 필드가 생긴다.
export const DRIFT = Object.freeze({ fromPhase: 3, every: 30, firstDelay: 8, max: 2, radius: 105, warn: 2.5, life: 20, speed: 26, distance: 280, damage: 0.05 });

const hash = n => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function driftActive(r) { return !!r && r.finalStep < 2 && paceAt(r.time).index >= DRIFT.fromPhase; }

// n번째 구역: 플레이어 기준 방향과 거리, 그리고 플레이어를 스치는 이동 방향.
export function driftZone(n, player, time) {
  const a = hash(n) * Math.PI * 2, x = player.x + Math.cos(a) * DRIFT.distance, y = player.y + Math.sin(a) * DRIFT.distance;
  const heading = a + Math.PI + (hash(n + 7919) - .5) * 1.2;
  return { x, y, vx: Math.cos(heading) * DRIFT.speed, vy: Math.sin(heading) * DRIFT.speed, radius: DRIFT.radius, liveAt: time + DRIFT.warn, endAt: time + DRIFT.warn + DRIFT.life };
}

export function driftLive(zone, time) { return time >= zone.liveAt && time < zone.endAt; }

export function createDrift({ sessionState, combat }) {
  function tickDrift(dt, s) {
    const r = sessionState.run;
    if (!driftActive(r)) { if (r?.drift) r.drift.zones.length = 0; return; }
    const start = (r.drift ??= { next: Math.max(r.time, 0) + DRIFT.firstDelay, count: 0, zones: [] });
    start.zones = start.zones.filter(z => z.endAt > r.time);
    for (const z of start.zones) { z.x += z.vx * dt; z.y += z.vy * dt; }
    if (r.time >= start.next) {
      start.next = r.time + DRIFT.every;
      if (start.zones.length < DRIFT.max) start.zones.push(driftZone(start.count++, r.player, r.time));
    }
    const p = r.player;
    for (const z of start.zones) if (driftLive(z, r.time) && Math.hypot(p.x - z.x, p.y - z.y) < z.radius) { combat.hurtPlayer(Math.max(1, Math.round(s.maxHp * DRIFT.damage))); break; }
  }
  return { tickDrift };
}
