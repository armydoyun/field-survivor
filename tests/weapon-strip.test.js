import test from 'node:test';
import assert from 'node:assert/strict';
import { stripWeapons, weaponCooldown } from '../src/render/weapon-strip.js';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';

test('the in-game weapon strip lists active weapons in a fixed order and reports remaining cooldown', () => {
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 }), st = createStatistics({ sessionState: { profile, run } });
  run.player = { x: 0, y: 0, hp: 100, hurt: 0 };
  assert.deepEqual(stripWeapons(run), ['pulse']);
  run.up.rift = 2; run.up.nova = 1; assert.deepEqual(stripWeapons(run), ['pulse', 'nova', 'rift']);
  const s = st.stats(run);
  run.riftClock = st.riftInterval(s) / 2; assert.ok(Math.abs(weaponCooldown('rift', run, s, st) - .5) < 1e-9);
  run.novaClock = 0; assert.equal(weaponCooldown('nova', run, s, st), 0);
  assert.equal(weaponCooldown('orbit', run, s, st), null);
  run.startWeapon = 'rift'; assert.deepEqual(stripWeapons(run), ['nova', 'rift'], 'dormant pulse hidden');
});
