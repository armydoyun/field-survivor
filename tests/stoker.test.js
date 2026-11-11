import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile, hydrateProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { xpNeed } from '../src/growth/experience.js';
import { createStoker, STOKER, stokerEligible } from '../src/world/stoker.js';
import { createEndingDecisions } from '../src/world/ending-decisions.js';
import { routeAxes } from '../src/world/route.js';
import { restoreRun } from '../src/save/restore-run.js';
import { stokerLines, truthFound } from '../src/data/world.js';
import { stokerReward } from '../src/data/world-choices.js';

function harness() {
  const s = { profile: initialProfile(), run: null, replaceRun: r => { s.run = r; } };
  s.run = createRun(s.profile, { maxHp: 100, xpNext: xpNeed(1) });
  const statistics = createStatistics({ sessionState: s }), saves = [];
  return { s, saves, k: createStoker({ sessionState: s, statistics, storage: { save: () => saves.push(1) } }) };
}
const at = (h, t) => { h.s.run.time = t; };

test('the stoker comes at 13 minutes when the archivist was not heard or the run stayed near the middle, once per run', () => {
  const h = harness();
  at(h, STOKER.at - 1); assert.equal(h.k.spawnStoker(), false);
  at(h, STOKER.at); assert.equal(h.k.spawnStoker(), true); assert.equal(h.s.run.stoker.state, 'waiting'); assert.ok(h.s.run.logs.includes(stokerLines.arrive));
  assert.equal(h.k.spawnStoker(), false);
  const heard = harness(); heard.s.run.npc.state = 'heard'; heard.s.run.signalChoices = ['hear', 'hear']; at(heard, STOKER.at); assert.equal(heard.k.spawnStoker(), false); assert.equal(heard.s.run.stoker, undefined);
  const middle = harness(); middle.s.run.npc.state = 'heard'; middle.s.run.signalChoices = ['hear', 'burn']; at(middle, STOKER.at); assert.equal(middle.k.spawnStoker(), true);
  const chorus = harness(); chorus.s.run.npc.state = 'heard'; chorus.s.run.signalChoices = ['hear', 'hear', 'hear']; chorus.s.run.legacyVariant = 'chorus'; at(chorus, 390); assert.equal(chorus.k.spawnStoker(), true);
  const late = harness(); late.s.run.finalStep = 1; at(late, STOKER.at); assert.equal(stokerEligible(late.s.run), false);
});

test('E nearby stokes the fire: burn power, memory axis down, profile count', () => {
  const h = harness(); at(h, STOKER.at); h.k.spawnStoker();
  const before = routeAxes(h.s.run).memory;
  assert.equal(h.k.stokeFire(), false, 'too far');
  h.s.run.player.x = h.s.run.stoker.x; h.s.run.player.y = h.s.run.stoker.y;
  assert.equal(h.k.stokeFire(), true);
  assert.equal(h.s.run.stoker.state, 'stoked'); assert.equal(h.s.run.signalPower, stokerReward.power);
  assert.equal(routeAxes(h.s.run).memory, before - 1); assert.equal(h.s.profile.memory.stoker.stoked, 1);
  assert.equal(h.k.stokeFire(), false, 'only once');
});

test('standing still beside the stoker quenches the fire; ignoring him lets him leave', () => {
  const h = harness(); at(h, STOKER.at); h.k.spawnStoker(); h.s.run.player.hp = 50;
  h.s.run.player.x = h.s.run.stoker.x; h.s.run.player.y = h.s.run.stoker.y;
  h.k.tickStoker(1, false); h.k.tickStoker(1, true); assert.equal(h.s.run.stoker.still, 0, 'moving resets');
  for (let i = 0; i < 3; i++) h.k.tickStoker(1.01, false);
  assert.equal(h.s.run.stoker.state, 'quenched'); assert.equal(h.s.run.player.hp, 50 + stokerReward.heal); assert.equal(routeAxes(h.s.run).memory, 1);
  const away = harness(); at(away, STOKER.at); away.k.spawnStoker(); at(away, STOKER.at + STOKER.stay); away.k.tickStoker(.1, false);
  assert.equal(away.s.run.stoker.state, 'left'); assert.ok(away.s.run.logs.includes(stokerLines.left)); assert.equal(routeAxes(away.s.run).memory, 0);
});

test('stoking then reaching the undying engine shows the stoker scene and opens the origin truth piece once', () => {
  const run = (prepare) => { const h = harness(), r = h.s.run; r.signalChoices = ['burn', 'burn', 'burn']; r.finalStep = 3; r.time = 1800; r.stoker = { state: 'waiting', x: 0, y: 0, still: 0, until: 9999 }; prepare(r); return [h, createEndingDecisions({ sessionState: h.s }).chooseFinale('consume')]; };
  let [h, result] = run(r => { r.stoker.state = 'stoked'; });
  assert.ok(result.scenes[0].endsWith(stokerLines.endingStoked)); assert.equal(h.s.profile.memory.stoker.origin, true);
  assert.equal(h.s.profile.memory.archive.filter(x => x === truthFound).length >= 1, true);
  assert.ok(result.threads.some(x => x.startsWith('화부 · 함께')));
  [h, result] = run(r => { r.stoker.state = 'quenched'; r.npc.state = 'taken'; r.siteDecisions.reservoir = 'take'; });
  assert.ok(result.scenes[0].endsWith(stokerLines.endingQuenched)); assert.equal(h.s.profile.memory.stoker.origin, false);
});

test('stoker state survives save restore and profile hydration validates it', () => {
  const h = harness(); at(h, STOKER.at); h.k.spawnStoker(); h.s.run.stoker.still = 1.5;
  const back = restoreRun(JSON.parse(JSON.stringify(h.s.run)), h.s.profile);
  assert.deepEqual(back.stoker, h.s.run.stoker);
  const bad = restoreRun({ ...JSON.parse(JSON.stringify(h.s.run)), stoker: { state: 'bogus' } }, h.s.profile); assert.equal(bad.stoker, undefined);
  const p = initialProfile(); hydrateProfile(p, { memory: { stoker: { met: 2, stoked: 1, quenched: -4, origin: 'yes' } } });
  assert.deepEqual(p.memory.stoker, { met: 2, stoked: 1, quenched: 0, origin: false });
});

test('two voices: hearing the archivist and settling with the stoker turns the divided ending into the chorus, which carries into the next run', async () => {
  const { endingScenes, endingTexts, startScenes } = await import('../src/data/world.js');
  const { createModalContent } = await import('../src/ui/modal-content.js');
  for (const state of ['stoked', 'quenched']) {
    const h = harness(), r = h.s.run; r.signalChoices = ['hear', 'burn', 'burn']; r.npc.state = 'heard'; r.finalStep = 3; r.time = 1800; r.stoker = { state, x: 0, y: 0, still: 0, until: 0 };
    const result = createEndingDecisions({ sessionState: h.s }).chooseFinale('divided');
    assert.equal(result.variant, 'chorus'); assert.equal(result.scenes[0], endingScenes.witness.chorus[state]);
    assert.ok(h.s.profile.memory.archive.some(x => x.includes('두 개의 목소리 · 합창')));
    assert.equal(h.s.profile.memory.variants.chorus, 1);
    const html = createModalContent({ sessionState: h.s, view: { mode: 'ending', lastResult: result }, route: () => null }).buildModal();
    assert.ok(html.includes('합창')); assert.ok(html.includes(endingTexts.chorus.intro.slice(0, 20)));
    const next = createRun(h.s.profile, { maxHp: 100, xpNext: 24 }); assert.equal(next.legacyVariant, 'chorus'); assert.ok(startScenes.chorus.change.includes('6:30'));
    const p = initialProfile(); hydrateProfile(p, JSON.parse(JSON.stringify(h.s.profile))); assert.equal(p.memory.lastResolution.variant, 'chorus');
    const back = restoreRun(JSON.parse(JSON.stringify(next)), h.s.profile); assert.equal(back.legacyVariant, 'chorus');
  }
  const left = harness(), r = left.s.run; r.signalChoices = ['hear', 'burn', 'burn']; r.npc.state = 'heard'; r.finalStep = 3; r.time = 1800; r.stoker = { state: 'left', x: 0, y: 0, still: 0, until: 0 };
  assert.equal(createEndingDecisions({ sessionState: left.s }).chooseFinale('divided').variant, '');
  const p = initialProfile(); hydrateProfile(p, { memory: { lastResolution: { ending: 'preserve', variant: 'chorus', threads: [] } } }); assert.equal(p.memory.lastResolution.variant, '');
});
