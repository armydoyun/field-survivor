import { canInteractInWorld } from '../core/view-policy.js';
import { signals, anomalies, guardianLines, startEffects } from '../data/world.js';
import { W, H, GUARDIAN_REACH, GUARDIAN_STILL } from '../core/config.js';

export function createStory({ sessionState, view, platform, screen, storage, session, decisions, feedback }) {
  const { keys } = platform;

  function recordGuardianArrival(guardian){
    const memory=sessionState.profile.memory.guardian;
    if(!guardian?.named){session.record(guardianLines.hollow);return;}
    if(memory.ended>memory.spared){session.record(guardianLines.ended);return;}
    const arrival=guardianLines.arrival.filter(x=>memory.spared>=x.from).at(-1);session.record(arrival.line);
    // 이름을 되찾은 이안은 그 판 첫 만남에서 신호 02의 주인이 자신이라고 말한다.
    if(arrival.from>=6&&(sessionState.run?.guardianMeet||0)<=1)session.record(guardianLines.signal);
  }

  // 무기를 내린 감시자: 가까이에서 멈춰 서면 돌려보내고(GUARDIAN_STILL초), 시간이 지나면 물러난다.
  function tickGuardian(dt,moving){
    const e=decisions.yieldingGuardian();if(!e)return false;
    if(!e.yieldNoted){e.yieldNoted=true;session.record(e.trialYield?guardianLines.trialLine:guardianLines.yieldLine);feedback.sound?.('guardianYield');storage.save();}
    const p=sessionState.run.player,near=Math.hypot(p.x-e.x,p.y-e.y)<=GUARDIAN_REACH;
    e.yieldStill=near&&!moving?(e.yieldStill||0)+dt:0;
    if(e.yieldStill>=GUARDIAN_STILL){const result=decisions.chooseBoss('spare');if(result){feedback.burst(result.enemy.x,result.enemy.y,'#a8cbbd',24);feedback.sound?.('guardianSpare');}storage.save();return true;}
    if(sessionState.run.time>=e.yieldUntil){decisions.guardianLeaves();storage.save();return true;}
    return false;
  }

  // E: 가까이 있는 무기를 내린 감시자를 분해한다.
  function dismantleGuardian(){
    if(!canInteractInWorld(view))return false;const e=decisions.yieldingGuardian(),p=sessionState.run?.player;
    if(!e||Math.hypot(p.x-e.x,p.y-e.y)>GUARDIAN_REACH)return false;
    decisions.chooseBoss('end');feedback.sound?.('guardianEnd');storage.save();return true;
  }

  function tickWitness(dt,moving){
    const p=sessionState.run.player;
    const npc = sessionState.run.npc;
    if (npc.state === 'heard' && !npc.silenced) {
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
    // 직전 결말의 여파: 두 개의 목소리 → 기록원이 일찍 온다, 빈 껍질 → 이번 판에는 오지 않는다.
    if (npc.spawned || sessionState.run.legacyVariant === 'hollow' || sessionState.run.time < (sessionState.run.legacyOrigin === 'divided' ? startEffects.dividedWitnessAt : startEffects.witnessAt)) return;
    npc.spawned = true; npc.state = 'waiting'; npc.x = p.x + (p.x < W / 2 ? 142 : -142); npc.y = p.y + (p.y < H / 2 ? 78 : -78);
    session.record('알 수 없는 점 하나가 전장에 나타났다. 적들과는 다른 신호다.');
  }

  function meetWitness() {
    if (!canInteractInWorld(view) || !sessionState.run?.npc?.spawned || sessionState.run.npc.state !== 'waiting' || Math.hypot(sessionState.run.player.x - sessionState.run.npc.x, sessionState.run.player.y - sessionState.run.npc.y) >= 75) return;
    sessionState.run.npc.encounterPending = true; keys.clear(); screen.setMode('encounter'); storage.save();
  }

  function chooseWitness(choice){if(view.mode!=='encounter'||!decisions.chooseWitness(choice))return;screen.setMode('playing');storage.save();}

  function revealSilence() {
    if (!canInteractInWorld(view) || sessionState.run.npc.state !== 'heard' || sessionState.run.npc.silenced) return;
    sessionState.run.npc.secretPending = true; keys.clear(); screen.setMode('secret'); storage.save();
  }

  function acknowledgeSilence(){if(view.mode!=='secret'||!decisions.acknowledgeSilence())return;screen.setMode('playing');storage.save();}

  function chooseSignal(choice){if(view.mode!=='signal'||!decisions.chooseSignal(choice))return;screen.setMode('playing');storage.save();}

  function openAnomaly() {
    if (!sessionState.run || sessionState.run.anomalyStep >= anomalies.length || sessionState.run.time < anomalies[sessionState.run.anomalyStep].at) return false;
    sessionState.run.anomalyPending = true; keys.clear(); screen.setMode('anomaly'); storage.save(); return true;
  }

  function chooseAnomaly(choice){if(view.mode!=='anomaly'||!decisions.chooseAnomaly(choice))return;screen.setMode('playing');storage.save();}

  return { recordGuardianArrival, tickGuardian, dismantleGuardian, tickWitness, openSignal, spawnWitness, meetWitness, chooseWitness, revealSilence, acknowledgeSilence, chooseSignal, openAnomaly, chooseAnomaly };
}
