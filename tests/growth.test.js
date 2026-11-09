import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { branches } from '../src/data/specializations.js';
import { fusionRecipes } from '../src/data/fusions.js';
import { upgrades } from '../src/data/upgrades.js';
import { branchReady, fusionReady, activeFusions, weaponConsumed, fusionConsumed, hasBranch, refreshBuild } from '../src/growth/build.js';
import { availableUpgrades, growthCandidates, makeChoices, canReroll, upgradeUseful } from '../src/growth/cards.js';
import { commitSpecialization, commitFusion, commitUpgrade } from '../src/growth/commands.js';
import { retireWeaponAttacks } from '../src/combat/loadout.js';

const fresh = () => createRun(initialProfile(), { maxHp: 100, xpNext: 24 });
function ready(f) {
  const r = fresh();
  for (const [w, branch] of f.needs) { r.up[w] = 4; r.branches[w] = branch; }
  if (f.base) { assert.ok(commitFusion(r, f.base)); r.up['fusion_' + f.base] = 3; }
  return r;
}
test('all 16 specializations require level 3 and retire only the changed weapon attacks', () => {
  let count = 0;
  for (const b of branches) for (const option of b.options) {
    const r = fresh(); r.up[b.id] = 2;
    assert.equal(branchReady(r), undefined); assert.equal(commitSpecialization(r, option.id), null);
    r.up[b.id] = 3; r.arsenal.fields = [{ owner: b.id }, { owner: 'untouched' }]; r.shots = [{ kind: b.id }, { kind: 'untouched' }];
    const result = commitSpecialization(r, option.id);
    assert.equal(result.weapon.id, b.id); assert.equal(result.option.id, option.id); assert.equal(hasBranch(b.id, option.id, r), true);
    assert.deepEqual(r.arsenal.fields, [{ owner: 'untouched' }]); assert.deepEqual(r.shots, [{ kind: 'untouched' }]);
    assert.equal(commitSpecialization(r, option.id), null); assert.equal(r.up[b.id], 3); count++;
  }
  assert.equal(count, 16);
});

test('invalid growth commands do not change the supplied run', () => {
  const r = fresh(), before = structuredClone(r);
  assert.equal(commitSpecialization(r, 'unknown'), null); assert.equal(commitFusion(r, 'unknown'), null);
  assert.equal(commitFusion(r, 'fleet'), null); assert.equal(commitUpgrade(r, 'power'), false);
  assert.deepEqual(r, before); assert.equal(commitFusion(null, 'fleet'), null); assert.equal(commitUpgrade(null, 'power'), false);
});
test('changing weapon form clears its states, fields, projectiles and devices without clearing other owners', () => {
  const r = fresh(); r.arsenal.states = { mine: {}, beacon: {}, orbit: {} };
  r.arsenal.fields = [{ owner: 'mine' }, { owner: 'beacon' }, { owner: 'orbit' }];
  r.shots = [{ kind: 'mine' }, { kind: 'beacon' }, { kind: 'pulse' }]; r.mines = [{}]; r.beacons = [{}];
  retireWeaponAttacks(r, ['mine', 'beacon']);
  assert.deepEqual(r.arsenal.states, { orbit: {} }); assert.deepEqual(r.arsenal.fields, [{ owner: 'orbit' }]);
  assert.deepEqual(r.shots, [{ kind: 'pulse' }]); assert.deepEqual(r.mines, []); assert.deepEqual(r.beacons, []);
});
test('vitality computes maximum HP after increment, heals at most 25 and obeys the new cap', () => {
  for (const [hp, max, expected] of [[95, 125, 120], [95, 110, 110]]) {
    const r = fresh(); r.player.hp = hp; r.pending = 1; r.choices = ['vitality']; let calls = 0;
    assert.equal(commitUpgrade(r, 'vitality', current => { calls++; assert.equal(current, r); assert.equal(r.up.vitality, 1); return max; }), true);
    assert.equal(calls, 1); assert.equal(r.player.hp, expected); assert.equal(r.pending, 0); assert.equal(r.choices, null);
  }
});
test('first weapon upgrades reset their timers and later upgrades preserve elapsed clocks', () => {
  for (const id of ['chain', 'nova', 'lance', 'mine', 'rift', 'beacon']) {
    const r = fresh(); r.pending = 2; r.choices = [id]; r[id + 'Clock'] = 5;
    assert.equal(commitUpgrade(r, id), true); assert.equal(r[id + 'Clock'], 0);
    r[id + 'Clock'] = 2; r.choices = [id]; assert.equal(commitUpgrade(r, id), true); assert.equal(r[id + 'Clock'], 2);
  }
});
test('choice generation is deterministic, unique, eligible, nonmutating and handles exhausted pools', () => {
  const r = fresh(), before = structuredClone(r);
  const a = makeChoices(r, [], () => 0); assert.deepEqual(makeChoices(r, [], () => 0), a);
  assert.equal(a.length, 3); assert.equal(new Set(a).size, 3); assert.ok(a.every(id => availableUpgrades(r).some(u => u.id === id))); assert.deepEqual(r, before);
  const rerolled = makeChoices(r, a, () => 0); assert.equal(rerolled.length, 3); assert.ok(rerolled.some(id => !a.includes(id)));
  for (const u of upgrades) r.up[u.id] = u.max;
  assert.deepEqual(makeChoices(r, [], () => 0), []); assert.equal(canReroll(r), false);
  r.up.power = 0; assert.deepEqual(makeChoices(r, [], () => 0), ['power']); r.choices = ['power']; assert.equal(canReroll(r), false);
  r.up.speed = 0; assert.equal(canReroll(r), true); assert.equal(makeChoices(r, [], () => 0).length, 2);
});

test('growth modules use an acyclic import graph and never import current state or application code', () => {
  const visited = new Set(), active = new Set();
  function visit(url) {
    if (active.has(url.href)) assert.fail('circular module dependency: ' + url.href);
    if (visited.has(url.href)) return; active.add(url.href);
    const source = readFileSync(url, 'utf8');
    assert.doesNotMatch(source, /from ['"][^'"]*(?:core\/state|game\.js|main\.js)['"]/);
    assert.doesNotMatch(source, /\b(?:document|localStorage|window)\b/);
    for (const m of source.matchAll(/from ['"]([^'"]+)['"]/g)) visit(new URL(m[1], url));
    active.delete(url.href); visited.add(url.href);
  }
  for (const name of ['build', 'cards', 'commands', 'experience', 'rewards']) visit(new URL('../src/growth/' + name + '.js', import.meta.url));
});
