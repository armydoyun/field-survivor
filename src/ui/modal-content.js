import { weaponLabel } from './weapon-label.js';
import { escapeHtml as htmlEscape, modal as modalHtml, action as actionHtml, decision as decisionHtml, sceneHtml } from './html.js';
import { hasRecords } from '../core/profile.js';
import { siteRewards, signalReward, witnessReward, endingReward } from '../data/world-choices.js';
import { timeText } from '../core/utils.js';
import { VERSION } from '../core/config.js';
import { finalEndings, endingTexts, signals, anomalies, sites as siteDefinitions, firstSignalAfterPreserve, witnessAfterRelease, deathLines, truthPieces, truthReveal } from '../data/world.js';
import { relicChoices } from '../world/effects.js';
import { branchReady } from '../growth/build.js';
import { upgrades, upgradeFamilies } from '../data/upgrades.js';
import { branches } from '../data/specializations.js';
import { canReroll } from '../growth/cards.js';
import { loadouts, unlockedLoadouts, startWeaponLevel } from '../data/loadouts.js';

// 이번 판의 축 위치(NARRATIVE-REDESIGN.md 3.3절). 기억 축 −7(연소) ~ +7(보존)과 감시자 결정.
function routeAxisHtml(axes){
  if(!axes)return '';
  const position=Math.round((Math.max(-7,Math.min(7,axes.memory))+7)/14*100);
  return `<div class="route-axis" aria-label="이번 판의 경로"><div class="route-axis-ends"><span>연소</span><span>보존</span></div><div class="route-axis-track"><span class="route-axis-mark" style="left:${position}%"></span></div><div class="route-axis-notes">감시자 · 돌려보냄 ${axes.spared} / 분해 ${axes.ended}${axes.stillness?' · 기록원 곁에서 멈춰 있었다':''}${axes.silence?` · 지나친 표식 ${axes.silence}`:''}</div></div>`;
}

export function createModalContent({ sessionState, view, keystoneOptions, fusionHtml, growthMetrics, route }) {

  function siteEffect(site,id){
    const reward=siteRewards[site.id][id],up=sessionState.run.up,extra=(key,amount)=>Math.min(amount,upgrades.find(x=>x.id===key).max-(up[key]||0));
    if(site.id==='coordinate')return id==='keep'?`+${reward.gold}G · 기본 EXP +${reward.xp}`:`+${reward.gold}G · 기본 EXP +${reward.xp} · 신속형 최대 ${reward.enemies.length}마리`;
    if(site.id==='reservoir')return id==='keep'?`HP 최대 ${reward.heal} 회복 · 기본 EXP +${reward.xp}`:`HP 최대 ${reward.hpCost} 소모(최소 1 유지) · 강화 탄환 +${extra('power',reward.power)}레벨 · 원거리형 최대 ${reward.enemies.length}마리`;
    return id==='keep'?`+${reward.gold}G · 생존 본능 +${extra('vitality',reward.vitality)}레벨 · HP 최대 ${reward.heal} 회복`:`과속 장전 +${extra('haste',reward.haste)}레벨 · 기본 EXP +${reward.xp} · 강화 적 최대 ${reward.enemies.length}마리`;
  }

  function buildModal() {
    if (view.mode === 'menu') {
      const ongoing = !!sessionState.run, stored = hasRecords(sessionState.profile,sessionState.run);
      const summary = ongoing ? `<div class="summary"><span>보관된 도전 <strong>${timeText(sessionState.run.time)}</strong></span><span>레벨 <strong>${sessionState.run.level}</strong></span><span>현재 HP <strong>${Math.ceil(sessionState.run.player.hp)}</strong></span></div>` : stored ? `<div class="summary"><span>최장 기록 <strong>${timeText(sessionState.profile.bestTime)}</strong></span><span>총 <strong>${sessionState.profile.runs.toLocaleString('ko-KR')}회</strong> 도전</span></div>` : '';
      const description = ongoing ? '진행 중인 도전이 저장되어 있습니다. 이어서 플레이하면 마지막 상태로 복귀하며, 처음부터 시작하면 해당 도전만 포기합니다.' : '빈 전장에 같은 신호가 다시 울린다.';
      const buttons = (ongoing ? actionHtml('resume', '이어서 플레이', true) : '') + actionHtml('new', ongoing ? '처음부터 시작' : stored ? '새 도전 시작' : '게임 시작', !ongoing) + (sessionState.profile.memory.lastResolution ? actionHtml('ledger-open', '지난 결말의 기록 열람') : '');
      return  modalHtml(`MODULAR ARCHITECTURE · V${VERSION}`, '끝없는 전장의 기록', description, buttons + (stored ? `<div class="menu-secondary">${actionHtml('reset-open', '모든 기록 초기화')}</div>` : ''), summary);
    } else if (view.mode === 'loadout') {
      // 시작 무기: 열린 것만 고를 수 있고, 잠긴 것은 여는 조건을 보여 준다.
      const memory=sessionState.profile.memory,open=new Set(unlockedLoadouts(memory)),label=id=>weaponLabel(id,upgrades.find(u=>u.id===id)?.name||id);
      const locked=loadouts.filter(l=>!open.has(l.id)).map(l=>`<li>${label(l.id)} · ${htmlEscape(l.unlock)}</li>`).join('');
      const cards=loadouts.filter(l=>open.has(l.id)).map((l,i)=>`<div class="option-card"><button type="button" class="option" data-action="start-${l.id}"><span class="option-level"><kbd>${i+1}</kbd></span><strong>${label(l.id)}</strong><span class="option-desc">${l.id==='pulse'?'기본 사격으로 시작':`Lv${startWeaponLevel(l.id)}로 시작 · 펄스 휴면`}</span></button></div>`).join('');
      return modalHtml('NEW RUN · LOADOUT','시작 무기','이번 판을 어떤 무기로 시작할지 고릅니다. 펄스가 아닌 무기로 시작하면 레벨업에서 펄스를 고르기 전까지 기본 사격이 쉽니다.',actionHtml('loadout-back','돌아가기'),`<div class="option-grid decision-grid" data-count="${open.size}">${cards}</div>`+(locked?`<details class="ending-ledger"><summary>잠긴 시작 무기 · ${loadouts.length-open.size}</summary><ul>${locked}</ul></details>`:''),true);
    } else if (view.mode === 'keystone') {
      return  decisionHtml('FINAL FORM','남은 하나의 자리','무기들의 진동이 하나의 박자로 겹친다.',keystoneOptions().map(x=>({id:'keystone-'+x.id,name:x.name,effect:x.desc})));
    } else if (view.mode === 'ledger') {
      const m=sessionState.profile.memory, last=m.lastResolution;
      // 진실 조각: 결말 4개와 정지 비밀이 하나씩 연다. 모두 모이면 전체 진실이 열린다.
      const found=truthPieces.filter(x=>x.id==='stillness'?m.witness.quiet:x.id==='origin'?m.stoker?.origin===true:m.endings[x.id]>0), allFound=found.length===truthPieces.length;
      const pieces=truthPieces.map(x=>found.includes(x)?`<li>${htmlEscape(x.text)}</li>`:`<li class="muted">잠김 · ${htmlEscape(x.unlock)}</li>`).join('');
      const epilogue = `<div class="closure-reveal"><strong>진실 조각 ${found.length}/${truthPieces.length}</strong><ul>${pieces}</ul>${allFound?`<p>${htmlEscape(truthReveal)}</p>`:''}</div>`;
      const summary=`<div class="summary">${finalEndings.map(x=>`<span>${x.name} <strong>${m.endings[x.id]}회</strong></span>`).join('')}</div>`;
      const recordLines=(last?.threads||[]).map(line=>`<li>${htmlEscape(line)}</li>`).join('');
      return modalHtml('ECHO ARCHIVE · CONCLUSION','결말과 남겨진 사람들','전투에서 내린 선택과 지나친 선택은 사라지지 않습니다. 마지막 도전의 기록과 발견한 결말을 다시 읽을 수 있습니다.',actionHtml('ledger-back','제목 화면으로',true),summary+epilogue+routeAxisHtml(last?.axes)+sceneHtml(last?.scenes)+(last?`<details class="ending-ledger" open><summary>마지막 결말 · ${finalEndings.find(x=>x.id===last.ending)?.name} · ${last.threads.length}건</summary><ul>${recordLines}</ul></details>`:''),true);
    } else if (view.mode === 'newconfirm') {
      return  modalHtml('NEW RUN · CONFIRM', '진행 중인 도전을 포기할까요?', `현재 ${timeText(sessionState.run?.time || 0)}까지 플레이한 도전과 획득한 전투 골드 ${sessionState.run?.gold || 0}G가 사라집니다. 영구 강화와 과거 기록은 유지됩니다.`, actionHtml('new-cancel', '계속 이어서 하기', true) + actionHtml('new-confirm', '현재 도전 포기하고 새로 시작'));
    } else if (view.mode === 'resetconfirm') {
      return  modalHtml('DATA MANAGEMENT · PERMANENT', '모든 기록을 초기화할까요?', '되돌릴 수 없습니다. 현재 도전, 골드, 영구 강화, 최고 기록, NPC·신호·이상 현상·탐사·작전·유물의 기억, 엔딩 발견 기록을 이 실행 환경에서 전부 삭제합니다. 다른 사이트 데이터는 삭제하지 않습니다.', actionHtml('reset-cancel', '취소', true) + actionHtml('reset-confirm', '모든 기록을 영구 삭제'));
    } else if (view.mode === 'paused') {
      return  modalHtml('PAUSED', '일시정지', '게임 시간과 전투가 멈췄습니다. 자동 저장 결과는 상단 저장 상태에서 확인할 수 있습니다.', actionHtml('resume', '계속하기', true) + actionHtml('menu', '제목 화면'));
    } else if (view.mode === 'encounter') {
      const witness = sessionState.profile.memory.witness, wasTaken = witness.taken > 0, wasHeard = witness.heard > 0;
      const deaths = sessionState.profile.memory.deaths, deathLine = deathLines.witness.filter(x => deaths >= x.from).at(-1)?.line.replace('{phase}', sessionState.profile.memory.lastDeathPhase || '이 벌판').replace('{count}', deaths);
      const intro = sessionState.run.legacyOrigin === 'release' ? witnessAfterRelease : deathLine && deaths >= 3 ? deathLine : witness.quiet ? '네가 말없이 서 있던 시간은 아직 남아 있어. 다른 시간은 전부 사라졌는데.' : wasTaken ? '전에는 내 말을 전부 연료로 바꿨지. 그래도 돌아왔네.' : wasHeard ? '너는 나를 기억하지 못해도, 나는 네가 멈췄던 순간을 기억해.' : '처음 보는 얼굴이네. 아니, 그저 처음이라고 믿는 얼굴인가.';
      const guardian = sessionState.profile.memory.guardian, trace = guardian.spared ? '감시자를 돌려보낸 선택도 여기 남아 있어.' : guardian.ended ? '감시자를 끝까지 분해한 명령도 여기 남아 있어.' : '';
      return decisionHtml('UNKNOWN CONTACT · 001','기록원',`${intro} ${trace} 나는 네가 지나가는 소리를 들었어. 한 번은 아주 가까웠고, 한 번은 여기까지 오지 않았지.`,[{id:'witness-hear',name:'이야기를 들어준다',effect:`즉시 HP 최대 ${witnessReward.heal} 회복 · 재생 +0.25/s (피격 후 3초간 +0.0625/s) · 획득 EXP +${Math.round(witnessReward.xp*100)}%`},{id:'witness-take',name:'기록을 추출한다',effect:`${witnessReward.gold}G · 이번 도전의 모든 무기 피해 +${Math.round(witnessReward.takeDamage*100)}%`}]);
    } else if (view.mode === 'secret') {
      const line = sessionState.profile.memory.witness.taken ? '한 번은 나를 부품으로 만들었지. 그런데도 이번에는 기다려 주었어.' : '이 세상은 네가 쓰러진 시간만 세고 있었어. 네가 가만히 있었던 순간은 한 번도 세지 않았지.';
      return  modalHtml('HIDDEN RECORD · 000', '아무것도 하지 않은 시간', `${line} 지금은 달라. 네가 서 있던 4.5초가 여기에 남았어. 이번 도전에도 남고, 다음에도 사라지지 않을 거야.`, actionHtml('silence', sessionState.profile.memory.witness.quiet ? '기억으로 남긴다' : `기억으로 남긴다 · HP 최대 ${witnessReward.silenceHeal} 회복 / 영구 최대 HP +10(즉시 적용)`, true));
    } else if (view.mode === 'signal') {
      const ev=signals[sessionState.run.signalStep], heard=sessionState.profile.memory.heard, burned=sessionState.profile.memory.burned;
      const trace=sessionState.run.signalStep===2 && heard+burned?`잡음 사이에 ${heard}개의 응답과 ${burned}개의 빈 주파수가 겹친다.`:'';
      const line=sessionState.run.signalStep===0&&sessionState.run.legacyOrigin==='preserve'?firstSignalAfterPreserve:ev.line;
      return decisionHtml('INCOMING SIGNAL',ev.title,`${line} ${trace}`,[{id:'hear',name:'기억한다',effect:`최대 HP 기초값 +${signalReward.hp} · 즉시 HP 최대 ${signalReward.hp} 회복 · 획득 EXP +${Math.round(signalReward.xp*100)}%`},{id:'burn',name:'연료로 변환한다',effect:`신호 공격력 배율 +${Math.round(signalReward.burnPower*100)}%p · ${signalReward.goldBase+signalReward.goldStep*(sessionState.run.signalStep+1)}G`}]);
    } else if (view.mode === 'anomaly') {
      const e=anomalies[sessionState.run.anomalyStep];
      return decisionHtml(`FIELD SHIFT · 전장 변화 ${String(sessionState.run.anomalyStep+1).padStart(2,'0')} / 03`,e.title,e.line,e.options.map(o=>({id:'anomaly-'+o.id,name:o.name,effect:o.effect})));
    } else if (view.mode === 'site') {
      const e=siteDefinitions[sessionState.run.siteStep];
      return decisionHtml(`FIELD SITE ${String(sessionState.run.siteStep+1).padStart(2,'0')} / 03`,e.title,e.line,e.options.map(o=>({id:'site-'+o.id,name:o.name,effect:siteEffect(e,o.id)})));
    } else if (view.mode === 'relic') {
      const site=siteDefinitions.find(s=>s.id===sessionState.run.relicPending),items=site?relicChoices(site.id):[];
      return decisionHtml('RELIC DISCOVERY','남겨진 두 개의 유물',`${site?.title||'탐사 지점'}. 손을 뻗자 두 장치가 서로 다른 박자로 울린다. 하나만 가져갈 수 있다.`,items.map(o=>({id:'relic-'+o.id,name:o.name,effect:o.desc})));
    } else if(view.mode==='fusion'){return fusionHtml();
    } else if (view.mode === 'branch') {
      const b=branchReady(sessionState.run);if(!b)return null;
      return decisionHtml('SPECIALIZATION',`${b.name} · 전문화`,'Lv.3 · 이번 도전 동안 유지되며 선택권을 소모하지 않습니다. 지정 전문화 2개를 각각 Lv.5까지 성장시키면 G로 융합할 수 있습니다.',b.options.map(o=>({id:'branch-'+o.id,name:o.name,effect:o.desc+' · '+growthMetrics.specializationPaths(b.id,o.id)})));
    } else if (view.mode === 'levelup') {
      const options = (sessionState.run.choices || []).map((id, i) => { const item = upgrades.find(x => x.id === id), level = (sessionState.run.up[id] || 0) + 1; return `<div class="option-card" data-family="${upgradeFamilies[id]}"><button type="button" class="option" data-choice="${id}"><span class="option-level"><kbd>${i + 1}</kbd><span class="option-family">${upgradeFamilies[id]}</span><span class="option-rank">LV ${level}/${item.max}</span></span><strong id="upgradeName-${id}">${weaponLabel(id,item.name)}</strong><span class="option-desc">${growthMetrics.upgradeDescription(id)}</span>${branches.some(b => b.id === id) && level === 3 && !growthMetrics.branchLabel(id) ? `<span class="combo-ready">◆ 무기 전문화 선택 가능</span>` : ''}<span class="option-select">이 스킬 선택 <span aria-hidden="true">→</span></span></button><button type="button" class="option-more" data-upgrade-info="${id}" aria-label="${i + 1}번 선택지 상세 정보" aria-describedby="upgradeName-${id}"><span>효과와 수치 자세히 보기</span><span aria-hidden="true">↗</span></button></div>`; }).join('');
      const reroll = `<button type="button" class="button" data-action="reroll" ${!sessionState.run.rerolls || !canReroll(sessionState.run) ? 'disabled' : ''}>선택지 새로고침 <kbd>R</kbd> · ${sessionState.run.rerolls || 0}회</button>`;
      return  modalHtml('LEVEL UP · SELECT ONE', `레벨 ${sessionState.run.level} 달성`, '업그레이드 하나를 고르세요. 선택하는 동안 게임은 멈춥니다.', reroll, `<div class="option-grid">${options}</div><p class="reroll-note">${!canReroll(sessionState.run) ? '남은 스킬이 같아 새로고침할 다른 후보가 없습니다.' : sessionState.run.rerolls ? '레벨업 선택권을 소모하지 않습니다. 새로고침 횟수와 후보는 저장됩니다.' : '전술 재설계 영구 강화로 새 도전 시작 시 횟수를 충전할 수 있습니다.'}</p>`, true);
    } else if (view.mode === 'finalintro') {
      const voice=sessionState.profile.memory.witness.heard?'잡음 속에서 기록원의 목소리가 들린다.':sessionState.profile.memory.witness.taken?'추출한 기록의 빈 주파수가 울린다.':'발자국 소리가 멎는다.';
      return modalHtml('THE LOOP · 30:00','마지막 신호',`${voice} 벌판의 모든 선이 한 점으로 모인다. 중심핵 안에서 누군가 네 발소리를 세고 있다.`,actionHtml('final-enter','중심핵과 마주한다',true));
    } else if (view.mode === 'finalchoice') {
      const current=route?.()||{ending:'divided',release:false},text=endingTexts[current.ending],seen=finalEndings.filter(x=>sessionState.profile.memory.endings[x.id]>0).length;
      // 해방 힌트는 결말을 2개 이상 본 뒤에만 직접 말한다. 그 전에는 기록원이 기다리는 모습만 보인다.
      const witness=current.release?(seen>=2?' 기록원이 속삭인다. "누르지 마. 네가 서 있던 시간을 기억해."':' 기록원이 무언가를 기다리듯 너를 본다.'):'';
      return decisionHtml('THE LOOP · DECISION','반복의 중심',`중심핵의 빛이 멎는다. ${text.prompt}${witness}`,[{id:'final-'+current.ending,name:text.confirm,effect:`결말 보상 · ${endingReward}G`}]);
    } else if (view.mode === 'ending') {
      const ending = finalEndings.find(x => x.id === view.lastResult?.endingId) || finalEndings[0], intro = (view.lastResult?.variant === 'hollow' ? endingTexts.hollow : endingTexts[ending.id]).intro;
      const summary = `<div class="summary"><span>생존 <strong>${timeText(view.lastResult?.time || 0)}</strong></span><span>획득 <strong>${view.lastResult?.gold || 0} G</strong></span></div>`;
      const receipts=view.lastResult?.threads||[], epilogue=receipts.length?`<details class="ending-ledger"><summary>세부 기록 · ${receipts.length}건</summary><ul>${receipts.map(line=>`<li>${htmlEscape(line)}</li>`).join('')}</ul></details>`:'<p class="ending-ledger-empty">이번 도전에서 추가로 회수할 선택 기록은 없었습니다.</p>';
      return  modalHtml('ENDING · THE LOOP', view.lastResult?.variant === 'hollow' ? `${ending.name} · 빈 껍질` : ending.name, intro, actionHtml('menu', '기록으로 돌아가기', true) + actionHtml('new', '새로운 도전') + actionHtml('ledger-open', '이 결말의 기록 열람'), summary+routeAxisHtml(view.lastResult?.axes)+sceneHtml(view.lastResult?.scenes)+epilogue, true);
    } else if (view.mode === 'gameover') {
      const r = view.lastResult || { time: 0, kills: 0, gold: 0, level: 1 }, summary = `<div class="summary"><span>생존 <strong>${timeText(r.time)}</strong></span><span>레벨 <strong>${r.level}</strong></span><span>처치 <strong>${r.kills}</strong></span><span>획득 <strong>${r.gold} G</strong></span></div>`;
      const deaths = sessionState.profile.memory.deaths, witnessLine = sessionState.profile.memory.witness.met ? deathLines.witness.filter(x => deaths >= x.from).at(-1)?.line.replace('{phase}', sessionState.profile.memory.lastDeathPhase || '이 벌판').replace('{count}', deaths) : '';
      return  modalHtml('RUN COMPLETE', '게임 오버', `${deathLines.gameover}${witnessLine ? ` 기록원의 목소리가 들린다. "${witnessLine}"` : ''} 획득한 골드는 영구 보유됩니다.`, actionHtml('menu', '성장 화면으로', true) + actionHtml('new', '바로 재도전'), summary);
    }
  }

  return { buildModal };
}
