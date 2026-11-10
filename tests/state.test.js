import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialProfile, hydrateProfile, appendRecord } from '../src/core/profile.js';
import { createRun, makeJourney } from '../src/core/run.js';
import * as state from '../src/core/state.js';
import { VERSION, W, H, FIRST_GUARDIAN, HARVEST_CAP, SAVE_KEY } from '../src/core/config.js';

const create = profile => createRun(profile, { maxHp: 135, xpNext: 24 });
test('independent profiles and runs own their mutable records and collections', () => {
  const a = initialProfile(), b = initialProfile(), r = create(a), other = create(a);
  a.perks.reroll = 3; a.memory.witness.heard = 2; a.memory.archive.push('record');
  assert.equal(b.perks.reroll, 0); assert.equal(b.memory.witness.heard, 0); assert.deepEqual(b.memory.archive, []);
  r.player.hp = 1; r.arsenal.fields.push({ type: 'rift' }); r.director.damage = 100; r.journey.outcomes.push('used'); r.guardianFate.end++;
  assert.equal(other.player.hp, 135); assert.deepEqual(other.arsenal.fields, []); assert.equal(other.director.damage, 0);
  assert.deepEqual(other.journey.outcomes, []); assert.equal(other.guardianFate.end, 0);
  const next = create(a);
  assert.equal(next.rerolls, 3); assert.equal(next.player.x, W / 2); assert.equal(next.player.y, H / 2);
  assert.equal(next.xpNext, 24); assert.equal(next.nextBoss, FIRST_GUARDIAN); assert.equal(next.harvestBudget, HARVEST_CAP);
  assert.equal(next.echoSeed, undefined); assert.equal(next.legacyVariant, '');
});
test('journey generation has explicit randomness and preserves supplied plans', () => {
  let calls = 0;
  const j = makeJourney(undefined, () => { calls++; return 0; });
  assert.equal(calls, 6);
  assert.deepEqual(j.plan, [
    { at: 435, kind: 'witness', slot: 0 }, { at: 825, kind: 'relay', slot: 1 },
    { at: 1185, kind: 'guardian', slot: 2 }, { at: 1575, kind: 'gates', slot: 3 }
  ]);
  const profile = initialProfile(), plan = [{ at: 500, kind: 'witness', slot: 0 }];
  const journey = makeJourney(plan, () => { throw Error('RNG must not be called'); });
  assert.equal(createRun(profile, { journey, maxHp: 100, xpNext: 24 }).journey, journey);
  assert.equal(journey.plan, plan);
});
test('a new run carries the previous ending and its hollow variant as the start scene only', () => {
  const p = initialProfile();
  assert.equal(createRun(p, { maxHp: 100, xpNext: 24 }).legacyOrigin, null);
  p.memory.lastResolution = { ending: 'consume', variant: 'hollow', threads: [], scenes: [] };
  const r = createRun(p, { maxHp: 100, xpNext: 24 }); assert.equal(r.legacyOrigin, 'consume'); assert.equal(r.legacyVariant, 'hollow');
  for (const key of ['legacySite', 'legacyChoice', 'legacyPending', 'echoOutcomes', 'frontChoices']) assert.equal(key in r, false, key);
});
test('profile hydration retains save validation, whitelist filtering and size limits', () => {
  const p = initialProfile(), raw = {
    gold: -10, bestTime: Infinity, runs: 3.9, perks: { power: 1e9, health: -2, unknown: 100 },
    memory: { heard: 1e9, witness: { met: -1, heard: 2.9, taken: '4', quiet: 1 },
      archive: Array.from({ length: 12 }, (_, i) => String(i) + 'x'.repeat(150)),
      chapters: ['새벽의 기록', 'unknown'], fusions: { fleet: 4.9, unknown: 99 },
      endings: { preserve: 1e9 }, lastResolution: { ending: 'unknown', threads: [] } }
  };
  const before = structuredClone(raw);
  assert.equal(hydrateProfile(p, raw), p);
  assert.deepEqual(raw, before);
  assert.equal(p.gold, 0); assert.equal(p.bestTime, 0); assert.equal(p.runs, 3);
  assert.equal(p.perks.health, 0); assert.ok(p.perks.power > 0 && p.perks.power < 1e9); assert.equal(p.perks.unknown, undefined);
  assert.equal(p.memory.heard, 10000); assert.deepEqual(p.memory.witness, { met: 0, heard: 2, taken: 0, quiet: false });
  assert.equal(p.memory.archive.length, 8); assert.ok(p.memory.archive.every(x => x.length <= 110));
  assert.equal(p.memory.chapters, undefined); assert.equal(p.memory.fusions.fleet, 4); assert.equal(p.memory.fusions.unknown, undefined);
  assert.equal(p.memory.endings.preserve, 99999); assert.equal(p.memory.lastResolution, null);
  assert.doesNotThrow(() => hydrateProfile(initialProfile(), {}));
});
test('bounded logs update only the supplied profile and run', () => {
  const p = initialProfile(), r = create(p), untouched = initialProfile();
  for (let i = 0; i < 12; i++) appendRecord(p, r, String(i));
  assert.deepEqual(r.logs, ['6', '7', '8', '9', '10', '11']);
  assert.deepEqual(p.memory.archive, ['4', '5', '6', '7', '8', '9', '10', '11']);
  assert.deepEqual(untouched.memory.archive, []);
});
test('live state bindings follow replacement and reset without modifying former runs', () => {
  state.resetState(); const oldProfile = state.profile, first = create(oldProfile);
  state.replaceRun(first); assert.equal(state.run, first);
  const second = create(oldProfile); state.replaceRun(second); assert.equal(state.run, second);
  state.profile.gold = 50; state.resetState();
  assert.equal(state.run, null); assert.notEqual(state.profile, oldProfile); assert.equal(state.profile.gold, 0);
  assert.equal(oldProfile.gold, 50); assert.equal(first.player.hp, 135);
});
test('version metadata is consistent and the persistent save key is unchanged', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, '2.8.0'); assert.equal(pkg.version, VERSION); assert.equal(SAVE_KEY, 'field-survivor.v1');
});
