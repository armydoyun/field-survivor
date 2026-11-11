import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { createDifficulty, CORE_PACE } from '../src/core/difficulty.js';

// 중심핵 HP는 추정 화력 × 효율 × 목표 시간으로 정하고 하한 · 상한으로 자른다(NARRATIVE-REDESIGN.md 12절).
function rating(up) {
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 }), sessionState = { profile, run };
  Object.assign(run.up, up);
  const statistics = createStatistics({ sessionState });
  return createDifficulty({ sessionState, statistics }).finalRating(run);
}

test('core HP follows estimated firepower toward the target duration, within the floor and ceiling', () => {
  const weak = rating({});
  assert.equal(weak.hp, CORE_PACE.minHp);
  const strong = rating({ pulse: 5, power: 8, haste: 5, multishot: 4, crit: 4, focus: 4, nova: 5, rift: 5, chain: 5, orbit: 5 });
  assert.ok(strong.power * CORE_PACE.efficiency * CORE_PACE.seconds > CORE_PACE.minHp);
  assert.equal(strong.hp, Math.round(Math.min(CORE_PACE.maxHp, strong.power * CORE_PACE.efficiency * CORE_PACE.seconds)));
  assert.ok(strong.hp > weak.hp);
  assert.ok(CORE_PACE.maxHp >= CORE_PACE.minHp && CORE_PACE.seconds > 0);
});
