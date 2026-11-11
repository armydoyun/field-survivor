import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createObjectives } from '../src/world/objectives.js';
import { objectives } from '../src/data/world.js';

function harness() {
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 }), calls = [], collected = [];
  const sessionState = { profile, run };
  const o = createObjectives({ sessionState, view: { mode: 'playing' }, progression: { collect: xp => collected.push(xp) }, feedback: { popup: (...a) => calls.push(['popup', a[2]]), burst: () => calls.push(['burst']) }, session: { record: line => calls.push(['record', line]) }, storage: { save() {} }, enemyRuntime: {}, difficulty: {}, screen: {} });
  const index = objectives.findIndex(x => x.id === 'hunter');
  run.objectiveStep = index; run.objective = { id: 'hunter', phase: 1, targetId: 7, x: 0, y: 0, left: 0 };
  run.enemies = [{ id: 6, kind: 0, hp: 10, x: 0, y: 0 }, { id: 7, kind: 8, elite: true, hp: 500, x: 10, y: 10 }];
  return { sessionState, run, o, calls, collected, task: objectives[index] };
}

test('a failed hunt withdraws its empowered target instead of leaving it in the fight', () => {
  const h = harness();
  assert.equal(h.o.closeObjective(false), true);
  assert.equal(h.run.objectiveOutcomes.hunter, 'failed');
  assert.deepEqual(h.run.enemies.map(e => e.id), [6]);
  assert.equal(h.run.gold, 0); assert.deepEqual(h.collected, []);
  assert.ok(h.calls.some(c => c[0] === 'popup' && c[1] === 'SIGNAL LOST'));
});

test('a completed hunt keeps other enemies and pays its reward once', () => {
  const h = harness(); h.run.enemies = h.run.enemies.filter(e => e.id !== 7);
  assert.equal(h.o.closeObjective(true), true);
  assert.equal(h.run.objectiveOutcomes.hunter, 'complete');
  assert.equal(h.run.gold, h.task.gold); assert.deepEqual(h.collected, [h.task.xp]);
  assert.deepEqual(h.run.enemies.map(e => e.id), [6]);
  assert.equal(h.o.closeObjective(true), false);
});

test('the relay keeps syncing slowly while contested, unwinds when left, and reinforces on the softened cadence', async () => {
  const { RELAY } = await import('../src/world/objectives.js');
  const h = harness(), r = h.run, index = objectives.findIndex(x => x.id === 'relay');
  r.objectiveStep = index; r.time = 300; r.objective = { id: 'relay', phase: 1, x: 0, y: 0, left: 52, progress: 0, reinforceAt: 1e9 }; r.player = { x: 0, y: 0, hp: 100 };
  r.enemies = [{ id: 1, kind: 0, hp: 10, x: 20, y: 0 }];
  h.o.updateObjective(1); assert.ok(Math.abs(r.objective.progress - RELAY.contested) < 1e-9);
  r.enemies = []; h.o.updateObjective(1); assert.ok(Math.abs(r.objective.progress - (RELAY.contested + 1)) < 1e-9);
  r.player = { x: 500, y: 0, hp: 100 }; h.o.updateObjective(1); assert.ok(Math.abs(r.objective.progress - (RELAY.contested + 1 - RELAY.decay)) < 1e-9);
  assert.equal(RELAY.reinforce, 12);
});

test('a syncing relay pushes nearby enemies away every two seconds, never the guardian', async () => {
  const { RELAY } = await import('../src/world/objectives.js');
  const h = harness(), r = h.run; r.objectiveStep = objectives.findIndex(x => x.id === 'relay'); r.time = 300;
  r.objective = { id: 'relay', phase: 1, x: 0, y: 0, left: 52, progress: 0, reinforceAt: 1e9 }; r.player = { x: 0, y: 0, hp: 100 };
  const grunt = { id: 1, kind: 0, hp: 10, x: 40, y: 0 }, guardian = { id: 2, kind: 3, hp: 10, x: -40, y: 0 }; r.enemies = [grunt, guardian];
  h.o.updateObjective(.1); assert.equal(grunt.pushX, RELAY.push); assert.equal(guardian.pushX, undefined);
  grunt.pushX = 0; h.o.updateObjective(.1); assert.equal(grunt.pushX, 0, 'waits for the next pulse');
  r.time += RELAY.pulse; h.o.updateObjective(.1); assert.equal(grunt.pushX, RELAY.push);
});
