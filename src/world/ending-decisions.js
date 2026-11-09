import { commitRunResult } from '../core/run-lifecycle.js';
import { endingReward } from '../data/world-choices.js';
import { signals, anomalies, sites, objectives, echoes, fronts, legacies, relics, finalEndings } from '../data/world.js';
import { frontOption, episodeTitle } from './effects.js';
import { appendRecord } from '../core/profile.js';

export function createEndingDecisions({ sessionState, enemyRuntime }) {
  const record = line => appendRecord(sessionState.profile,sessionState.run,line);
  function endingScenes(id,r=sessionState.run){
    const success=slot=>r.journey.outcomes.some(x=>x.slot===slot&&x.success),tail=id==='preserve'?'문장 옆에 이름을 적을 자리가 남았다.':id==='consume'?'불빛은 그 자리를 지나 엔진으로 흘렀다.':'이제 그 길을 닫으라는 명령은 도착하지 않는다.';
    return [
      (r.npc.state==='taken'?(success(0)?'추적하던 잔해 속에서 기록원의 마지막 문장을 건졌다.':'기록원의 목소리는 잔해와 함께 멀어졌다.'):r.npc.state==='heard'?(success(0)?'중계가 이어지자 기록원은 네가 듣지 못한 이름 하나를 더 불렀다.':'끝까지 들었던 목소리가 두 번째 전송에서는 끊겼다.'):'길가의 기록원은 끝내 수신기를 내려놓지 않았다.')+' '+tail,
      (r.guardianOrder==='end'?(success(2)?'부서진 감시자의 명령을 회수했다. 빈 껍질들이 같은 방향으로 돌아섰다.':'분해된 감시자의 명령은 회수되지 못했다. 다른 껍질들이 그 자리를 메웠다.'):r.guardianOrder==='spare'?(success(2)?'돌아간 감시자가 중계를 끝마쳤다. 방패 안쪽에 사람이 지나갈 틈이 생겼다.':'돌아간 감시자는 마지막 좌표에 닿지 못했다. 방패만 벌판에 남았다.'):'감시자의 명령은 아무 이름도 덧붙이지 않은 채 반복된다.')+' '+tail,
      (r.siteDecisions.archive==='take'?'기록고의 재는 문밖까지 날아왔다.':r.siteDecisions.archive==='keep'?'닫힌 기록고에 새 손자국이 생겼다.':'열리지 않은 기록고는 벌판에 그대로 남았다.')+' '+(id==='consume'?'네 손에는 따뜻한 빈 기록함이 들려 있다.':id==='release'?'누가 먼저 열어 볼지는 아직 정해지지 않았다.':'너는 돌아올 사람이 읽을 수 있도록 좌표를 남겼다.')
    ];
  }
  function threadResolution(id,r=sessionState.run) {
    if(!r)return [];
    const lines=[], f=label=>id==='consume'?`${label}은 동력으로 전환되고 흔적만 남았다.`:id==='preserve'?`${label}이 기록으로 보존되어 다음 사람이 찾을 수 있다.`:`${label}을 누가 소유할지 더는 중심핵이 결정하지 않는다.`;
    if(r.signalChoices.length)for(let i=0;i<r.signalChoices.length;i++)lines.push(f(`${signals[i].title}을 ${r.signalChoices[i]==='hear'?'끝까지 들은':'연료로 바꾼'} 선택`));
    else if(r.signalStep)lines.push(f(r.signalHp>r.signalPower*20?'끝까지 들은 목소리':r.signalPower*20>r.signalHp?'연료가 된 목소리':'들은 신호와 태운 신호'));
    if(r.npc.state==='heard')lines.push(f('기록원이 직접 전한 이야기'));else if(r.npc.state==='taken')lines.push(f('기록원에게서 추출한 파형'));
    if(sessionState.profile.memory.witness.quiet)lines.push('멈춰 있던 4.5초의 기록은 시스템도 더는 지울 수 없는 증거가 되었다.');
    if(r.guardianFate.spare||r.guardianFate.end)lines.push(f(r.guardianFate.spare&&r.guardianFate.end?'놓아준 감시자와 분해한 감시자의 증언':r.guardianFate.spare?'살려 보낸 감시자의 응답':'분해된 감시자의 마지막 명령'));
    else if(sessionState.profile.memory.guardian.spared||sessionState.profile.memory.guardian.ended)lines.push('이전 도전에서 선택했던 감시자의 운명이 중심핵의 공격 패턴을 바꾸었다.');
    for(const event of anomalies)if(r.anomalyChoices[event.id])lines.push(f(`${event.title}에서 내린 '${event.options.find(o=>o.id===r.anomalyChoices[event.id]).name}' 선택`));
    for(const site of sites)if(r.siteDecisions[site.id])lines.push(f(`${site.title}에서 ${r.siteDecisions[site.id]==='keep'?'남긴':'가져간'} 기록`));
    for(const task of objectives)if(r.objectiveOutcomes[task.id])lines.push(f(r.objectiveOutcomes[task.id]==='complete'?`${task.name}에서 회수한 기록`:r.objectiveOutcomes[task.id]==='ignored'?`${task.name}에 응답하지 않은 침묵`:`${task.name}의 소실 신호와 실패한 작전 기록`));
    for (const e of echoes) if (r.echoOutcomes[e.id]) lines.push(r.echoOutcomes[e.id] === 'silent' ? f(`${e.name}에 응답하지 않아 남은 기록`) : f(`${e.name}에서 ${r.echoSeed[e.id] === 'none' ? '이름 없는 기록을' : r.echoSeed[e.id] === 'heard' || r.echoSeed[e.id] === 'spared' || r.echoSeed[e.id] === 'kept' || r.echoSeed[e.id] === 'rescued' ? '보호를' : '상실을'} ${r.echoOutcomes[e.id] === 'keep' ? '되돌려 놓은' : '다시 연료로 바꾼'} 선택`));
    for(const front of fronts) if(r.frontChoices?.[front.id]) lines.push(r.frontChoices[front.id]==='silent'?f(`${front.title}에서 닫혀 버린 두 경로`):f(`${front.title}에서 '${frontOption(front,r.frontChoices[front.id]).name}'로 향한 선택`));
    if (r.legacyOrigin) {
      const old = legacies[r.legacyOrigin], selected = old.options.find(x=>x.id===r.legacyChoice);
      lines.push(r.legacyChoice === 'silent' ? `지난 결말 '${old.name}'에 응답하지 않았다. 중심핵은 그 침묵까지 하나의 선택으로 기록했다.` : selected ? `지난 결말 '${old.name}'에 돌아와 '${selected.name}'을 선택했다. 그 대가와 변화가 이번 생존에도 남았다.` : `지난 결말 '${old.name}'의 답장은 아직 열리지 않은 채 다음 길을 기다린다.`);
    }
    for(const relic of relics)if(r.relics.includes(relic.id))lines.push(f(`'${relic.name}'에 남아 있던 제작자의 흔적`));
    for (const site of sites) if (r.time >= site.at && !r.siteDecisions[site.id]) lines.push(`${site.title}의 표식은 끝내 선택받지 못했다. 다음 도전에서도 좌표의 흔적은 사라지지 않는다.`);
    for (const x of r.journey.outcomes) lines.push(`${episodeTitle(x.kind)} · ${x.success?'회수 완료':'연결 소실'}`);
    return lines;
  }
  const canRelease = () => !!sessionState.run && sessionState.run.journey.outcomes.filter(x=>x.success).length >= 2 && sessionState.run.journey.outcomes.some(x=>x.slot===2 && x.success) && Object.values(sessionState.run.echoOutcomes).some(x=>x==='keep'||x==='use');
  function beginFinale() {
    if (!sessionState.run || sessionState.run.finalStep !== 1) return false;
    sessionState.run.finalStep = 2; sessionState.run.bossChoiceId = 0;
    sessionState.run.enemies.length = 0; sessionState.run.bullets.length = 0; sessionState.run.shots.length = 0; sessionState.run.hazards.length = 0;
    sessionState.run.nextBoss = sessionState.run.time + 3600;
    enemyRuntime.spawnFinalCore(); record('최종 신호 · 이곳이 모든 반복의 중심이다. 중심핵이 너의 기록을 읽고 있다.');
    return true;
  }
  function chooseFinale(id) {
    if (!sessionState.run || sessionState.run.finalStep !== 3 || !['preserve', 'consume', 'release'].includes(id) || (id === 'release' && !canRelease())) return null;
    const ending = finalEndings.find(x => x.id === id), result = { time: sessionState.run.time, kills: sessionState.run.kills, gold: sessionState.run.gold + endingReward, level: sessionState.run.level, ending: ending.name, endingId: id, threads: threadResolution(id), scenes: endingScenes(id) };
    const memory = sessionState.profile.memory;
    record(`최종 회수 · ${ending.name} · ${result.threads.length}개의 선택과 흔적이 결말에 연결되었다.`);
    memory.endings[id]++; if (finalEndings.every(e=>memory.endings[e.id]>0)) record('세 가지 결말이 모였다. 기록 장치가 작동한 이유는 제목 화면의 결말 기록에서 확인할 수 있다.'); memory.lastResolution = { ending: id, threads: result.threads.slice(0, 40), scenes: result.scenes }; 
    return commitRunResult(sessionState,result);
  }

  return { canRelease, beginFinale, chooseFinale };
}
