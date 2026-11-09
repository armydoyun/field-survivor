import { echoes, fronts } from '../data/world.js';
import { frontOption } from './effects.js';
import { appendRecord } from '../core/profile.js';

export function createEncounterDecisions({ sessionState, statistics }) {
  const record = line => appendRecord(sessionState.profile,sessionState.run,line);
  function finishEcho(choice) {
    if (!sessionState.run?.echoSite || !['keep','use','silent'].includes(choice)) return false;
    const id = sessionState.run.echoSite.id, e = echoes[sessionState.run.echoStep], origin = sessionState.run.echoSeed[id]; if (!e || id !== e.id || !origin || sessionState.run.echoOutcomes[id]) return false;
    sessionState.run.echoOutcomes[id] = choice; sessionState.profile.memory.echoes[id][choice]++; sessionState.run.echoSite = null; sessionState.run.echoPending = false; sessionState.run.echoStep++;
    if(choice!=='silent')sessionState.run.player.hp=Math.min(sessionState.run.player.hp,statistics.stats().maxHp);
    record(`기억의 잔향 · ${e.name} · ${choice === 'keep' ? '복원' : choice === 'use' ? '재사용' : '미응답'} · ${e.line[origin]}`);
    return true;
  }
  function resolveFront(choice) {
    const f = fronts[sessionState.run?.frontStep]; if (!f || !sessionState.run.front || (choice !== 'silent' && !frontOption(f,choice))) return false;
    const label = choice === 'silent' ? '미응답' : frontOption(f,choice).name;
    sessionState.run.frontChoices[f.id] = choice; sessionState.profile.memory.fronts[f.id][choice]++; sessionState.run.front = null; sessionState.run.frontStep++;
    record(`전선 교차 · ${f.title} · ${label}. ${choice === 'silent' ? '송신기가 더는 울리지 않는다.' : '한쪽 송신기가 꺼졌다.'}`);

    return true;
  }

  return { finishEcho, resolveFront };
}
