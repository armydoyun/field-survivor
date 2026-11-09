// 서사 경로 판정 (NARRATIVE-REDESIGN.md 3·4절). 판 상태만 읽는 순수 함수다.
// 축은 따로 저장하지 않고 이미 저장되는 선택 기록(신호·기록원·탐사·감시자)에서 매번 계산한다.
// 그래서 이전 버전 저장을 불러와도 별도 변환이 필요 없다.
import { sites } from '../data/world.js';

export const ROUTE = Object.freeze({ preserveAt: 3, consumeAt: -3, releaseSpared: 2, hollowEnded: 3 });

export function routeAxes(r) {
  let memory = 0;
  for (const choice of r?.signalChoices || []) memory += choice === 'hear' ? 1 : choice === 'burn' ? -1 : 0;
  if (r?.npc?.state === 'heard') memory++;
  else if (r?.npc?.state === 'taken') memory--;
  for (const site of sites) {
    const decision = r?.siteDecisions?.[site.id];
    memory += decision === 'keep' ? 1 : decision === 'take' ? -1 : 0;
  }
  // 응답하지 않고 지나친 탐사 지점. 축은 움직이지 않지만 결말 장면에서 언급한다.
  const silence = sites.filter(site => (r?.time || 0) >= site.at && !r?.siteDecisions?.[site.id]).length;
  return {
    memory,
    silence,
    spared: r?.guardianFate?.spare || 0,
    ended: r?.guardianFate?.end || 0,
    stillness: !!r?.npc?.silenced,
  };
}

// 열린 문(해방)은 경로 조건을 모두 채운 판에서, 마지막 선택 화면에서 멈춰 있을 때만 열린다.
export function releaseOpen(r) {
  const a = routeAxes(r);
  return a.ended === 0 && a.spared >= ROUTE.releaseSpared && a.stillness && a.memory >= 0;
}

// 마지막 선택 화면에서 확정 버튼이 가리키는 결말.
export function routeEnding(r) {
  const { memory } = routeAxes(r);
  return memory >= ROUTE.preserveAt ? 'preserve' : memory <= ROUTE.consumeAt ? 'consume' : 'divided';
}

// 식지 않는 엔진의 극단: 감시자를 거듭 분해하고 기록원까지 추출한 판.
export function endingVariant(id, r) {
  return id === 'consume' && routeAxes(r).ended >= ROUTE.hollowEnded && r?.npc?.state === 'taken' ? 'hollow' : '';
}
