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

test('the stoker comes at 13 minutes only when the archivist was not heard, once per run', () => {
  const h = harness();
  at(h, STOKER.at - 1); assert.equal(h.k.spawnStoker(), false);
  at(h, STOKER.at); assert.equal(h.k.spawnStoker(), true); assert.equal(h.s.run.stoker.state, 'waiting'); assert.ok(h.s.run.logs.includes(stokerLines.arrive));
  assert.equal(h.k.spawnStoker(), false);
  const heard = harness(); heard.s.run.npc.state = 'heard'; at(heard, STOKER.at); assert.equal(heard.k.spawnStoker(), false); assert.equal(heard.s.run.stoker, undefined);
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
