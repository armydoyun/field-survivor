import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile, hydrateProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { xpNeed } from '../src/growth/experience.js';
import { lastRecordOpen, beginLastRecord, tickLastRecord, truthFoundIds } from '../src/world/last-record.js';
import { stokerEligible, STOKER } from '../src/world/stoker.js';
import { createEndingDecisions } from '../src/world/ending-decisions.js';
import { createModalContent } from '../src/ui/modal-content.js';
import { restoreRun } from '../src/save/restore-run.js';
import { lastRecord, startScenes, endingTexts, truthPieces } from '../src/data/world.js';

function allTruths(profile) { const m = profile.memory; m.witness.quiet = true; m.stoker.origin = true; for (const id of ['preserve', 'consume', 'divided', 'release']) m.endings[id] = 1; }
function state(open = true) { const s = { profile: initialProfile(), run: null, replaceRun: r => { s.run = r; } }; if (open) allTruths(s.profile); s.run = createRun(s.profile, { maxHp: 100, xpNext: xpNeed(1) }); return s; }

test('the last record opens only after all six truth pieces, starts with its own scene and three timed last words', () => {
  const closed = state(false); assert.equal(lastRecordOpen(closed.profile.memory), false); assert.equal(beginLastRecord(closed.profile, closed.run), false); assert.equal(closed.run.lastRecord, undefined);
  const s = state(); assert.equal(truthFoundIds(s.profile.memory).length, truthPieces.length);
  assert.equal(beginLastRecord(s.profile, s.run), true); assert.ok(s.run.logs.some(l => l.includes(lastRecord.start)));
  for (const [i, w] of lastRecord.words.entries()) { s.run.time = w.at - 1; tickLastRecord(s.profile, s.run); assert.equal(s.run.lastRecord.said, i); s.run.time = w.at; tickLastRecord(s.profile, s.run); assert.ok(s.run.logs.includes(w.line)); }
  s.run.time = 1800; assert.equal(tickLastRecord(s.profile, s.run), false);
  const heard = state(); beginLastRecord(heard.profile, heard.run); heard.run.npc.state = 'heard'; heard.run.signalChoices = ['hear', 'hear', 'hear']; heard.run.time = STOKER.at;
  assert.equal(stokerEligible(heard.run), true, 'the stoker comes even on a preserve run');
});

test('stopping the device ends the run with three scenes and credits, counts apart from endings and starts a new cycle', () => {
  const s = state(); beginLastRecord(s.profile, s.run); const r = s.run; r.finalStep = 3; r.time = 1800; r.signalChoices = ['hear', 'hear', 'hear'];
  const choice = createModalContent({ sessionState: s, view: { mode: 'finalchoice' }, route: () => ({ ending: 'preserve', release: false }) }).buildModal();
  assert.ok(choice.includes('data-action="final-last"') && choice.includes('data-action="final-preserve"'));
  const before = { ...s.profile.memory.endings }, result = createEndingDecisions({ sessionState: s }).chooseFinale('last');
  assert.equal(result.endingId, 'last'); assert.equal(result.scenes.length, 3); assert.ok(result.scenes[2].endsWith(endingTexts.last.tail));
  assert.deepEqual(s.profile.memory.endings, before); assert.equal(s.profile.memory.lastRecord, 1); assert.equal(s.profile.memory.lastResolution.ending, 'last');
  const html = createModalContent({ sessionState: s, view: { mode: 'ending', lastResult: result }, route: () => null }).buildModal();
  assert.ok(html.includes(lastRecord.name) && html.includes(endingTexts.last.intro.slice(0, 12)));
  const next = createRun(s.profile, { maxHp: 100, xpNext: 24 }); assert.equal(next.legacyOrigin, 'last'); assert.ok(startScenes.last.line);
  const back = initialProfile(); hydrateProfile(back, JSON.parse(JSON.stringify(s.profile))); assert.equal(back.memory.lastRecord, 1); assert.equal(back.memory.lastResolution.ending, 'last');
  assert.equal(restoreRun(JSON.parse(JSON.stringify(next)), s.profile).legacyOrigin, 'last');
});

test('the last-record choice is refused on ordinary runs and its flag only survives a restore while the truths are complete', () => {
  const plain = state(); plain.run.finalStep = 3; assert.equal(createEndingDecisions({ sessionState: plain }).chooseFinale('last'), null);
  const s = state(); beginLastRecord(s.profile, s.run); s.run.lastRecord.said = 2;
  assert.deepEqual(restoreRun(JSON.parse(JSON.stringify(s.run)), s.profile).lastRecord, { said: 2 });
  assert.equal(restoreRun(JSON.parse(JSON.stringify(s.run)), initialProfile()).lastRecord, undefined);
});

test('the ledger names the last record and shows how to open it once every truth is found', () => {
  const s = state(); s.profile.runs = 2;
  let ledger = createModalContent({ sessionState: s, view: { mode: 'ledger' }, route: () => null }).buildModal();
  assert.ok(ledger.includes(lastRecord.ledger));
  s.profile.memory.lastRecord = 1; s.profile.memory.lastResolution = { ending: 'last', variant: '', threads: [], scenes: lastRecord.scenes };
  ledger = createModalContent({ sessionState: s, view: { mode: 'ledger' }, route: () => null }).buildModal();
  assert.ok(ledger.includes(`마지막 결말 · ${lastRecord.name}`) && ledger.includes('장치를 멈췄다 · 1회'));
});
