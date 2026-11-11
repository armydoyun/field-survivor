import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOORS, floorAt } from '../src/render/floor.js';
import { phases } from '../src/data/progression.js';

test('the floor changes with each phase and fades in over six seconds', () => {
  assert.equal(FLOORS.length, phases.length);
  const first = floorAt(0), second = floorAt(phases[1].at + 10), last = floorAt(phases.at(-1).at + 10);
  assert.equal(first.mark, null); assert.equal(second.mark, FLOORS[1].mark); assert.notEqual(first.bg, last.bg);
  const start = floorAt(phases[3].at), mid = floorAt(phases[3].at + 3), done = floorAt(phases[3].at + 6);
  assert.equal(start.markAlpha, 0); assert.equal(mid.markAlpha, .5); assert.equal(done.markAlpha, 1);
  assert.equal(start.bg, `rgb(${FLOORS[2].bg.join(',')})`);
  assert.equal(done.bg, `rgb(${FLOORS[3].bg.join(',')})`);
});
