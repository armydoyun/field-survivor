import test from 'node:test';
import assert from 'node:assert/strict';
import { DRIFT, driftActive, driftZone, driftLive, createDrift } from '../src/world/drift.js';
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
