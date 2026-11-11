import test from 'node:test';
import assert from 'node:assert/strict';
import { DRIFT, DRIFT_KINDS, driftKind, driftActive, driftZone, driftLive, createDrift } from '../src/world/drift.js';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { phases } from '../src/data/progression.js';

const at = phases[DRIFT.fromPhase].at;
function harness(time) {
  const hits = [], run = { time, finalStep: 0, player: { x: 0, y: 0 } };
  return { run, hits, drift: createDrift({ sessionState: { run }, combat: { hurtPlayer: v => hits.push(v) } }) };
}

test('drift zones start in the fourth phase, warn first and leave during the final core', () => {
  assert.equal(driftActive({ time: at - 1, finalStep: 0 }), false);
  assert.equal(driftActive({ time: at, finalStep: 0 }), true);
  assert.equal(driftActive({ time: at + 100, finalStep: 2 }), false);
  const z = driftZone(0, { x: 0, y: 0 }, 1000);
  assert.deepEqual(driftZone(0, { x: 0, y: 0 }, 1000), z);
  assert.ok(Math.abs(Math.hypot(z.x, z.y) - DRIFT.distance) < 1e-6);
  assert.equal(driftLive(z, 1000), false); assert.equal(driftLive(z, 1000 + DRIFT.warn), true); assert.equal(driftLive(z, z.endAt), false);
});

test('no drift field before the phase; zones spawn on schedule, drift and hurt only when live and touching', () => {
  const early = harness(at - 5); early.drift.tickDrift(1 / 60, { maxHp: 100 }); assert.equal(early.run.drift, undefined);
  const h = harness(at); h.drift.tickDrift(1 / 60, { maxHp: 100 }); assert.equal(h.run.drift.zones.length, 0);
  h.run.time = at + DRIFT.firstDelay; h.drift.tickDrift(1 / 60, { maxHp: 100 }); assert.equal(h.run.drift.zones.length, 1);
  const z = h.run.drift.zones[0], x0 = z.x; h.run.player = { x: z.x, y: z.y };
  h.drift.tickDrift(1, { maxHp: 100 }); assert.ok(z.x !== x0); assert.equal(h.hits.length, 0, 'warning phase does not hurt');
  h.run.time += DRIFT.warn; h.run.player = { x: z.x, y: z.y }; h.drift.tickDrift(1 / 60, { maxHp: 100 }); assert.deepEqual(h.hits, [Math.round(100 * DRIFT.damage)]);
  h.run.player = { x: z.x + DRIFT.radius * 3, y: z.y }; h.drift.tickDrift(1 / 60, { maxHp: 100 }); assert.equal(h.hits.length, 1);
  for (let i = 0; i < 5; i++) { h.run.time += DRIFT.every; h.drift.tickDrift(1 / 60, { maxHp: 100 }); }
  assert.ok(h.run.drift.zones.length <= DRIFT.max);
  h.run.finalStep = 2; h.drift.tickDrift(1 / 60, { maxHp: 100 }); assert.equal(h.run.drift.zones.length, 0);
});

test('drift kinds: the fourth phase only burns; later phases mix stagnation and pull; consume-leaning runs burn more', () => {
  for (let n = 0; n < 40; n++) assert.equal(driftKind(n, DRIFT.fromPhase, 0), 'burn');
  const mixed = new Set(Array.from({ length: 60 }, (_, n) => driftKind(n, DRIFT.fromPhase + 1, 0)));
  assert.deepEqual([...mixed].sort(), [...DRIFT_KINDS].sort());
  const burns = memory => Array.from({ length: 200 }, (_, n) => driftKind(n, DRIFT.fromPhase + 1, memory)).filter(k => k === 'burn').length;
  assert.ok(burns(-3) > burns(3) + 30);
});

test('stagnation slows movement through the stats; pull drags the player inward without damage', () => {
  const zoneAt = kind => ({ kind, x: 0, y: 0, vx: 0, vy: 0, radius: DRIFT.radius, liveAt: 0, endAt: 1e6 });
  const h = harness(at + 1); h.run.drift = { next: 1e9, count: 1, zones: [zoneAt('still')] }; h.run.player = { x: 10, y: 0 };
  h.drift.tickDrift(1 / 60, { maxHp: 100 }); assert.ok(h.run.driftSlowUntil > h.run.time); assert.equal(h.hits.length, 0);
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 }), st = createStatistics({ sessionState: { profile, run } });
  const normal = st.stats(run).speed; run.time = 5; run.driftSlowUntil = 5.1; assert.ok(Math.abs(st.stats(run).speed - normal * DRIFT.slow) < 1e-9);
  const g = harness(at + 1); g.run.drift = { next: 1e9, count: 1, zones: [zoneAt('pull')] }; g.run.player = { x: 50, y: 0 };
  g.drift.tickDrift(.5, { maxHp: 100 }); assert.ok(Math.abs(g.run.player.x - (50 - DRIFT.pull * .5)) < 1e-9); assert.equal(g.hits.length, 0);
});

test('drift zones and their kinds survive a save restore; bogus kinds are dropped', async () => {
  const { restoreRun } = await import('../src/save/restore-run.js');
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 });
  run.time = at + 30; run.drift = { next: at + 60, count: 2, zones: [driftZone(0, { x: 0, y: 0 }, at + 20, 'pull'), { ...driftZone(1, { x: 0, y: 0 }, at + 20), kind: 'lava' }] };
  const back = restoreRun(JSON.parse(JSON.stringify(run)), profile);
  assert.equal(back.drift.count, 2); assert.equal(back.drift.zones.length, 1); assert.deepEqual(back.drift.zones[0], run.drift.zones[0]);
});
