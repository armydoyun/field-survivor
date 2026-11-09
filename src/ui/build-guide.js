import { weaponLabel } from './weapon-label.js';
import { canOpenUpgradeInfo, canToggleBuildGuide } from '../core/view-policy.js';
import { modal as modalHtml, action as actionHtml } from './html.js';
import { fusionRecipes } from '../data/fusions.js';
import { fusionReady, activeFusions, specialized } from '../growth/build.js';
import { upgrades, upgradeDetails, upgradeFamilies } from '../data/upgrades.js';
import { branches } from '../data/specializations.js';

export function createBuildGuide({ sessionState, view, platform, growthMetrics, statistics, growthActions, buildModel }) {
  const { keys, $, canvas } = platform;

  function renderFusionModal(){const ready=fusionRecipes.filter(f=>fusionReady(f,sessionState.run));return modalHtml('FUSION · SPECIALIZED WEAPONS','무기 융합','융합: 지정 전문화 2개 각각 Lv.5. 상위융합: 지정 융합 Lv.4 + 추가 전문화 Lv.5. 재료의 기존 공격은 종료되며 사라진 기능의 투자는 환급되지 않습니다.',ready.map(f=>`<div class="fusion-choice"><h3>${f.base?'상위융합 · ':''}${f.name}</h3>${growthMetrics.guideRequirements(growthMetrics.fusionGuideState(f).requirements)}<p>${f.desc}</p>${f.base?'':`<p class="small-note">상위 연결: ${growthMetrics.fusionSuccessors(f)}</p>`}<p class="small-note">${growthMetrics.fusionMetric(f)}</p><p class="small-note">${growthMetrics.fusionInvestment(f)}</p><p class="small-note">${buildModel.fusionPathPreview(f)}</p>${actionHtml('fusion-'+f.id,f.base?'상위융합 선택':'이 무기로 융합')}</div>`).join('')+(!ready.length?'<p>현재 완성 가능한 융합이 없습니다. 조합 도감에서 정확한 재료를 확인할 수 있습니다.</p>':'')+actionHtml('fusion-guide','조합 도감')+actionHtml('fusion-close','돌아가기'));
  }

  function openUpgradeInfo(id) {
    const def = upgrades.find(item => item.id === id); if (!canOpenUpgradeInfo(view) || !def || !sessionState.run?.choices?.includes(id)) return;
    const current = sessionState.run.up[id] || 0, projected = statistics.projectedUpgrade(id);
    const previous = statistics.stats(), next = statistics.stats(projected), metric = growthMetrics.upgradeMetric(id, previous, next, current, current+1,sessionState.run,projected);
    
    const texts = upgradeDetails[id]; view.skillInfoFocus = document.activeElement; view.skillInfoOpen = true; keys.clear();
    $('skillInfoContent').innerHTML = `<div class="eyebrow">${upgradeFamilies[id]} · LV ${current+1} / ${def.max}</div><h2 id="skillInfoTitle">${def.name}</h2><p class="skill-lead">${growthMetrics.upgradeDescription(id)}</p><div class="skill-metric"><span>${growthMetrics.branchLabel(id)?"기준값 변화 · 명중 계수는 전문화 설명 참고":"이번 선택 후 변화"}</span><strong>${metric}</strong></div><h3>어떻게 작동하나요?</h3><p>${growthMetrics.branchLabel(id)?branches.find(b=>b.id===id).options.find(o=>o.id===sessionState.run.branches[id]).desc:texts[0]}</p><h3>기본 공식 · 전문화·기록 보정 전</h3><p>${texts[1]}</p><h3>적용 범위 · 주의사항</h3><p>${texts[2]}</p>${texts.slice(3).map(line=>`<p>${line}</p>`).join('')}${growthMetrics.branchLabel(id) ? `<h3>활성 전문화</h3><p>${growthMetrics.branchLabel(id)} · ${branches.find(b => b.id === id).options.find(o => o.id === sessionState.run.branches[id]).desc}</p>` : ''}${growthMetrics.fusionUpgradeChange(id,sessionState.run,projected)?`<h3>융합에서의 실제 변화</h3><p>${growthMetrics.fusionUpgradeChange(id,sessionState.run,projected)}</p>`:''}<h3>현재 적용 보정</h3><p>위 기준값에는 현재 기록·유물·최종 강화를 반영합니다. 전문화의 단계별 명중 계수와 공격 공백은 활성 전문화 설명을 함께 확인하세요. 획득 직후 고르는 전문화는 아직 미적용입니다. 최대 HP 증가는 즉시 회복과 별개이며 회복량은 상한을 넘지 않습니다.</p>`;
    $('skillModal').hidden = false; $('closeSkillInfo').focus({ preventScroll: true });
  }

  function closeUpgradeInfo() {
    if (!view.skillInfoOpen) return; view.skillInfoOpen = false; $('skillModal').hidden = true;
    const target = view.skillInfoFocus; view.skillInfoFocus = null;
    (target?.isConnected ? target : $('overlay').querySelector('[data-choice]'))?.focus({ preventScroll: true }); view.lastFrame = performance.now();
  }

  function renderSpecializationGuide(b,o){
    const {state,label,note,next}=buildModel.specializationGuide(b,o);
    if(view.buildTab==='active'&&state!=='active')return '';return `<div class="evolution guide-card specialization" data-weapon="${b.id}" data-branch="${o.id}" data-state="${state}"><div class="guide-card-head"><div><small>${weaponLabel(b.id)} · 전문화</small><strong>${o.name}</strong></div><span class="guide-badge">${label}</span></div><p class="guide-note">${note}</p><span class="evolution-effect">${o.desc}</span><span class="guide-lineage">연결 융합: ${next.map(f=>f.name).join(' · ')||'없음'}</span></div>`;
  }

  function renderBuildGuide(){
    const entries=fusionRecipes.map(f=>({f,...growthMetrics.fusionGuideState(f)})),count=activeFusions(sessionState.run).length,selected=branches.filter(b=>specialized(b.id,sessionState.run)).length;document.querySelectorAll('[data-build-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.buildTab===view.buildTab)));$('evolutionGuide').setAttribute('aria-labelledby',view.buildTab==='active'?'buildActiveTab':'buildAllTab');$('buildProgress').textContent=count+' 활성 · 융합/상위융합';$('buildModalCount').textContent=sessionState.run?`${selected} 전문화 · ${count} 융합 보유`:'도전 전 · 조건 안내';
    const special=branches.flatMap(b=>b.options.map(o=>renderSpecializationGuide(b,o))).join(''),rows=upper=>entries.filter(v=>!!v.f.base===upper&&(view.buildTab==='all'||v.state==='active')).map(v=>`<div class="evolution fusion guide-card" data-fusion="${v.f.id}" data-state="${v.state}"><div class="guide-card-head"><div><small>${v.f.base?'상위융합':'융합'}${sessionState.profile.memory.fusions[v.f.id]?' · 발견 기록 있음':''}</small><strong>${v.f.name}</strong></div><span class="guide-badge">${v.label}</span></div><p class="guide-note">${v.note}</p><span class="evolution-effect">${v.f.desc}</span><span class="guide-condition-title">${['active','consumed'].includes(v.state)?'제작에 사용한 재료 · 현재는 소비됨':'필요 재료 · 현재 상태'}</span>${growthMetrics.guideRequirements(v.requirements)}<details><summary>성능과 투자 적용</summary><p>${growthMetrics.fusionMetric(v.f)}</p><p>${growthMetrics.fusionInvestment(v.f)}</p></details></div>`).join(''),normal=rows(false),upper=rows(true),group=(title,html)=>html?`<h3 class="build-group-heading">${title}</h3><div class="build-grid">${html}</div>`:'';
    const summary=sessionState.run?`<div class="guide-summary" aria-label="전체 융합 계보의 상태"><span>융합 가능 <b>${entries.filter(v=>v.state==='ready').length}</b></span><span>준비 중 <b>${entries.filter(v=>v.state==='pending').length}</b></span><span>경로 닫힘 <b>${entries.filter(v=>v.state==='blocked').length}</b></span></div>`:'',empty=!special&&!normal&&!upper?'<p class="guide-empty">현재 보유한 전문화·융합이 없습니다. 전체 도감에서 원본 무기와 필요한 경로를 확인할 수 있습니다.</p>':'';
    $('evolutionGuide').innerHTML=summary+'<p class="guide-legend">원본 레벨이 높아도 지정 전문화가 다르거나 재료가 소비되었으면 조건을 충족하지 않습니다. 경로 닫힘은 이번 도전 기준이며, 발견 기록은 현재 보유와 별개입니다.</p>'+group('전문화 · 16종',special)+group('일반 융합 · 16종',normal)+group('상위융합 · 6종 / 16경로',upper)+empty+'<p class="small-note">융합: 지정 전문화 2개 각각 Lv.5. 상위융합: 지정 융합 Lv.4 + 추가 전문화 Lv.5. G로 선택. 상위융합 6종 구현. 사용한 원본·기반 융합은 다시 획득할 수 없습니다.</p>';
  }

  function toggleBuildGuide(open = !view.buildOpen) {
    if (!canToggleBuildGuide(view,open)) return;
    view.buildOpen = open;
    $('buildModal').hidden = !open;
    if (open) { view.buildReturnFocus = document.activeElement; view.buildTab = 'all'; keys.clear(); renderBuildGuide(); $('closeBuildGuide').focus({ preventScroll: true }); }
    else { const node = view.buildReturnFocus; view.buildReturnFocus = null; (node?.isConnected && !node.closest('[hidden]') ? node : (view.mode === 'playing' ? canvas : $('overlay').querySelector('button:not(:disabled)')))?.focus({ preventScroll: true }); view.lastFrame = performance.now(); }
  }

  function keyboardBuildGuide(event) {
    if (!view.buildOpen) return false;
    if(event.code==='KeyG'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey){toggleBuildGuide(false);if(view.mode!=='fusion')growthActions.toggleFusion();return true;}
    if (event.code === 'Escape' || event.code === 'KeyB') { toggleBuildGuide(false); return true; }
    if (event.code === 'Tab') {
      const items = [...$('buildModal').querySelectorAll('button,summary,details[open] a,[tabindex="0"]')].filter(el => el.getClientRects().length), i = items.indexOf(document.activeElement);
      if (i === -1 || (!event.shiftKey && i === items.length - 1) || (event.shiftKey && i === 0)) { items[event.shiftKey ? items.length - 1 : 0]?.focus(); return true; }
    }
    if (['ArrowLeft','ArrowRight'].includes(event.code) && document.activeElement?.matches('[data-build-tab]')) {
      const other = $('buildModal').querySelector(`[data-build-tab="${view.buildTab === 'all' ? 'active' : 'all'}"]`); other?.click(); other?.focus(); return true;
    }
    if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','Digit1','Digit2','Digit3'].includes(event.code)) return true;
    return false;
  }

  return { renderFusionModal, openUpgradeInfo, closeUpgradeInfo, renderBuildGuide, toggleBuildGuide, keyboardBuildGuide };
}
