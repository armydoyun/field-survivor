import test from 'node:test';
import assert from 'node:assert/strict';
import { nearestEnemy, nearestEnemyIn } from '../src/combat/targeting.js';
import { toggleFocus } from '../src/input/keyboard.js';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { restoreRun } from '../src/save/restore-run.js';

function setup() {
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 });
  run.player = { x: 0, y: 0, hp: 100, hurt: 0 };
  run.enemies = [{ id: 1, kind: 0, hp: 10, x: 30, y: 0, radius: 10 }, { id: 2, kind: 3, named: true, hp: 900, phase: 0, x: 300, y: 0, radius: 26 }];
  return { profile, run };
}

test('T toggles guardian focus: weapons aimed from the player pick the guardian in range, devices keep their own nearest target', () => {
  const { run } = setup();
  assert.equal(nearestEnemy(run).id, 1);
  assert.equal(toggleFocus(run), true);
  assert.equal(nearestEnemy(run).id, 2); assert.equal(nearestEnemyIn(run, 400).id, 2);
  assert.equal(nearestEnemyIn(run, 200).id, 1, 'out of range falls back to nearest');
  assert.equal(nearestEnemyIn(run, 400, 290, 0).id, 2); assert.equal(nearestEnemyIn(run, 400, 40, 0).id, 1, 'devices use their own position');
  run.enemies[1].phase = 3; run.enemies[1].hp = 0; assert.equal(nearestEnemy(run).id, 1, 'a yielding guardian is not a target');
  assert.equal(toggleFocus(run), false); assert.equal('focusGuardian' in run, false);
});

test('guardian focus survives a save restore', () => {
  const { profile, run } = setup(); toggleFocus(run); run.enemies = [];
  assert.equal(restoreRun(JSON.parse(JSON.stringify(run)), profile).focusGuardian, true);
});
