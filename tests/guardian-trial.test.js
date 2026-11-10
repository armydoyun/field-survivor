import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuardians } from '../src/combat/guardians.js';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { restoreRun } from '../src/save/restore-run.js';
import { GUARDIAN_TRIAL, GUARDIAN_YIELD } from '../src/core/config.js';

function setup() {
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 }), hits = [];
  const g = createGuardians({ attacks: { groundMark() {}, enemyShot() {} }, movementVector: () => ({ x: 0, y: 0 }), hurtPlayer: v => hits.push(v), random: () => 0 });
  run.player = { x: 0, y: 0, hp: 100, hurt: 0 };
  const e = { id: 9, kind: 3, named: true, x: 900, y: 0, hp: 1000, maxHp: 1000, phase: 0, aiTimer: 5, radius: 26 };
  run.enemies = [e]; run.guardianMeet = 1; run.guardianMeetAt = 150;
  return { profile, run, g, e, move: () => g.moveGuardian(run, profile, e, 1 / 60, 0, 900, 0, 0) };
}

test('surviving the guardian trial makes it lower its weapon between attacks, leading to the same spare or end choice', () => {
  const t = setup();
  t.run.time = 150 + GUARDIAN_TRIAL[0] - .1; t.move(); assert.equal(t.e.phase, 0); assert.equal(t.run.bossChoiceId, 0);
  t.run.time = 150 + GUARDIAN_TRIAL[0]; t.e.phase = 2; t.e.guardianAttack = { kind: 'bloom', clock: 9, step: 0 }; t.move(); assert.notEqual(t.e.phase, 3, 'not in the middle of an attack');
  t.e.phase = 4; t.e.aiTimer = 1; t.move();
  assert.equal(t.e.phase, 3); assert.equal(t.e.hp, 0); assert.equal(t.e.trialYield, true); assert.equal(t.run.bossChoiceId, 9); assert.equal(t.e.yieldUntil, t.run.time + GUARDIAN_YIELD);
});

test('the trial grows with each meeting, skips hollow guardians and survives a save restore', () => {
  const t = setup(); t.run.guardianMeet = 3; t.run.guardianMeetAt = 1200;
  t.run.time = 1200 + GUARDIAN_TRIAL[1]; t.move(); assert.equal(t.e.phase, 0);
  t.run.time = 1200 + GUARDIAN_TRIAL[2]; t.move(); assert.equal(t.e.phase, 3);
  const h = setup(); h.e.named = false; h.e.hollow = true; h.run.time = 999; h.move(); assert.equal(h.e.phase, 0);
  const back = restoreRun(JSON.parse(JSON.stringify({ ...t.run, enemies: [] })), t.profile); assert.equal(back.guardianMeetAt, 1200);
});
