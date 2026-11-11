// 서사 경로 판정 (NARRATIVE-REDESIGN.md 3·4절). 판 상태만 읽는 순수 함수다.
// 축은 따로 저장하지 않고 이미 저장되는 선택 기록(신호·기록원·탐사·감시자)에서 매번 계산한다.
// 그래서 이전 버전 저장을 불러와도 별도 변환이 필요 없다.
import { sites } from '../data/world.js';

// 기억 축 범위: 신호 3 + 기록원 1 + 탐사 지점 3 + 화부 1 = ±8(v3.2 검수: 화부를 더한 뒤 ±7을 넘을 수 있었다).
export const ROUTE = Object.freeze({ preserveAt: 3, consumeAt: -3, releaseSpared: 2, hollowEnded: 3, memoryRange: 8 });

// 결말 변주와 그 이름. 빈 껍질은 식지 않는 엔진, 합창은 두 개의 목소리에만 붙는다.
export const VARIANTS = Object.freeze({ hollow: { ending: 'consume', name: '빈 껍질' }, chorus: { ending: 'divided', name: '합창' } });

export function routeAxes(r) {
  let memory = 0;
  for (const choice of r?.signalChoices || []) memory += choice === 'hear' ? 1 : choice === 'burn' ? -1 : 0;
  if (r?.npc?.state === 'heard') memory++;
  else if (r?.npc?.state === 'taken') memory--;
  if (r?.stoker?.state === 'stoked') memory--;
  else if (r?.stoker?.state === 'quenched') memory++;
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
// 두 개의 목소리의 합창: 기록원을 들어 주고 화부와도 무언가를 정한 판.
export function endingVariant(id, r) {
  if (id === 'divided' && r?.npc?.state === 'heard' && ['stoked', 'quenched'].includes(r?.stoker?.state)) return 'chorus';
  return id === 'consume' && routeAxes(r).ended >= ROUTE.hollowEnded && r?.npc?.state === 'taken' ? 'hollow' : '';
}
