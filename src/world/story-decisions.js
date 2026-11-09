import { signalReward, witnessReward, anomalyDuration } from '../data/world-choices.js';
import { signals, anomalies, legacies } from '../data/world.js';
import { GUARDIAN_SALVAGE } from '../core/config.js';
import { rewardGold } from '../growth/rewards.js';
import { dropXp, reserveXp } from '../growth/experience.js';
import { appendRecord } from '../core/profile.js';

export function createStoryDecisions({ sessionState, statistics, difficulty, combat }) {
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

  function chooseBoss(choice) {
    if (!['spare', 'end'].includes(choice)) return false;
    const e = sessionState.run?.enemies.find(enemy => enemy.id === sessionState.run.bossChoiceId && enemy.kind === 3 && enemy.phase === 3); if (!e) return false;
    sessionState.run.bossChoiceId = 0; sessionState.run.guardianFate[choice]++; sessionState.run.guardianOrder = choice;
    if (choice === 'spare') {
      sessionState.profile.memory.guardian.spared++; sessionState.run.gold += rewardGold(e);
      if (!dropXp(sessionState.run, e.x, e.y, difficulty.rewardXp(e))) reserveXp(sessionState.run,difficulty.rewardXp(e));
      e.hp = 0; record('감시자 · 내려놓은 무기 옆으로 지나갔다. 등 뒤에서 껍질이 닫혔다.');
    } else { sessionState.profile.memory.guardian.ended++; combat.killEnemy(e,0,GUARDIAN_SALVAGE); record('감시자 · 껍질 안쪽까지 분해했다. 끊어진 명령이 한 번 더 점멸했다.'); }
    sessionState.run.enemies = sessionState.run.enemies.filter(enemy => enemy.hp > 0); return { enemy:e, spared:choice==='spare' };
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

  function chooseLegacy(choice) {
    if (!sessionState.run?.legacyOrigin || sessionState.run.legacyChoice || !sessionState.run.legacySite || ![...legacies[sessionState.run.legacyOrigin].options.map(x=>x.id),'silent'].includes(choice)) return false;
    const origin = sessionState.run.legacyOrigin, def = legacies[origin], option = def.options.find(x=>x.id===choice);
    sessionState.run.legacyChoice = choice; sessionState.run.legacySite = null; sessionState.run.legacyPending = false; sessionState.profile.memory.legacies[origin][choice]++;
    sessionState.run.player.hp = Math.min(sessionState.run.player.hp, statistics.stats().maxHp);
    record(`지난 결말의 답장 · ${def.name} / ${option?.name || '응답하지 않음'}`);
    return true;
  }

  return { chooseWitness, acknowledgeSilence, chooseBoss, chooseSignal, chooseAnomaly, chooseLegacy };
}
