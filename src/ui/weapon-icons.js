// 무기 아이콘: 16×16 선 그림 SVG. 글자색(currentColor)을 따라 무기 이름과 같은 색감이 된다.
// 한눈에 동작이 읽히도록 무기마다 한 가지 특징만 그린다.
//   펄스: 코어에서 나가는 탄 3발 · 위성: 궤도 위의 위성 2개 · 노바: 퍼지는 고리 · 연쇄: 두 표적 사이의 번개
//   창: 날아가는 창 · 기뢰: 가시 달린 구체 · 균열: 초승달 칼날 · 신호 포탑: 받침 위 포신과 신호 · 연쇄 폭발: 터지는 별
// 선 속성. 굵기를 바꿀 때도 stroke-width가 한 번만 들어가야 한다(이미지로 쓸 때 XML은 중복 속성을 거부한다).
const line = (width = 1.6) => `fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
const S = line();
const F = 'fill="currentColor" stroke="none"';

export const weaponSvgPaths = Object.freeze({
  pulse: `<circle cx="4.5" cy="8" r="2.6" ${F}/><path d="M9 8h5M8.5 4.6l4.2-1.6M8.5 11.4l4.2 1.6" ${S}/>`,
  orbit: `<circle cx="8" cy="8" r="5.6" ${S} stroke-dasharray="2.2 2"/><circle cx="8" cy="8" r="1.6" ${F}/><circle cx="12" cy="4" r="1.9" ${F}/><circle cx="4" cy="12" r="1.9" ${F}/>`,
  nova: `<circle cx="8" cy="8" r="1.7" ${F}/><circle cx="8" cy="8" r="4.3" ${S}/><path d="M2.2 6.2a6.2 6.2 0 0 1 4-4M9.8 1.9a6.2 6.2 0 0 1 4.3 4.3M13.9 9.8a6.2 6.2 0 0 1-4.1 4.3M6.2 14a6.2 6.2 0 0 1-4.2-4.2" ${S}/>`,
  chain: `<path d="M9.6 1.2 4.4 8.6h3.3l-1.3 6.2 5.2-7.6H8.3z" ${F}/><circle cx="2.4" cy="3.6" r="1.5" ${F}/><circle cx="13.6" cy="12.4" r="1.5" ${F}/>`,
  lance: `<path d="M2 14 11 5" ${S}/><path d="M14.5 1.5 8.4 3.6l4 4z" ${F}/><path d="M2.5 9.5c1-1 2-1 3 0M6.5 13.5c1-1 1-2 0-3" ${line(1.2)}/>`,
  mine: `<circle cx="8" cy="8" r="3.8" ${S}/><circle cx="8" cy="8" r="1.3" ${F}/><path d="M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M12.8 3.2l-1.4 1.4M4.6 11.4l-1.4 1.4" ${line(1.4)}/>`,
  rift: `<path d="M2.5 13.5C4 7.5 8 3.5 14 2.5 10.5 5 7.5 8.5 2.5 13.5z" ${F}/><path d="M2 9.5 4.5 7M6.5 14 9 11.5" ${line(1.2)}/>`,
  beacon: `<path d="M4 14.5h8l-1.6-3.3H5.6z" ${F}/><circle cx="8" cy="8.6" r="2.4" ${S}/><path d="m9.6 7 3.4-3.2M12.2 1.6a3.6 3.6 0 0 1 2.2 2.2" ${S}/>`,
  burst: `<path d="M8 1.2 9.4 5.6 13.6 3.4 11.2 7.4 15 8.8 10.6 9.8 12 14.3 8 11.4 4 14.3 5.4 9.8 1 8.8 4.8 7.4 2.4 3.4 6.6 5.6z" ${F}/>`
});

export function weaponSvg(id) {
  const paths = weaponSvgPaths[id];
  return paths ? `<svg class="weapon-icon" viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" focusable="false">${paths}</svg>` : '';
}
