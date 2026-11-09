import { signalReward, witnessReward, anomalyDuration } from '../data/world-choices.js';
import { signals, anomalies, guardianLines } from '../data/world.js';
import { GUARDIAN_SALVAGE } from '../core/config.js';
import { appendRecord } from '../core/profile.js';

export function createStoryDecisions({ sessionState, statistics, combat }) {
  const record = line => appendRecord(sessionState.profile,sessionState.run,line);
  function chooseWitness(choice) {
    if (!sessionState.run?.npc?.encounterPending || !['hear', 'take'].includes(choice)) return false;
    const npc = sessionState.run.npc, witness = sessionState.profile.memory.witness;
    npc.encounterPending = false; witness.met++;
    if (choice === 'hear') {
      npc.state = 'heard'; witness.heard++; sessionState.run.player.hp = Math.min(statistics.stats().maxHp, sessionState.run.player.hp + witnessReward.heal);
      record('기록원 · 그는 문장 사이를 오래 비워 두었다. 마지막 말은 잡음에 묻혔다.');
    } else {
      npc.state = 'taken'; witness.taken++; sessionState.run.gold += witnessReward.gold;
      record(`기록원 · 목소리 대신 연료 ${witnessReward.gold}G를 가져갔다. 장소에는 빈 원만 남았다.`);
    }
    return true;
  }

  function acknowledgeSilence() {
    if (!sessionState.run?.npc?.secretPending) return false;
    sessionState.run.npc.secretPending = false; sessionState.run.npc.silenced = true; const witness = sessionState.profile.memory.witness;
    if (witness.quiet) record('숨겨진 기록 · 이번에도 멈춰 있던 시간이 저장되었다.');
    else {
      witness.quiet = true; sessionState.run.player.hp = Math.min(statistics.stats().maxHp, sessionState.run.player.hp + witnessReward.silenceHeal);
      record('숨겨진 기록 · 아무것도 하지 않은 시간이 처음으로 저장되었다. 영구 최대 HP +10.');
    }
    return true;
  }

  // 무기를 내린 감시자(이름 있는 감시자, phase 3)에 대한 결정. 돌려보내면 보상 없이 증표(guardianFate.spare)만 남는다.
  function yieldingGuardian(){
    return sessionState.run?.enemies.find(enemy => enemy.id === sessionState.run.bossChoiceId && enemy.kind === 3 && enemy.phase === 3 && enemy.named && !enemy.final) || null;
  }
  function chooseBoss(choice) {
    if (!['spare', 'end'].includes(choice)) return false;
    const e = yieldingGuardian(); if (!e) return false;
    sessionState.run.bossChoiceId = 0; sessionState.run.guardianFate[choice]++; sessionState.run.guardianOrder = choice;
    if (choice === 'spare') { sessionState.profile.memory.guardian.spared++; e.hp = 0; record(guardianLines.spare); }
    else { sessionState.profile.memory.guardian.ended++; combat.killEnemy(e,0,GUARDIAN_SALVAGE); record(guardianLines.end); }
    sessionState.run.enemies = sessionState.run.enemies.filter(enemy => enemy.hp > 0); return { enemy:e, spared:choice==='spare' };
  }
  // 기다리는 시간 안에 아무것도 고르지 않으면 감시자는 물러난다. 축에는 남지 않는다.
  function guardianLeaves() {
    const e = yieldingGuardian(); if (!e) return false;
    sessionState.run.bossChoiceId = 0; e.hp = 0; sessionState.run.enemies = sessionState.run.enemies.filter(enemy => enemy.hp > 0); record(guardianLines.leave); return true;
  }

  function chooseSignal(choice) {
    if (!sessionState.run || !['hear', 'burn'].includes(choice) || sessionState.run.signalStep >= signals.length) return false;
    const event = signals[sessionState.run.signalStep]; sessionState.run.signalChoices.push(choice); sessionState.run.signalStep++;
    if (choice === 'hear') { sessionState.run.signalHp += signalReward.hp; sessionState.run.player.hp = Math.min(statistics.stats().maxHp, sessionState.run.player.hp + signalReward.hp); sessionState.profile.memory.heard++; record(`${event.title} · 목소리를 기억했다.`); }
    else { sessionState.run.signalPower++; sessionState.run.gold += signalReward.goldBase + signalReward.goldStep * sessionState.run.signalStep; sessionState.profile.memory.burned++; record(`${event.title} · 신호를 연료로 바꿨다.`); }
    return true;
  }

  function chooseAnomaly(choice) {
    if (!sessionState.run?.anomalyPending) return false;
    const event = anomalies[sessionState.run.anomalyStep]; if (!event?.options.some(x => x.id === choice)) return false;
    sessionState.run.anomalyChoices[event.id] = choice; sessionState.run.anomalyPending = false; sessionState.run.anomalyStep++;
    if (event.id !== 'echo') sessionState.run.anomalyUntil[event.id] = sessionState.run.time + anomalyDuration[event.id];
    if (event.id === 'border' && choice === 'ward') sessionState.run.anomalyWardAt = sessionState.run.time;
    sessionState.profile.memory.anomalies[event.id][choice]++;
    if (event.id === 'echo') sessionState.run.player.hp = Math.min(sessionState.run.player.hp, statistics.stats().maxHp);
    record(`이상 현상 · ${event.title} · ${event.options.find(x => x.id === choice).name}`);
    return true;
  }

  return { chooseWitness, acknowledgeSilence, yieldingGuardian, chooseBoss, guardianLeaves, chooseSignal, chooseAnomaly };
}
