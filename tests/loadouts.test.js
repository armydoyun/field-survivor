import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile } from '../src/core/profile.js';
import { createStatistics } from '../src/core/statistics.js';
import { createSession } from '../src/core/session.js';
import { loadouts, unlockedLoadouts, startWeaponLevel } from '../src/data/loadouts.js';
import { pulseDormant, pulseActive } from '../src/growth/build.js';
import { restoreRun } from '../src/save/restore-run.js';
import { encodeSave } from '../src/save/format.js';
import { createModalContent } from '../src/ui/modal-content.js';

function harness(profile = initialProfile()) {
  const s = { profile, run: null, replaceRun: r => { s.run = r; } }, view = { mode: 'menu' }, modes = [];
  const session = createSession({ sessionState: s, view, platform: { keys: new Set() }, statistics: createStatistics({ sessionState: s }), screen: { setMode: m => { view.mode = m; modes.push(m); } }, storage: { save() {} }, seedSource: () => 7 });
  return { s, view, modes, session };
}

test('unlocks come from saved endings, the stillness secret and lifetime records', () => {
  const m = initialProfile().memory;
  assert.deepEqual(unlockedLoadouts(m), ['pulse']);
  m.endings.preserve = 1; m.endings.release = 2; m.witness.quiet = true; m.guardian.spared = 3; m.deaths = 2;
  assert.deepEqual(unlockedLoadouts(m), ['pulse', 'nova', 'orbit', 'beacon', 'lance']);
  assert.equal(loadouts.length, 8);
});

test('with only pulse open a new game starts at once; otherwise the loadout screen comes first', () => {
  const plain = harness(); plain.session.startFresh();
  assert.ok(plain.s.run); assert.equal(plain.s.run.startWeapon, undefined); assert.equal(plainEncodedHasStart(plain.s), false);
  const p = initialProfile(); p.memory.endings.preserve = 1; const h = harness(p);
  h.session.startFresh(); assert.equal(h.s.run, null); assert.equal(h.view.mode, 'loadout');
  h.session.startFresh(true, 'rift'); assert.equal(h.s.run, null, 'locked weapons are refused');
  h.session.startFresh(true, 'nova'); assert.equal(h.s.run.startWeapon, 'nova'); assert.equal(h.s.run.up.nova, 2); assert.equal(startWeaponLevel('lance'), 3); assert.equal(startWeaponLevel('chain'), 3);
  assert.equal(pulseDormant(h.s.run), true); assert.equal(pulseActive(h.s.run), false);
  h.s.run.up.pulse = 1; assert.equal(pulseActive(h.s.run), true);
});
function plainEncodedHasStart(s) { return 'startWeapon' in JSON.parse(encodeSave(s.profile, s.run)).run; }

test('the start weapon survives save and restore, and unknown values fall back to pulse', () => {
  const p = initialProfile(); p.memory.endings.consume = 1; const h = harness(p); h.session.startFresh(true, 'rift');
  const raw = JSON.parse(encodeSave(h.s.profile, h.s.run)).run;
  assert.equal(restoreRun(raw, p).startWeapon, 'rift');
  assert.equal(restoreRun({ ...raw, startWeapon: 'laser' }, p).startWeapon, undefined);
});

test('the loadout screen lists open weapons as choices and locked ones with their conditions', () => {
  const p = initialProfile(); p.memory.endings.divided = 1; const view = { mode: 'loadout' };
  const html = createModalContent({ sessionState: { profile: p, run: null }, view, route: () => null }).buildModal();
  assert.ok(html.includes('data-action="start-pulse"')); assert.ok(html.includes('data-action="start-chain"'));
  assert.ok(!html.includes('data-action="start-nova"')); assert.ok(html.includes('남겨진 목소리')); assert.ok(html.includes('loadout-back'));
});
