// 영구 강화(v3.2 재조정). 레벨당 효과는 PERK에 한 번만 적고, 계산 · 설명 · 상점이 같은 값을 쓴다.
// 가격: 첫 레벨은 5분 판 한 번(약 1,000G)으로 몇 개 살 수 있고, 전부 최대까지는 30분 완주 3 ~ 4판(약 116,000G).
// 효과 상한: 기본 공격력 +30%, 최대 HP +100, 이동 속도 +19% 등 — 판 안 성장(레벨업)을 넘지 않는 크기.
export const PERK = Object.freeze({ power: .03, health: 10, speed: 6, luck: .02, regen: .08, magnet: 12, learning: .04, armor: .015, reroll: 1 });

const shopItems = [
  { id: 'power', name: '기본 공격력', desc: '모든 무기 피해 +3%', base: 150, growth: 1.62, max: 10, value: lv => `+${Math.round(lv * PERK.power * 100)}% 피해` },
  { id: 'health', name: '최대 체력', desc: '기본 최대 HP +10', base: 120, growth: 1.62, max: 10, value: lv => `${100 + lv * PERK.health} HP` },
  { id: 'speed', name: '이동 속도', desc: '기본 이동 속도 +6', base: 200, growth: 1.75, max: 6, value: lv => `${190 + lv * PERK.speed} 속도` },
  { id: 'luck', name: '치명타 확률', desc: '펄스 코어 치명타 확률 +2%p · 다른 무기에는 적용되지 않음', base: 150, growth: 1.62, max: 8, value: lv => `+${Math.round(lv * PERK.luck * 100)}%p` },
  { id: 'regen', name: '영구 체력 재생', desc: '초당 HP +0.08 회복 · 맞은 뒤 3초 동안은 25%만 회복', base: 180, growth: 1.65, max: 8, value: lv => `+${(lv * PERK.regen).toFixed(2)} HP/s` },
  { id: 'magnet', name: '회수 장비', desc: '보석 흡수 반경 +12', base: 100, growth: 1.8, max: 5, value: lv => `+${lv * PERK.magnet} 반경` },
  { id: 'learning', name: '전투 분석', desc: '획득 경험치 +4%p', base: 300, growth: 1.9, max: 5, value: lv => `+${Math.round(lv * PERK.learning * 100)}% EXP` },
  { id: 'armor', name: '기본 장갑', desc: '받는 피해 -1.5%p · 레벨업의 충격 장갑과 따로 곱해짐', base: 250, growth: 1.8, max: 6, value: lv => `-${Number((lv * PERK.armor * 100).toFixed(1))}% 피해` },
  { id: 'reroll', name: '전술 재설계', desc: '새 도전마다 레벨업 선택지 새로고침 +1회', base: 800, growth: 2.6, max: 3, value: lv => `${lv}회 / 새 도전` }
];

// v3.1까지의 표(재조정 환급 계산용). 가격은 반올림 없이 base × growth^level이었다.
export const LEGACY_SHOP = Object.freeze({ power: [40, 1.58, 15], health: [45, 1.55, 15], speed: [55, 1.5, 10], luck: [55, 1.42, 10], regen: [60, 1.42, 10], magnet: [60, 1.5, 5], learning: [100, 1.55, 5], armor: [75, 1.5, 5], reroll: [180, 1.8, 3] });
export const PERK_VERSION = 2;

export { shopItems };
