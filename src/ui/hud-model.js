import { weaponLabel } from './weapon-label.js';
import { fusionButtonEnabled } from '../core/view-policy.js';
import { paceAt } from '../core/difficulty.js';
import { chainReach, beaconRange, beaconInterval, lanceRadius, orbitPush, riftInterval, beaconShotInterval } from '../combat/weapon-parameters.js';
import { episodeTitle } from '../world/effects.js';
import { number as uiNumber, escapeHtml as htmlEscape } from './html.js';
import { timeText } from '../core/utils.js';
import { anomalyActive, frontOption, hasRelic, frontEffect, legacyEffect } from '../world/effects.js';
import { echoes, fronts, relics, anomalies, objectives, sites, legacies, finalEndings } from '../data/world.js';
import { xpNeed, xpCollectionScale } from '../growth/experience.js';
import { fusionReady, weaponConsumed, fusionConsumed, activeFusions, specialized } from '../growth/build.js';
import { recoveryScale } from '../combat/recovery.js';
import { armorScale, incomingScale } from '../combat/rules.js';
import { upgrades } from '../data/upgrades.js';
import { fusionRecipes } from '../data/fusions.js';
import { branches } from '../data/specializations.js';
import { burstChance } from '../combat/death.js';
import { keystones } from '../data/progression.js';

export function createHudModel({ sessionState, view, statistics, growthMetrics }) {
  function readHud(previousKeys={}) {
    const text={},html={},width={},hidden={},keys={};
    const s = statistics.stats(), p = sessionState.run?.player, gold = sessionState.run?.gold || 0, pace = paceAt(sessionState.run?.time || 0);
    text['hudLevel'] = String(sessionState.run?.level || 1).padStart(2, '0'); text['hudTime'] = timeText(sessionState.run?.time || 0);
    const liveAnomalies = [];
    if (anomalyActive('clock', 'hold',sessionState.run)) liveAnomalies.push(`정지된 초침 ${Math.ceil(sessionState.run.anomalyUntil.clock - sessionState.run.time)}s`);
    if (anomalyActive('clock', 'rush',sessionState.run)) liveAnomalies.push(`가속 ${Math.ceil(sessionState.run.anomalyUntil.clock - sessionState.run.time)}s`);
    if (anomalyActive('border', 'ward',sessionState.run)) liveAnomalies.push(`방벽 ${Math.ceil(sessionState.run.anomalyUntil.border - sessionState.run.time)}s`);
    if (anomalyActive('border', 'harvest',sessionState.run)) liveAnomalies.push(`수확 ${Math.ceil(sessionState.run.anomalyUntil.border - sessionState.run.time)}s`);
    if (sessionState.run) for (const e of echoes) if (['keep','use'].includes(sessionState.run.echoOutcomes[e.id])) liveAnomalies.push(`${e.name} ${sessionState.run.echoOutcomes[e.id] === 'keep' ? '복원' : '재사용'}`);
    if (sessionState.run) for (const f of fronts) if (sessionState.run.frontChoices[f.id] && sessionState.run.frontChoices[f.id] !== 'silent') liveAnomalies.push(`${f.title} ${frontOption(f,sessionState.run.frontChoices[f.id]).name}`);
    if (sessionState.run?.front) liveAnomalies.push(`${fronts[sessionState.run.frontStep].title} · 선택 ${Math.max(0,Math.ceil(fronts[sessionState.run.frontStep].at+180-sessionState.run.time))}s`);
    if (sessionState.run?.anomalyChoices?.echo) liveAnomalies.push(sessionState.run.anomalyChoices.echo === 'keep' ? '기록 보존' : '기록 소각');
    if (sessionState.run && sessionState.run.time < sessionState.run.invulnUntil) liveAnomalies.push(`무적 ${Math.ceil(sessionState.run.invulnUntil - sessionState.run.time)}s`);
    text['sectorLabel'] = `PHASE ${String(pace.index + 1).padStart(2, '0')} · ${pace.name}${pace.surge ? ' / WAVE' : ''}${liveAnomalies.length ? ' · ' + liveAnomalies.join(' / ') : ''}`;
    text['hudKills'] = (sessionState.run?.kills || 0).toLocaleString('ko-KR'); text['hudGold'] = gold.toLocaleString('ko-KR');
    width['hpFill'] = `${Math.max(0,Math.min(100,100*(p?p.hp:s.maxHp)/s.maxHp))}%`; text['hpText'] = `${uiNumber(p?p.hp:s.maxHp)} / ${uiNumber(s.maxHp)}`;
    width['xpFill'] = `${sessionState.run ? Math.min(100, 100 * sessionState.run.xp / sessionState.run.xpNext) : 0}%`; text['xpText'] = `${sessionState.run?.xp || 0} / ${sessionState.run?.xpNext || xpNeed(1)}`;
    html['characterStats'] =  [['공통 공격력', s.damage.toFixed(1)], ['펄스 기본 사격 간격', weaponConsumed('pulse',sessionState.run)?'융합 재료 · 공격 종료':`${s.interval.toFixed(2)}s`], ['펄스 발수',weaponConsumed('pulse',sessionState.run)?'—':`${s.shots}발`], ['이동 속도', Math.round(s.speed)], ['중앙탄 치명타',weaponConsumed('pulse',sessionState.run)?'적용 무기 없음':`${(statistics.pulseCritChance(s)*100).toFixed(1)}%`], ['보조탄 치명타',weaponConsumed('pulse',sessionState.run)?'적용 무기 없음':`${(statistics.pulseCritChance(s)*100).toFixed(1)}%`], ['재생 현재/평상시', `${(s.regen*recoveryScale(sessionState.run)).toFixed(2)} / ${s.regen.toFixed(2)} HP/s`], ['회복 상태', recoveryScale(sessionState.run)<1 ? `25% · ${Math.max(0,Math.ceil(sessionState.run.recoveryUntil-sessionState.run.time))}초` : '정상'], ['장갑 피해 감소', `${Number(((1-armorScale(sessionState.profile,sessionState.run))*100).toFixed(1))}%`], ['수집 EXP 배율', `×${xpCollectionScale(sessionState.profile,sessionState.run,hasRelic('harvest',sessionState.run)).toFixed(3)}`], ['시간대 공격 배율', `×${incomingScale(sessionState.run?.time || 0).toFixed(2)}`], ['공통 방어·선택 배율',`×${(armorScale(sessionState.profile,sessionState.run)*(frontEffect('breach','hold',sessionState.run)?.93:frontEffect('breach','break',sessionState.run)?1.1:1)*(sessionState.run?.echoOutcomes.guardian==='keep'?.85:1)*(legacyEffect('release','open',sessionState.run)?1.1:1)).toFixed(3)}`], ...(sessionState.run?.xpReserve ? [['보관 보석 EXP', sessionState.run.xpReserve.toLocaleString('ko-KR')]] : [])].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');
    const owned = upgrades.filter(item => (sessionState.run?.up[item.id] || 0) > 0&&!weaponConsumed(item.id,sessionState.run)&&(!item.id.startsWith('fusion_')||!fusionConsumed(item.id.slice(7),sessionState.run)));const fusionDisabled=!fusionRecipes.length||!fusionButtonEnabled(view,sessionState.run);text['fusionReadyCount'] = fusionRecipes.filter(f=>fusionReady(f,sessionState.run)).length+'개 가능';
    const pickedRelics = sessionState.run?.relics || [];
    const relicKey = pickedRelics.join(','); if (previousKeys.relicList !== relicKey) {
      html['relicList'] = pickedRelics.length ? pickedRelics.map(id => { const item = relics.find(x => x.id === id); return `<div class="relic-item"><strong>◆ ${item.name}</strong><span>${item.desc}</span></div>`; }).join('') : '<p class="muted">탐사 지점을 조사하면 유물을 선택할 수 있습니다.</p>'; keys.relicList = relicKey;
    }
    text['relicCount'] = `${pickedRelics.length}/3`;
    text['relicHistory'] = `발견 기록 ${relics.filter(item => sessionState.profile.memory.relics[item.id]).length}/6종 · ` + relics.filter(item => sessionState.profile.memory.relics[item.id]).map(item => `${item.name} ${sessionState.profile.memory.relics[item.id]}회`).join(' · ');
    text['buildProgress'] = Object.keys(sessionState.run?.branches||{}).length+' 전문화 선택';
    text['upgradeCount'] = `${owned.length} · 전문화 ${Object.keys(sessionState.run?.branches || {}).length}/${branches.length}`; html['activeUpgrades'] =  owned.length ? owned.map(item => `<span class="upgrade-chip">${item.name} ${sessionState.run.up[item.id]}${growthMetrics.branchLabel(item.id)?`<em class="upgrade-branch">◆ ${growthMetrics.branchLabel(item.id)}</em>`:''}</span>`).join('') : '<p class="muted">레벨업하면 효과를 선택할 수 있습니다.</p>';
    const value = amount => amount.toFixed(1);
    const weapons = [
      ['PULSE', `코어 Lv ${s.pulse}/5 · ${s.shots}발 / ${s.interval.toFixed(2)}초`, `중앙탄 ${value(statistics.weaponDamage('pulse', s))} · 보조탄 각 ${value(statistics.weaponDamage('extra', s))} (38%) · 탐지 490 · 관통 후속 피해 ×0.87 · 치명타 ×${s.critMult.toFixed(2)} · 최대 ${s.pierce}명 명중`],
      ['ORBIT', s.orbit ? `Lv ${s.orbit} · ${s.orbit}개 · 회전 반경 ${s.orbitRadius}` : '미해금', s.orbit ? `위성당 명중 ${value(statistics.weaponDamage('orbit', s))} · 적 탄환 접촉 시 요격 · 위성별 ${statistics.orbitReload()}초 재충전 · 명중한 일반 적 넉백 ${orbitPush(s)} · 몸통·돌진·지면 공격 차단 불가` : '위성 업그레이드로 해금'],
      ['NOVA', s.nova ? `Lv ${s.nova} · 반경 ${Math.round(statistics.novaRadius(s))} · ${statistics.novaInterval(s.nova).toFixed(2)}초 주기` : '미해금', s.nova ? `범위 피해 ${value(statistics.weaponDamage('nova', s))} · 일반 적 넉백 ${statistics.novaPush(s)} · 둔화 ${20}%` : '노바 충격파 업그레이드로 해금'],
      ['CHAIN', s.chain ? `Lv ${s.chain} · 최대 ${statistics.chainTargets(s)}명 · 재발동 ${statistics.chainReload(s).toFixed(2)}초` : '미해금', s.chain ? `자동 적 탐지 (460) · 첫 피해 ${value(statistics.weaponDamage('chain', s))} · 도약마다 ×${0.88} · 연쇄 거리 ${chainReach(s)} · 치명타 없음 · PULSE와 독립 발동` : '연쇄 번개 업그레이드로 해금']
    ];
    weapons.push(['LANCE', s.lance ? `Lv ${s.lance} · ${statistics.lanceInterval(s).toFixed(2)}초 · 충돌 반경 ${(lanceRadius(s)).toFixed(1)}` : '미해금', s.lance ? `피해 ${value(statistics.weaponDamage('lance', s))} · 최대 ${statistics.lanceTargets(s)}명 관통 · 탐지 490` : '파동 창으로 해금']);
    weapons.push(['RIFT', s.rift ? `Lv ${s.rift} · ${riftInterval(s).toFixed(2)}초` : '미해금', s.rift ? `삼중 균열 · 사거리 ${Math.round(statistics.riftLength(s))} · 중앙 ${value(statistics.weaponDamage('rift',s))} / 측면 각 ${value(statistics.weaponDamage('rift',s)*.68)}` : '균열 칼날로 해금']);
    weapons.push(['BEACON', s.beacon ? `Lv ${s.beacon} · 최대 2기 · 포탑 ${(beaconShotInterval(s)).toFixed(2)}초/발` : '미해금', s.beacon ? `포탑 사거리 ${Math.round((beaconRange(s)))} · 설치 ${beaconInterval(s).toFixed(2)}초 · 11초 유지 · 탄환 피해 ${value(statistics.weaponDamage('beacon',s))}${s.frost?' · 냉각탄':''}${s.machinery?' · 장치 가속 Lv'+s.machinery:''}` : '신호 포탑으로 해금']);
    weapons.push(['MINE', s.mine ? `Lv ${s.mine} · 최대 8개 · 기폭 반경 ${Math.round(statistics.mineRadius(s))} · 설치 ${statistics.mineInterval(s).toFixed(2)}초` : '미해금', s.mine ? `광역 피해 ${value(statistics.weaponDamage('mine', s))} · 적 접근 시 기폭 · 12초 유지${s.placement?' · 예측 배치 Lv'+s.placement:''}${s.machinery?' · 장치 가속 Lv'+s.machinery:''}` : '중력 기뢰로 해금']);
    const guideKey = JSON.stringify([Math.floor((sessionState.run?.time||0)*4),sessionState.run?.up, sessionState.run?.branches,  s.damage, s.interval, s.pierce, s.crit, sessionState.run?.journey.keystone, sessionState.run?.momentumTime>0, recoveryScale(sessionState.run), sessionState.run?.relics, Math.floor(sessionState.run?.time / 5), s.magnet]);
    if (previousKeys.weaponList !== guideKey) {
      html['weaponList'] = weapons.filter(row=>!weaponConsumed(row[0].toLowerCase(),sessionState.run)).map(row=>specialized(row[0].toLowerCase(),sessionState.run)?growthMetrics.specialWeaponRow(row[0],s):row).map(([name, summary, details]) => `<div class="weapon-row"><dt>${weaponLabel(name.toLowerCase(),name)}${growthMetrics.branchLabel(name.toLowerCase()) ? `<small class="branch-tag">${growthMetrics.branchLabel(name.toLowerCase())}</small>` : ''}</dt><dd><strong>${summary}</strong><small>${details}</small></dd></div>`).join('') + activeFusions(sessionState.run).map(f=>`<div class="weapon-row"><dt>${f.name}<small class="branch-tag">${f.base?'상위융합':'융합'} Lv.${sessionState.run.up['fusion_'+f.id]}/4</small></dt><dd><strong>${sessionState.run.fusionStates[f.id]?.phase==='wait'?'준비 대기':'공격 주기 진행'}</strong><small>${growthMetrics.fusionMetric(f)} · ${f.desc}</small></dd></div>`).join('') + (s.burst ? `<div class="weapon-row"><dt>연쇄 폭발</dt><dd><strong>처치 시 ${Number((burstChance(s.burst)*100).toFixed(1))}% 발동</strong><small>파편 6개 · 각각 피해 ${value(statistics.weaponDamage('burst', s))} · 명중당 1명</small></dd></div>` : '');
      keys.weaponList = guideKey;
    }
    const logs = sessionState.run?.logs?.length ? sessionState.run.logs : sessionState.profile.memory.archive;
    html['echoLog'] =  logs.length ? logs.slice(-5).reverse().map(msg => `<li>${htmlEscape(msg)}</li>`).join('') : '<li>아직 발견한 기록이 없습니다.</li>';
    text['guardianStatus'] = `감시자 · 돌려보냄 ${sessionState.profile.memory.guardian.spared}회 / 분해 ${sessionState.profile.memory.guardian.ended}회`;
    text['witnessStatus'] = sessionState.profile.memory.witness.quiet ? '숨겨진 기록 000 · 발견됨. 최대 HP +10 · 현재·다음 도전 적용' : sessionState.profile.memory.witness.met ? `기록원 · 대화 ${sessionState.profile.memory.witness.met}회 · 그가 남긴 목소리는 짧았다.` : '기록원 · 수신 없음';
    text['memoryCount'] = `${sessionState.profile.memory.heard} 기억 · ${sessionState.profile.memory.burned} 변환`;
    text['anomalyStatus'] = anomalies.map(event => {
      const choice = sessionState.run?.anomalyChoices?.[event.id], history = sessionState.profile.memory.anomalies[event.id];
      const selected = event.options.find(o => o.id === choice);
      return `${timeText(event.at)} ${event.title} · ${selected ? selected.name : '미발견'} · 누적 ${Object.values(history).reduce((a, b) => a + b, 0)}회`;
    }).join('\n');
    const j=sessionState.run?.journey,a=j?.active;
    text['journeyStatus'] = j?`응답 사건 · 완료 ${j.outcomes.filter(x=>x.success).length} / 소실 ${j.outcomes.filter(x=>!x.success).length}`+(a?`\n${episodeTitle(a.kind)} · ${Math.max(0,Math.ceil(a.until-sessionState.run.time))}초 · ${a.kind==='hunt'?'지정 표적 처치':a.kind==='gates'?`좌표 ${a.gate+1}/3 · ${a.charge.toFixed(1)}/3초`:`연결 ${a.charge.toFixed(1)}/14초`} · 성공 ${120+a.slot*80}G / 기본 EXP ${180+a.slot*100}`:''):'응답 사건 · 현재 도전 없음';
    text['keystoneStatus'] = j?.keystone?`최종 강화 · ${keystones.find(x=>x.id===j.keystone).name} · ${keystones.find(x=>x.id===j.keystone).desc}`:'최종 강화 · 미선택';
    text['objectiveStatus'] = objectives.map(task => {
      const active = sessionState.run?.objective?.id === task.id, history = sessionState.profile.memory.objectives[task.id];
      const outcome=sessionState.run?.objectiveOutcomes[task.id],label=active?(sessionState.run.objective.phase?'진행 중':'작전 수신'):outcome==='complete'?'완수':outcome==='failed'?'실패':outcome==='ignored'?'미응답':'미수신';
      return `${timeText(task.at)} ${task.name} · ${label} · 완수 보상 ${task.gold}G / 기본 EXP ${task.xp} · 완수 ${history.complete} / 실패 ${history.failed} / 미응답 ${history.ignored}`;
    }).join('\n');
    text['siteStatus'] = sites.map(site => {
      const current = sessionState.run?.site?.id === site.id, visited = sessionState.profile.memory.sites[site.id];
      return `${timeText(site.at)} ${site.title} · ${current ? '탐사 가능' : (sessionState.run?.siteStep || 0) > sites.indexOf(site) ? sessionState.run?.siteDecisions[site.id]?'조사 완료':'지나감' : '미발견'} · 기록 ${visited.keep + visited.take}회`;
    }).join('\n');
    const recalled = sessionState.profile.memory.lastResolution; hidden['endingMemory'] = !recalled?.threads?.length;
    html['resolutionList'] =  recalled?.threads?.map(line => `<li>${htmlEscape(line)}</li>`).join('') || '';
    text['echoStatus'] = echoes.map(e => { const m = sessionState.profile.memory.echoes[e.id], current = sessionState.run?.echoOutcomes?.[e.id], nearby = sessionState.run?.echoSite?.id === e.id; return `${timeText(e.at)} ${e.name} · ${current === 'keep' ? '복원' : current === 'use' ? '재사용' : current === 'silent' ? '미응답' : nearby ? '조사 가능' : sessionState.run?.echoSeed?.[e.id] ? sessionState.run.echoSeed[e.id]==='none'?'이름 없는 기록':'기록 대기' : '수신 대기'} · 누적 복원 ${m.keep} / 재사용 ${m.use} / 미응답 ${m.silent}`; }).join('\n');
    text['frontStatus'] = fronts.map(f => { const ch=sessionState.run?.frontChoices?.[f.id],m=sessionState.profile.memory.fronts[f.id];return `${timeText(f.at)} ${f.title} · ${ch === 'silent' ? '미응답' : ch ? frontOption(f,ch).name : sessionState.run?.front?.id===f.id ? '선택 가능' : '미도착'} · 응답 ${m[f.paths[0].id]+m[f.paths[1].id]} / 미응답 ${m.silent}${sessionState.run?.front?.id===f.id ? '\n  왼쪽: '+f.paths[0].name+' / '+f.paths[0].desc+'\n  오른쪽: '+f.paths[1].name+' / '+f.paths[1].desc : ''}`; }).join('\n');
    if (sessionState.run?.legacyOrigin) text['frontStatus'] += `\n지난 결말 · ${legacies[sessionState.run.legacyOrigin].name} · ${sessionState.run.legacyChoice === 'silent' ? '미응답' : sessionState.run.legacyChoice ? legacies[sessionState.run.legacyOrigin].options.find(x=>x.id===sessionState.run.legacyChoice)?.name : sessionState.run.legacySite ? '현장에서 응답 가능' : '03:00 이후 출현'}`;
    text['chapterStatus'] = (sessionState.profile.memory.chapters.length ? `신호의 결말 ${sessionState.profile.memory.chapters.length}/3 · ${sessionState.profile.memory.chapters.join(' / ')}` : '신호의 결말을 아직 발견하지 않았습니다.') + ` · 최종 엔딩 ${Object.values(sessionState.profile.memory.endings).filter(x => x > 0).length}/3: ${finalEndings.map(e => `${e.name} ${sessionState.profile.memory.endings[e.id]}회`).join(' / ')}`;
    text['walletGold'] = `${sessionState.profile.gold.toLocaleString('ko-KR')} G`; text['bestTime'] = timeText(sessionState.profile.bestTime); text['bestKills'] = sessionState.profile.bestKills.toLocaleString('ko-KR'); text['runCount'] = sessionState.profile.runs.toLocaleString('ko-KR');
    return {text,html,width,hidden,keys,fusionDisabled,fusionExpanded:String(view.mode==='fusion')};
  }

  return { readHud };
}
