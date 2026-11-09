import { canInteractInWorld } from '../core/view-policy.js';
import { signals, anomalies, legacies } from '../data/world.js';
import { W, H } from '../core/config.js';

export function createStory({ sessionState, view, platform, screen, storage, session, decisions, feedback, growthActions }) {
  const { keys } = platform;

  function recordGuardianArrival(){session.record(sessionState.profile.memory.guardian.spared ? '감시자가 다시 나타났다. 한 번 돌아갔던 존재는 너를 기억하고 있다.' : sessionState.profile.memory.guardian.ended ? '감시자가 다시 나타났다. 이전에 부순 껍질의 흔적이 남아 있다.' : '감시자가 나타났다. 커다란 원 안에서 또 하나의 소리가 난다.');}

  function tickWitness(dt,moving){
    const p=sessionState.run.player;
    const npc = sessionState.run.npc;
    if (npc.state === 'heard' && !sessionState.profile.memory.witness.quiet) {
      if (!moving && Math.hypot(p.x - npc.x, p.y - npc.y) < 72) npc.still += dt;
      else npc.still = 0;
      if (npc.still >= 4.5) { revealSilence(); return true; }
    }
    return false;
  }

  function openSignal() {
    if (!sessionState.run || sessionState.run.signalStep >= signals.length || sessionState.run.time < signals[sessionState.run.signalStep].at) return false;
    keys.clear(); screen.setMode('signal'); storage.save(); return true;
  }

  function spawnWitness() {
    const p = sessionState.run.player, npc = sessionState.run.npc;
    if (npc.spawned || sessionState.run.time < 65) return;
    npc.spawned = true; npc.state = 'waiting'; npc.x = p.x + (p.x < W / 2 ? 142 : -142); npc.y = p.y + (p.y < H / 2 ? 78 : -78);
    session.record('알 수 없는 점 하나가 전장에 나타났다. 적들과는 다른 신호다.');
  }

  function meetWitness() {
    if (!canInteractInWorld(view) || !sessionState.run?.npc?.spawned || sessionState.run.npc.state !== 'waiting' || Math.hypot(sessionState.run.player.x - sessionState.run.npc.x, sessionState.run.player.y - sessionState.run.npc.y) >= 75) return;
    sessionState.run.npc.encounterPending = true; keys.clear(); screen.setMode('encounter'); storage.save();
  }

  function chooseWitness(choice){if(view.mode!=='encounter'||!decisions.chooseWitness(choice))return;screen.setMode('playing');storage.save();}

  function revealSilence() {
    if (!canInteractInWorld(view) || sessionState.run.npc.state !== 'heard' || sessionState.profile.memory.witness.quiet) return;
    sessionState.run.npc.secretPending = true; keys.clear(); screen.setMode('secret'); storage.save();
  }

  function acknowledgeSilence(){if(view.mode!=='secret'||!decisions.acknowledgeSilence())return;screen.setMode('playing');storage.save();}

  function chooseBoss(choice){
    if(view.mode!=='bosschoice')return;const result=decisions.chooseBoss(choice);if(!result)return;
    if(result.spared)feedback.burst(result.enemy.x,result.enemy.y,'#a8cbbd',24);
    screen.setMode('playing');storage.save();
  }

  function chooseSignal(choice){if(view.mode!=='signal'||!decisions.chooseSignal(choice))return;screen.setMode('playing');storage.save();}

  function openAnomaly() {
    if (!sessionState.run || sessionState.run.anomalyStep >= anomalies.length || sessionState.run.time < anomalies[sessionState.run.anomalyStep].at) return false;
    sessionState.run.anomalyPending = true; keys.clear(); screen.setMode('anomaly'); storage.save(); return true;
  }

  function chooseAnomaly(choice){if(view.mode!=='anomaly'||!decisions.chooseAnomaly(choice))return;screen.setMode('playing');storage.save();}

  function spawnLegacy() {
    if (!sessionState.run?.legacyOrigin || sessionState.run.legacyChoice || sessionState.run.finalStep || sessionState.run.time < 180) return;
    if (sessionState.run.time >= 540) { if (sessionState.run.legacySite) chooseLegacy('silent'); return; }
    if (!sessionState.run.legacySite) { const p = sessionState.run.player; sessionState.run.legacySite = { x: p.x+205, y: p.y-95 }; session.record(`지난 결말의 답장 · ${legacies[sessionState.run.legacyOrigin].name}이 나타났다.`); }
  }

  function meetLegacy() {
    if (!canInteractInWorld(view) || !sessionState.run?.legacySite || (sessionState.run.player.x-sessionState.run.legacySite.x)**2+(sessionState.run.player.y-sessionState.run.legacySite.y)**2 > 72**2) return false;
    sessionState.run.legacyPending = true; keys.clear(); screen.setMode('legacy'); storage.save(); return true;
  }

  function chooseLegacy(choice){
    if((choice!=='silent'&&view.mode!=='legacy')||!decisions.chooseLegacy(choice))return false;
    if(view.mode==='legacy'){if(sessionState.run.pending)growthActions.openUpgrade();else screen.setMode('playing');}storage.save();return true;
  }

  return { recordGuardianArrival, tickWitness, openSignal, spawnWitness, meetWitness, chooseWitness, revealSilence, acknowledgeSilence, chooseBoss, chooseSignal, openAnomaly, chooseAnomaly, spawnLegacy, meetLegacy, chooseLegacy };
}
