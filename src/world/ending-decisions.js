import { commitRunResult } from '../core/run-lifecycle.js';
import { endingReward } from '../data/world-choices.js';
import { signals, anomalies, sites, objectives, echoes, fronts, legacies, relics, finalEndings, endingTexts, endingScenes } from '../data/world.js';
import { frontOption, episodeTitle } from './effects.js';
import { appendRecord } from '../core/profile.js';
import { routeAxes, routeEnding, releaseOpen, endingVariant } from './route.js';

// 결말은 경로가 정한다(NARRATIVE-REDESIGN.md 4절). 마지막 화면은 경로의 결말을 확정하거나,
// 해방 조건을 채운 판에서 멈춰 있어 열린 문으로 넘어가는 것만 허용한다.
export function createEndingDecisions({ sessionState, enemyRuntime }) {
  const record = line => appendRecord(sessionState.profile,sessionState.run,line);

  function route(r=sessionState.run){
    if(!r)return null;
    return { ending: routeEnding(r), release: releaseOpen(r), axes: routeAxes(r) };
  }

  function witnessScene(id,variant,r){
    const w=endingScenes.witness;
    if(variant==='hollow')return w.hollow;
    if(id==='release')return w.release;
    if(r.npc.state==='heard')return w.heard[id];
    return r.npc.state==='taken'?w.taken:w.none;
  }
  function guardianScene(id,variant,a){
    const g=endingScenes.guardian;
    if(id==='release')return g.release;
    if(a.spared&&a.ended)return g.mixed;
    if(a.ended)return variant==='hollow'?g.hollow:g.ended;
    return a.spared?g.spared:g.none;
  }
  function exitScene(id,r,a){
    const e=endingScenes.exit,decision=r.siteDecisions.coordinate;
    const base=id==='release'&&decision==='keep'?e.release:decision==='keep'?e.keep:decision==='take'?e.take:e.none;
    return a.silence?`${base} ${e.silence.replace('{count}',a.silence)}`:base;
  }
  // 도입 문단은 결말 화면 본문이 맡고, 여기서는 기록원 · 감시자 · 출구 장면을 만든다. 꼬리말은 마지막 장면에 붙는다.
  function endingSceneList(id,r=sessionState.run){
    const a=routeAxes(r),variant=endingVariant(id,r);
    return [witnessScene(id,variant,r),guardianScene(id,variant,a),`${exitScene(id,r,a)} ${endingTexts[id].tail}`];
  }

  // 결말 화면의 '세부 기록'. 결말별 꼬리말을 반복해 붙이지 않고 있었던 일만 적는다.
  function threadResolution(r=sessionState.run) {
    if(!r)return [];
    const lines=[];
    for(let i=0;i<r.signalChoices.length;i++)lines.push(`${signals[i].title} · ${r.signalChoices[i]==='hear'?'끝까지 들었다':'연료로 바꿨다'}`);
    if(r.npc.state==='heard')lines.push(`기록원 · 이야기를 들었다${r.npc.silenced?' · 옆에서 4.5초 동안 멈춰 있었다':''}`);
    else if(r.npc.state==='taken')lines.push('기록원 · 기록을 추출했다');
    if(r.guardianFate.spare||r.guardianFate.end)lines.push(`감시자 · 돌려보냄 ${r.guardianFate.spare}회 / 분해 ${r.guardianFate.end}회`);
    for(const site of sites)if(r.siteDecisions[site.id])lines.push(`${site.title} · ${site.options.find(o=>o.id===r.siteDecisions[site.id]).name}`);
    else if(r.time>=site.at)lines.push(`${site.title} · 응답하지 않고 지나쳤다`);
    for(const relic of relics)if(r.relics.includes(relic.id))lines.push(`유물 · '${relic.name}'에 기록원이 남겨 둔 흔적`);
    for(const event of anomalies)if(r.anomalyChoices[event.id])lines.push(`${event.title} · ${event.options.find(o=>o.id===r.anomalyChoices[event.id]).name}`);
    for(const task of objectives)if(r.objectiveOutcomes[task.id])lines.push(`${task.name} · ${r.objectiveOutcomes[task.id]==='complete'?'완수':r.objectiveOutcomes[task.id]==='ignored'?'미응답':'실패'}`);
    for(const e of echoes)if(r.echoOutcomes[e.id])lines.push(`${e.name} · ${r.echoOutcomes[e.id]==='keep'?'복원':r.echoOutcomes[e.id]==='use'?'재사용':'미응답'}`);
    for(const front of fronts)if(r.frontChoices?.[front.id])lines.push(`${front.title} · ${r.frontChoices[front.id]==='silent'?'미응답':frontOption(front,r.frontChoices[front.id]).name}`);
    if(r.legacyOrigin){const old=legacies[r.legacyOrigin],selected=old.options.find(x=>x.id===r.legacyChoice);lines.push(`지난 결말 '${old.name}' · ${r.legacyChoice==='silent'?'응답하지 않음':selected?selected.name:'열리지 않음'}`);}
    for(const x of r.journey.outcomes)lines.push(`${episodeTitle(x.kind)} · ${x.success?'회수 완료':'연결 소실'}`);
    return lines;
  }

  function beginFinale() {
    if (!sessionState.run || sessionState.run.finalStep !== 1) return false;
    sessionState.run.finalStep = 2; sessionState.run.bossChoiceId = 0;
    sessionState.run.enemies.length = 0; sessionState.run.bullets.length = 0; sessionState.run.shots.length = 0; sessionState.run.hazards.length = 0;
    sessionState.run.nextBoss = sessionState.run.time + 3600;
    enemyRuntime.spawnFinalCore(); record('최종 신호 · 이곳이 모든 반복의 중심이다. 중심핵이 너의 기록을 읽고 있다.');
    return true;
  }

  // id는 경로가 정한 결말이거나, 해방 조건을 채운 판의 'release'만 받는다.
  function chooseFinale(id) {
    const r=sessionState.run, current=route(r);
    if (!r || r.finalStep !== 3 || !(id === current.ending || (id === 'release' && current.release))) return null;
    const ending = finalEndings.find(x => x.id === id), variant = endingVariant(id, r);
    const result = { time: r.time, kills: r.kills, gold: r.gold + endingReward, level: r.level, ending: ending.name, endingId: id, variant, threads: threadResolution(r), scenes: endingSceneList(id, r) };
    const memory = sessionState.profile.memory;
    record(`최종 회수 · ${ending.name}${variant==='hollow'?' · 빈 껍질':''}`);
    memory.endings[id]++; if (finalEndings.every(e=>memory.endings[e.id]>0)) record('모든 결말이 모였다. 기록 장치가 작동한 이유는 제목 화면의 결말 기록에서 확인할 수 있다.');
    memory.lastResolution = { ending: id, threads: result.threads.slice(0, 40), scenes: result.scenes };
    return commitRunResult(sessionState,result);
  }

  return { route, beginFinale, chooseFinale };
}
