import { canPauseGame, canResetRecords } from './view-policy.js';
import { commitRunStart, commitRunResult } from './run-lifecycle.js';
import { makeRandomState, nextRandom, newSeed } from './random.js';
import { appendRecord } from './profile.js';
import { startScenes, deathLines } from '../data/world.js';
import { phases } from '../data/progression.js';
import { unlockedLoadouts, startWeaponLevel } from '../data/loadouts.js';
import { makeJourney, createRun } from './run.js';
import { xpNeed } from '../growth/experience.js';
import { beginLastRecord } from '../world/last-record.js';
import { branchReady } from '../growth/build.js';

// Read-only priority; callers handle input, core creation, growth choices and screens.
export function resumeMode(r){
  if(!r)return null;
  if (r.finalStep === 3) return 'finalchoice';
  if (r.finalStep === 1) return 'finalintro';
  if (r.journey.keystonePending) return 'keystone';
  if (r.npc.secretPending) return 'secret';
  if (r.npc.encounterPending) return 'encounter';
  if (r.sitePending && r.site) return 'site';
  if (r.relicPending) return 'relic';
  if (r.anomalyPending) return 'anomaly';
  if (branchReady(r)) return 'branch';
  if(r.pending)return 'levelup';
  return 'playing';
}

export function createSession({ sessionState, view, platform, statistics, screen, storage, enemyRuntime, story, finale, progression, seedSource = newSeed }) {
  const { keys } = platform;

  function record(line) { appendRecord(sessionState.profile, sessionState.run, line); }

  function newRun(journey, seed = seedSource?.(), startWeapon = 'pulse') {
    const rng = seed == null ? null : makeRandomState(seed);
    const run = createRun(sessionState.profile, { journey:journey ?? makeJourney(undefined,rng ? ()=>nextRandom(rng) : Math.random), maxHp:statistics.maxHpFor(null), xpNext:xpNeed(1) });
    if (rng) run.rng = rng;
    // 펄스 시작은 이전과 같은 판 상태를 만든다(필드 없음). 다른 무기로 시작할 때만 기록한다.
    if (startWeapon !== 'pulse') { run.startWeapon = startWeapon; run.up[startWeapon] = startWeaponLevel(startWeapon); }
    return run;
  }

  function resetAllRecords() {
    if (!canResetRecords(view)) return;
    if(!storage.clear())return;
    sessionState.resetState(); view.lastResult = null; view.resetIdle = true; keys.clear(); screen.setMode('menu'); screen.toast('기록 초기화 완료 · 이어하기, 골드, 강화, 기억, 엔딩 기록 삭제');
  }

  function finish() {
    const r=sessionState.run;if(r){const memory=sessionState.profile.memory;memory.deaths++;memory.lastDeathPhase=phases.filter(x=>r.time>=x.at).at(-1).name;record(deathLines.gameover);}
    const result=commitRunResult(sessionState);if(!result)return;view.lastResult=result; keys.clear(); screen.setMode('gameover'); storage.save();
  }

  // 시작 무기가 둘 이상 열려 있으면 먼저 고른다(weapon이 없을 때). 펄스만 열렸으면 바로 시작한다.
  function startFresh(confirmed = false, weapon = null) {
    if (sessionState.run && !confirmed) { view.newConfirmReturn = view.mode; screen.setMode('newconfirm'); return; }
    const open = unlockedLoadouts(sessionState.profile.memory);
    if (!weapon && open.length > 1) { view.loadoutConfirmed = true; screen.setMode('loadout'); return; }
    if (weapon && !open.includes(weapon)) return;
    view.resetIdle = false; commitRunStart(sessionState,newRun(undefined, undefined, weapon || 'pulse')); const aftermath=sessionState.run.legacyOrigin?startScenes[sessionState.run.legacyVariant||sessionState.run.legacyOrigin]:null; if(aftermath)record(`지난 결말의 여파 · ${aftermath.line}`); beginLastRecord(sessionState.profile,sessionState.run); record(sessionState.profile.runs === 1 ? '이곳에 처음 도착했다. 누군가 작은 기록을 남겨 두었다.' : sessionState.profile.memory.witness.quiet ? '다시 돌아왔다. 이번에도 누군가는 아무것도 하지 않은 시간을 기억한다.' : Object.values(sessionState.profile.memory.endings).some(Boolean) ? `다시 돌아왔다. 발견한 결말 ${Object.values(sessionState.profile.memory.endings).filter(Boolean).length}개는 아직 기록되어 있다.` : '다시 돌아왔다. 이 구역은 이전의 선택을 기억하고 있다.'); keys.clear(); screen.setMode('playing'); storage.save();
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
