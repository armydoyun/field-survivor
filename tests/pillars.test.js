import test from 'node:test';
import assert from 'node:assert/strict';
import { PILLAR, pillarsActive, pillarsNear, pillarBlocks } from '../src/world/pillars.js';
import { phases } from '../src/data/progression.js';

test('pillars stand from the third phase until the final core and block enemy shots that cross them', () => {
  assert.equal(pillarsActive({ time: phases[PILLAR.fromPhase].at - 1, finalStep: 0 }), false);
  assert.equal(pillarsActive({ time: phases[PILLAR.fromPhase].at, finalStep: 0 }), true);
  assert.equal(pillarsActive({ time: 1700, finalStep: 2 }), false);
  const near = pillarsNear(0, 0, 3000);
  assert.ok(near.length > 20);
  assert.ok(near.every(p => Math.hypot(p.x, p.y) >= PILLAR.keepClear));
  assert.deepEqual(pillarsNear(0, 0, 3000), near);
  const p = near[0];
  assert.ok(pillarBlocks(p.x - 60, p.y, p.x + 60, p.y, 4));
  assert.equal(pillarBlocks(p.x - 60, p.y + 80, p.x + 60, p.y + 80, 4), null);
});
