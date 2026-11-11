import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { xpNeed } from '../src/growth/experience.js';
import { createStoker, STOKER } from '../src/world/stoker.js';
import { createStory } from '../src/world/story.js';
import { createEndingDecisions } from '../src/world/ending-decisions.js';
import { stokerLines, guardianLines, endingScenes, truthReveal, truthPieces } from '../src/data/world.js';

function state() { const s = { profile: initialProfile(), run: null, replaceRun: r => { s.run = r; } }; s.run = createRun(s.profile, { maxHp: 100, xpNext: xpNeed(1) }); return s; }

test('THREAD-AUDIT 2 · 4: the stoker tells his story one paragraph per meeting and admits sealing the storehouse', () => {
  for (const [met, expected] of [[0, null], [1, 0], [2, 1], [5, 2]]) {
    const s = state(); s.profile.memory.stoker.met = met; s.run.time = STOKER.at;
    createStoker({ sessionState: s, statistics: createStatistics({ sessionState: s }) }).spawnStoker();
    const said = stokerLines.story.filter(line => s.run.logs.includes(line));
    assert.deepEqual(said, expected === null ? [] : [stokerLines.story[expected]], `met ${met}`);
  }
  for (const choice of ['keep', 'take']) {
    const s = state(); s.run.time = STOKER.at; s.run.siteDecisions.reservoir = choice;
    createStoker({ sessionState: s, statistics: createStatistics({ sessionState: s }) }).spawnStoker();
    assert.ok(s.run.logs.includes(stokerLines.reservoir[choice]));
  }
});

test('THREAD-AUDIT 3: Ian claims signal 02 on his first named arrival once he has his name, and in the open door', () => {
  const arrive = (spared, meet) => { const s = state(), lines = []; s.profile.memory.guardian.spared = spared; s.run.guardianMeet = meet;
    createStory({ sessionState: s, view: { mode: 'playing' }, platform: { keys: new Set() }, screen: {}, storage: { save() {} }, session: { record: l => lines.push(l) }, decisions: {}, feedback: {} }).recordGuardianArrival({ named: true });
    return lines; };
  assert.ok(arrive(6, 1).includes(guardianLines.signal)); assert.ok(!arrive(6, 2).includes(guardianLines.signal)); assert.ok(!arrive(3, 1).includes(guardianLines.signal));
});

test('THREAD-AUDIT 5: the silent archive warmth appears in the exit scene by the archive choice', () => {
  for (const choice of ['keep', 'take']) {
    const s = state(), r = s.run; r.signalChoices = ['hear', 'hear', 'hear']; r.npc.state = 'heard'; r.finalStep = 3; r.time = 1800; r.siteDecisions.archive = choice;
    const result = createEndingDecisions({ sessionState: s }).chooseFinale('preserve');
    assert.ok(result.scenes[2].includes(endingScenes.exit.archive[choice]), choice);
  }
});

test('THREAD-AUDIT 1 · 6: the full truth names the stoker and Ian; the two makers stay nameless', () => {
  assert.ok(truthReveal.includes('화부') && truthReveal.includes('기록원') && truthReveal.includes('이안'));
  const origin = truthPieces.find(p => p.id === 'origin').text;
  assert.ok(origin.includes('읽을 수 없다') && origin.includes('저장고'));
});
