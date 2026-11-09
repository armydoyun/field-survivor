import { canPauseGame, canResetRecords } from './view-policy.js';
import { commitRunStart, commitRunResult } from './run-lifecycle.js';
import { makeRandomState, nextRandom, newSeed } from './random.js';
import { appendRecord } from './profile.js';
import { makeJourney, createRun } from './run.js';
import { xpNeed } from '../growth/experience.js';
import { branchReady } from '../growth/build.js';

// Read-only priority; callers handle input, core creation, growth choices and screens.
export function resumeMode(r){
  if(!r)return null;
  if (r.finalStep === 3) return 'finalchoice';
  if (r.finalStep === 1) return 'finalintro';
  if (r.journey.keystonePending) return 'keystone';
  if (r.bossChoiceId && r.enemies.some(e => e.id === r.bossChoiceId && e.kind === 3 && e.phase === 3)) return 'bosschoice';
  if (r.npc.secretPending) return 'secret';
  if (r.npc.encounterPending) return 'encounter';
  if (r.sitePending && r.site) return 'site';
  if (r.echoPending && r.echoSite) return 'echo';
  if (r.legacyPending && r.legacySite) return 'legacy';
  if (r.relicPending) return 'relic';
  if (r.anomalyPending) return 'anomaly';
  if (branchReady(r)) return 'branch';
  if(r.pending)return 'levelup';
  return 'playing';
}

export function createSession({ sessionState, view, platform, statistics, screen, storage, enemyRuntime, story, finale, progression, seedSource = newSeed }) {
  const { keys } = platform;

  function record(line) { appendRecord(sessionState.profile, sessionState.run, line); }

  function newRun(journey, seed = seedSource?.()) {
    const rng = seed == null ? null : makeRandomState(seed);
    const run = createRun(sessionState.profile, { journey:journey ?? makeJourney(undefined,rng ? ()=>nextRandom(rng) : Math.random), maxHp:statistics.maxHpFor(null), xpNext:xpNeed(1) });
    if (rng) run.rng = rng;
    return run;
  }

  function resetAllRecords() {
    if (!canResetRecords(view)) return;
    if(!storage.clear())return;
    sessionState.resetState(); view.lastResult = null; view.resetIdle = true; keys.clear(); screen.setMode('menu'); screen.toast('기록 초기화 완료 · 이어하기, 골드, 강화, 기억, 엔딩 기록 삭제');
  }

  function finish() {
    const result=commitRunResult(sessionState);if(!result)return;view.lastResult=result; keys.clear(); screen.setMode('gameover'); storage.save();
  }

  function startFresh(confirmed = false) {
    if (sessionState.run && !confirmed) { view.newConfirmReturn = view.mode; screen.setMode('newconfirm'); return; }
    view.resetIdle = false; commitRunStart(sessionState,newRun()); record(sessionState.profile.runs === 1 ? '이곳에 처음 도착했다. 누군가 작은 기록을 남겨 두었다.' : sessionState.profile.memory.witness.quiet ? '다시 돌아왔다. 이번에도 누군가는 아무것도 하지 않은 시간을 기억한다.' : Object.values(sessionState.profile.memory.endings).some(Boolean) ? `다시 돌아왔다. 발견한 결말 ${Object.values(sessionState.profile.memory.endings).filter(Boolean).length}개는 아직 기록되어 있다.` : '다시 돌아왔다. 이 구역은 이전의 선택을 기억하고 있다.'); keys.clear(); screen.setMode('playing'); storage.save();
  }

  function resume() {
    if (!sessionState.run) return; keys.clear();
    if(sessionState.run.finalStep===2)enemyRuntime.spawnFinalCore();
    const mode=resumeMode(sessionState.run);if(mode==='levelup')progression.choices();screen.setMode(mode);
    if(mode!=='playing')return;
    if (!story.openSignal() && !story.openAnomaly()) finale.openFinale();
  }

  function pause() { if (canPauseGame(view)) { keys.clear(); screen.setMode('paused'); storage.save(); } else if (view.mode === 'paused') resume(); }

  return { record, newRun, resetAllRecords, finish, startFresh, resume, pause };
}
