import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile, hydrateProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createHints } from '../src/ui/hints.js';
import { hints, HINT_SECONDS } from '../src/data/hints.js';

function harness() {
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 }), sessionState = { profile, run }, calls = [];
  const ctx = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 100 }) : () => calls.push(k), set: () => true });
  return { profile, run, sessionState, h: createHints({ sessionState, platform: { ctx } }), calls };
}

test('each first-play hint appears once when its mechanic first shows up, then stays quiet', () => {
  const t = harness();
  assert.equal(t.h.tickHints(), null);
  t.run.npc.spawned = true; t.run.npc.state = 'waiting';
  assert.equal(t.h.tickHints().id, 'witness');
  assert.deepEqual(t.profile.memory.hints, ['witness']);
  t.run.time += HINT_SECONDS - .1; assert.equal(t.h.tickHints().id, 'witness');
  t.run.time += .2; assert.equal(t.h.tickHints(), null);
  t.run.signalChoices = ['hear', 'hear']; assert.equal(t.h.tickHints().id, 'route');
  t.run.time += HINT_SECONDS + 1; t.run.npc.state = 'waiting'; assert.equal(t.h.tickHints(), null);
  assert.deepEqual(t.profile.memory.hints, ['witness', 'route']);
  t.h.drawHint(); assert.equal(t.calls.length, 0);
});

test('guardian and shield hints follow their states; the banner draws while active; saved IDs are validated', () => {
  const t = harness();
  t.run.enemies = [{ id: 4, kind: 3, named: true, phase: 3, hp: 0, x: 0, y: 0 }]; t.run.bossChoiceId = 4;
  assert.equal(t.h.tickHints().id, 'guardian'); t.h.drawHint(); assert.ok(t.calls.includes('fillText'));
  t.run.time += HINT_SECONDS + 1; t.run.enemies = []; t.run.finalStep = 2; t.run.journey.core = { shields: 2 };
  assert.equal(t.h.tickHints().id, 'shield');
  const restored = initialProfile(); hydrateProfile(restored, { memory: { hints: ['route', 'bogus', 'route', 'shield'] } });
  assert.deepEqual(restored.memory.hints, hints.map(h => h.id).filter(id => ['route', 'shield'].includes(id)));
});

test('pillar and drift hints appear when the battlefield changes', () => {
  const t = harness();
  t.run.time = 600; assert.equal(t.h.tickHints().id, 'pillar');
  t.run.time += HINT_SECONDS + 1; assert.equal(t.h.tickHints(), null);
  t.run.drift = { next: 0, count: 1, zones: [{ x: 0, y: 0 }] }; assert.equal(t.h.tickHints().id, 'drift');
});
