import { enemyInfo, eliteTraits } from '../data/enemies.js';
import { phases } from '../data/progression.js';
import { timeText } from '../core/utils.js';

export function createEnemyGuide({ platform }) {
  const { $ } = platform;

  function renderEnemyGuide(){
    const rows=enemyInfo.map(([icon,name,text],id)=>{const t=eliteTraits[id];return {id,icon,name,text:text+(t?`<br><b>강화 · ${t.name}</b> — ${t.text} 신규 생성: 기본 HP ×${t.hp} · 이동 ×${t.speed}.`:'' )};});
    $('enemyGuide').innerHTML=rows.map(x=>`<span data-enemy-kind="${x.id}"><i class="enemy-icon ${x.icon}" aria-hidden="true"></i>${x.name}</span>`).join('')+'<span>◇ 강화 개체</span>';
    $('enemyReference').innerHTML='<summary>적 유형 · 판정 자세히 보기</summary>'+rows.map(x=>`<div><strong>${x.name}</strong><p>${x.text}</p></div>`).join('')+'<p>강화 개체: 접촉 피해 ×1.15, 탄환 피해 ×1.1, 넉백 거리 ×0.8, 골드·보석 EXP ×3. 강화 특수 행동 입장은 20분 전 2개, 20분부터 3개, 26분부터 4개이며 감시자 공격 중에는 1개입니다. 일반 예고와 공유하는 전체 입장은 10분 전 3개, 10분부터 4개, 20분부터 5개, 26분부터 6개이며 감시자 공격 중에는 2개입니다. 공격 예고 시간과 기존 탄환·지면 공격의 개수 제한은 유지합니다.</p><p><strong>시간별 신규 적 기본값</strong> · 단계 사이에는 선형 보간합니다. '+phases.map(p=>timeText(p.at)+' HP ×'+p.hp+' / 생성 '+p.interval.toFixed(2)+'초 / 추가 생성 '+Math.round(p.extra*100)+'% / 이동 ×'+p.speed+' / 강화 '+Math.round(p.elite*100)+'%').join(' · ')+' · 개체 상한 165. 전술형 HP 최대 +35%p·강화 HP 최대 +20%p, 첫 행동 대기 단축은 유지합니다. 10~28분에 전술형 가중치는 최대 ×1.7, 새 탄환 속도는 최대 ×1.22가 됩니다. 16분부터 60초, 23분부터 45초 간격으로 이동 방향 앞에 교차 편대가 진입합니다. 개체 여유가 있을 때만 생성하며 화면 밖 배치·전술형 수 제한·기존 공격 예고를 지킵니다.</p><p><strong>전장 보정</strong> · 10분부터 최근 전투 흐름을 24초 척도로 반영합니다. 시간별 기본 난이도 아래로 낮추지 않습니다. 추가 보정 한도: 생성 +10%, 신규 HP ×1.08, 전술형·강화 HP 추가 ×1.1, 강화 확률 +2%p, 전술형 가중치 ×1.1, 새 탄환 속도 ×1.04. 유동 증원으로 생성한 적은 보석 EXP에 1÷동적 생성 배율(최소 ×0.9091)을 고정 적용합니다. 기존 적 HP·기존 탄환·이미 생성한 보석은 바꾸지 않습니다. 융합 소유 여부가 적 능력치를 직접 올리지는 않습니다.</p><p><strong>성장</strong> · 레벨 1의 필요 EXP는 기존 식의 78%에서 시작해 레벨 24에 기존 식으로 연결됩니다. 성장 카드가 남은 연결 경로가 있으면 해당 재료 카드를 매 선택에 한 자리 제시합니다. 전문화·재료 소비에 의해 막힌 경로는 제외합니다. 상위융합이 없으면 가능한 상위 경로를 우선 공급합니다. 선택과 제작은 자동 진행하지 않습니다.</p><p><strong>최종 전투</strong> · 중심핵 HP 기본 85,000. 단일 대상 화력 추정 1,400을 넘는 구간만 로그 보정하며 최대 144,500입니다. 연결점은 기본 1,500, 최대 4,000이며 감시자 운명·현장 결과의 연결점 보정을 별도로 적용합니다. 전투 시작 후 내구도는 고정됩니다. 연결점 생존 중 본체 HP 하한 90%, 최종 선택은 HP 10%에서 열립니다. 탄환은 방어 위성으로 요격할 수 있으나 접촉·돌진·지면 공격은 요격할 수 없습니다.</p>';
  }

  return { renderEnemyGuide };
}
