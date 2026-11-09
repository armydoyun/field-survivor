import { fusionParameters, fusionInterval } from '../combat/fusion-parameters.js';
import { fusionById } from '../data/fusions.js';
import { orbitPush, chainReach, lanceRadius, beaconRange, specRules, specTiming, specRiftWidth, specBeaconRadius, specBeaconInterval } from '../combat/weapon-parameters.js';
import { number as uiNumber, percent as uiPercent } from './html.js';
import { branches } from '../data/specializations.js';
import { hasBranch, activeFusions } from '../growth/build.js';
import { fusionRecipes } from '../data/fusions.js';
import { upgrades } from '../data/upgrades.js';
import { fusionUpgradeEffect, originalUpgradeEffect } from '../growth/cards.js';
import { recoveryScale } from '../combat/recovery.js';
import { burstChance } from '../combat/death.js';
import { xpCollectionScale } from '../growth/experience.js';
import { hasRelic } from '../world/effects.js';
import { armorScale } from '../combat/rules.js';

export function createGrowthMetrics({ sessionState, statistics, buildModel }) {

  const { branchLabel, fusionGuideState, fusionMaterialName }=buildModel;

  function fusionInvestment(f){const applied=upgrades.filter(u=>(sessionState.run?.up[u.id]||0)>0&&!u.id.startsWith('fusion_')&&fusionUpgradeEffect(f,u.id)).map(u=>u.name),lost=upgrades.filter(u=>(sessionState.run?.up[u.id]||0)>0&&['haste','momentum','multishot','pierce','conduction','machinery','wavecraft','edgecraft','repulsion'].includes(u.id)&&!fusionUpgradeEffect(f,u.id)).map(u=>u.name);return '계승 투자: '+(applied.join(' · ')||'공통 공격력')+' / 이 융합에 미적용: '+(lost.join(' · ')||'없음')+' · 원본 공격 종료·재획득 및 투자 환급 없음';}
  function specialWeaponRow(name,s){
    const id=name.toLowerCase(),def=branches.find(b=>b.id===id),option=def.options.find(o=>o.id===sessionState.run.branches[id]),q=sessionState.run.arsenal.states[id],phase=q?.phase||'wait',labels={wait:'탐색',aim:'재조준',burst:'점사',charge:'비축',release:'방출',orbit:'호위',out:'출격',back:'귀환',observe:'관측',prepare:'준비',flight:'투하',shoot:'사격',pack:'접기',move:'이동',deploy:'재설치'},f=sessionState.run.arsenal.fields.find(f=>f.owner===id),active=f?.phase||phase;
    const states={expand:'확장',hold:'경계 유지',return:'수축',forward:'연결',reverse:'역주사',loop:'회로 유지',stay:'잔류',arm:'무장',pressed:'압력 감지',jump:'도약',record:'재조준',open:'절개',fold:'접힘'};
    const rules=specRules[id];let metric='';const value=n=>n.toFixed(1),d=statistics.weaponDamage(id,s);
    if(id==='pulse')metric=`중앙 ${value(d)} / 보조 ${value(d*rules.side)} · 묶음당 ${s.shots}발 · 기본 간격 ${s.interval.toFixed(2)}초 · ${hasBranch(id,'tracking',sessionState.run)?`${rules.volleys}회 점사`:`${rules.volleys}회분 비축`} · 관통 ${s.pierce}명 · 냉각탄·치명타 적용`;
    if(id==='orbit')metric=`일반 적 넉백 ${orbitPush(s)} · 위성 ${s.orbit}개 · 공격 ${value(d*(hasBranch(id,'escort',sessionState.run)?rules.escort:rules.eccentric))} · ${hasBranch(id,'escort',sessionState.run)?`출격 최대 ${specTiming.orbitOut}초 · 귀환 중 피해 없음`:`장반경 ${rules.major} / 단반경 ${rules.minor} · 위성별 재타격 ${rules.gap}초`} · 호위 구간 요격 재충전 ${statistics.orbitReload()}초`;
    if(id==='nova')metric=`반경 ${Math.round(statistics.novaRadius(s))} · 주기 ${statistics.novaInterval(s.nova).toFixed(2)}초 · ${hasBranch(id,'boundary',sessionState.run)?`확장 ${value(d*rules.expand)} / 경계 ${value(d*rules.hold)} · 둔화 ${rules.slow*100}% / ${rules.slowTime}초 · 넉백 ${statistics.novaPush(s)}`:`확장 ${value(d*rules.reflux)} / 귀환 ${value(d*rules.return)} / 표식 귀환 ${value(d*rules.marked)} · 둔화·넉백 없음`} · 회복 없음`;
    if(id==='chain')metric=`최대 ${statistics.chainTargets(s)}명 · 주기 ${statistics.chainReload(s).toFixed(2)}초 · 첫 연결 ${value(d*rules.forward)} · ${hasBranch(id,'return',sessionState.run)?`첫 경로 복귀 ${value(d*rules.reverse)} · 복귀는 대상별 1회`:`경계 ${value(d*rules.loop)} · ${rules.gap}초 간격 최대 ${rules.cap}회`} · 도약 감쇠 ×${rules.decay} · 냉각·치명타 없음`;
    if(id==='lance')metric=`주기 ${statistics.lanceInterval(s).toFixed(2)}초 + 회수 대기 · 관통 ${statistics.lanceTargets(s)}명 · 출격 ${value(d*rules.travel)} · ${hasBranch(id,'return',sessionState.run)?`귀환 ${value(d*rules.travel)} / 관통 ${statistics.lanceTargets(s)}명`:`잔류 ${value(d*rules.stay)} ×최대 ${rules.cap}회 / ${specTiming.lanceStay}초 · 잔류 관통 제한 없음`} · 냉각·치명타 없음`;
    if(id==='mine')metric=`설치 ${statistics.mineInterval(s).toFixed(2)}초 · 최대 ${rules.cap}개(공중 포함) · 반경 ${Math.round(statistics.mineRadius(s))} · 폭발 ${value(d)} · 요격·회복·치명타 없음`;
    if(id==='rift')metric=`사거리 ${Math.round(statistics.riftLength(s))} · 주기 ${statistics.riftInterval(s).toFixed(2)}초 · ${hasBranch(id,'fold',sessionState.run)?`통로 반폭 ${specRiftWidth(s,true)} · 양측 각 ${value(d*rules.side)} / 중심 ${value(d*rules.center)}`:`절단 반폭 ${specRiftWidth(s)} · 첫 ${value(d*rules.first)} / 후속 각 ${value(d*rules.follow)} ×${rules.cuts-1}`} · 냉각·치명타 없음`;
    if(id==='beacon')metric=hasBranch(id,'relay',sessionState.run)?`장치 ${rules.units}기 · 포격 ${value(d*rules.impact)} · 반경 ${specBeaconRadius(s)} · 주기 ${specBeaconInterval(s).toFixed(2)}초 + 재배치 · 냉각·포탑 수·치명타 미적용`:`장치 ${rules.units}기 · 탄환 ${value(d*rules.shot)} · ${statistics.beaconShotInterval(s).toFixed(2)}초/발 · ${rules.shots}발 후 이동 · 냉각탄 ${s.frost?'적용':'미보유'} · 치명타 없음`;
    return [name,`${option.name} · ${states[active]||labels[active]||'진행 중'}`,metric+' · '+option.desc];
  }

  function guideRequirements(items){return '<ul class="guide-materials">'+items.map(v=>`<li data-state="${v.state}"><span>${v.name}</span><small>${v.detail}</small></li>`).join('')+'</ul>';}

  function fusionMetric(f,r=sessionState.run){if(!r)return f.desc;const projected={...r,up:{...r.up,['fusion_'+f.id]:r.up['fusion_'+f.id]||1}},p=fusionParameters(f,projected,statistics.stats(projected)),base=f.base?fusionById[f.base]:f;return `${f.base?'기반 '+base.name+' 유지 · ':''}기준 피해 D ${p.damage.toFixed(2)} · 기반 주기 ${fusionInterval(base,p).toFixed(3)}초${f.base?' / 추가 주기 '+fusionInterval(f,p).toFixed(3)+'초':''} · 영역 ×${p.size.toFixed(2)} · 치명타 ${(p.crit*100).toFixed(1)}% · 잔상 피해 없음`;}

  function fusionSuccessors(f){return fusionRecipes.filter(u=>u.base===f.id).map(u=>u.name+' ('+fusionMaterialName(u.extra)+')').join(' / ')||'지정된 상위융합 없음';}

  const specializationPaths=(weapon,option=sessionState.run?.branches[weapon])=>fusionRecipes.filter(f=>!f.base&&f.needs.some(([w,b])=>w===weapon&&b===option)).map(f=>f.name).join(' / ');

  function upgradeDescription(id){const def=upgrades.find(u=>u.id===id),effects=activeFusions(sessionState.run).filter(f=>fusionUpgradeEffect(f,id)).map(f=>`${f.name}: ${fusionUpgradeEffect(f,id)}`);if(!effects.length)return def.desc;return (originalUpgradeEffect(id,sessionState.run)?def.desc+' · ':'')+'융합 적용 · '+effects.join(' / ');}

  function fusionUpgradeChange(id,before,after){return activeFusions(before).filter(f=>id==='fusion_'+f.id||fusionUpgradeEffect(f,id)).map(f=>f.name+': '+fusionMetric(f,before)+' → '+fusionMetric(f,after)).join(' / ');}

  function upgradeMetric(id, previous, next, oldLv, newLv, before=sessionState.run, after=sessionState.run) {
    const fmt = (label, a, b, unit = '') => `${label}: ${uiNumber(a)}${unit} → ${uiNumber(b)}${unit}`;
    if(id.startsWith('fusion_'))return fusionUpgradeChange(id,before,after);
    if(!originalUpgradeEffect(id,before)){const change=fusionUpgradeChange(id,before,after);if(change)return change;}
    if (id === 'power') return fmt('공통 공격력', previous.damage, next.damage);
    if (id === 'haste') return fmt('기본 공격 간격', previous.interval, next.interval, '초');
    if (id === 'momentum') { const moving = { ...sessionState.run, momentumTime: 1 }; return fmt('이동 중 기본 공격 간격', statistics.stats(moving).interval, statistics.stats({ ...moving, up: { ...sessionState.run.up, momentum: newLv } }).interval, '초'); }
    if (id === 'multishot') return fmt('한 번에 발사하는 기본 탄환', previous.shots, next.shots, '발');
    if (id === 'pierce') return fmt('탄환 하나당 최대 타격', previous.pierce, next.pierce, '명');
    if (id === 'area') return fmt('PULSE 충돌 반경', previous.radius, next.radius);
    if (id === 'speed') return fmt('이동 속도', previous.speed, next.speed);
    if (id === 'vitality') return `${fmt('최대 체력',previous.maxHp,next.maxHp)} · ${fmt('현재 HP',before.player.hp,after.player.hp)}`;
    if (id === 'magnet') return fmt('보석 흡수 반경', previous.magnet, next.magnet);
    if (id === 'regen') return fmt('초당 체력 회복(현재)', previous.regen*recoveryScale(before), next.regen*recoveryScale(after), ' HP/s');
    if (id === 'crit') return `${fmt('중앙탄 치명타',statistics.pulseCritChance(previous)*100,statistics.pulseCritChance(next)*100,'%')} · ${fmt('보조탄 치명타',statistics.pulseCritChance(previous)*100,statistics.pulseCritChance(next)*100,'%')}`;
    if (id === 'orbit') return fmt('방어 위성 수', previous.orbit, next.orbit, '개');
    if (id === 'burst') return `처치 시 파편 발동 확률: ${uiPercent(burstChance(oldLv))} → ${uiPercent(burstChance(newLv))}`;
    if (id === 'pulse') return fmt('중앙 PULSE 피해', statistics.weaponDamage('pulse', previous), statistics.weaponDamage('pulse', next));
    if (id === 'nova') return `${fmt('충격파 반경', oldLv ? statistics.novaRadius(previous) : 0, statistics.novaRadius(next))} · ${fmt('발동 간격', statistics.novaInterval(oldLv), statistics.novaInterval(newLv), '초')}`;
    if (id === 'chain') return `${fmt('번개 최대 대상', oldLv ? statistics.chainTargets(previous) : 0, statistics.chainTargets(next), '명')} · ${fmt('재발동 간격', statistics.chainReload(previous), statistics.chainReload(next), '초')}`;
    if (id === 'lance') return `${fmt('창 최대 타격', oldLv ? statistics.lanceTargets(previous) : 0, statistics.lanceTargets(next), '명')} · ${fmt('발사 간격', statistics.lanceInterval(previous), statistics.lanceInterval(next),'초')}`;
    if (id === 'rift') return `${fmt('칼날 사거리',oldLv ? statistics.riftLength(previous) : 0,statistics.riftLength(next))} · ${fmt('피해', oldLv ? statistics.weaponDamage('rift',{...previous,rift:oldLv}) : 0, statistics.weaponDamage('rift',{...next,rift:newLv}))}`;
    if (id === 'beacon') return `${fmt('포탑 피해',oldLv?statistics.weaponDamage('beacon',{...previous,beacon:oldLv}):0,statistics.weaponDamage('beacon',{...next,beacon:newLv}))} · 지속 11초`;
    if (id === 'mine') return `${fmt('기뢰 폭발 반경', oldLv ? statistics.mineRadius(previous) : 0, statistics.mineRadius(next))} · ${fmt('설치 간격', statistics.mineInterval(previous),statistics.mineInterval(next),'초')}`;
    if (id === 'frost') return fmt('적 이동속도 감소', oldLv*12, newLv*12, '%');
    if (id === 'focus') return fmt('PULSE 치명타 배율', previous.critMult, next.critMult, '배');
    if (id === 'salvage') return fmt('수집 EXP 배율',xpCollectionScale(sessionState.profile,before,hasRelic('harvest',before)),xpCollectionScale(sessionState.profile,after,hasRelic('harvest',after)),'배');
    if (id === 'armor') return fmt('장갑 피해 감소', (1-armorScale(sessionState.profile,before))*100, (1-armorScale(sessionState.profile,after))*100, '%');
    if (id === 'conduction') return `${fmt('CHAIN 연쇄 거리',chainReach({conduction:oldLv}),chainReach({conduction:newLv}))} · ${fmt('재사용 주기 배율',1-oldLv*.055,1-newLv*.055,'배')}`;
    if (id === 'wavecraft') return `${fmt('NOVA 반경 보정',100+oldLv*6.5,100+newLv*6.5,'%')} · ${fmt('LANCE 충돌 반경',lanceRadius({wavecraft:oldLv}),lanceRadius({wavecraft:newLv}))} · 전문화 RIFT 절개 폭에도 적용`;
    if (id === 'machinery') return fmt('장치 공격·설치 주기 배율',1-oldLv*.09,1-newLv*.09,'배');
    if (id === 'edgecraft') return `${fmt('ORBIT 접촉 피해',100+oldLv*10,100+newLv*10,'%')} · ${fmt('RIFT 사거리',100+oldLv*6.5,100+newLv*6.5,'%')}`;
    if (id === 'repulsion' && hasBranch('nova','reflux',sessionState.run) && !previous.orbit) return '역류 공명에는 넉백 보정이 적용되지 않습니다.';
    if (id === 'repulsion') return `${fmt('NOVA 넉백',statistics.novaPush(previous),statistics.novaPush(next))} · ${fmt('ORBIT 넉백',orbitPush({repulsion:oldLv}),orbitPush({repulsion:newLv}))}`;
    if (id === 'placement') return `${fmt('MINE 배치 거리',oldLv?50+oldLv*20:0,50+newLv*20)} · ${fmt('BEACON 사거리',(beaconRange({placement:oldLv})),(beaconRange({placement:newLv})))}`;
    return '';
  }

  return { fusionInvestment, branchLabel, specialWeaponRow, fusionGuideState, guideRequirements, fusionMetric, fusionSuccessors, specializationPaths, upgradeDescription, fusionUpgradeChange, upgradeMetric };
}
