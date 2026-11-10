// 시작 무기(NEXT-UPDATE-PLAN.md 4절). 펄스는 항상, 나머지는 결말 · 비밀 · 누적 기록으로 연다.
// 해금은 이미 저장되는 프로필 기록에서 계산하므로 새 저장 필드가 없다.
export const loadouts = Object.freeze([
  { id: 'pulse', unlock: '처음부터', open: () => true },
  { id: 'nova', unlock: "'남겨진 목소리' 결말", open: m => m.endings.preserve > 0 },
  { id: 'rift', unlock: "'식지 않는 엔진' 결말", open: m => m.endings.consume > 0 },
  { id: 'chain', unlock: "'두 개의 목소리' 결말", open: m => m.endings.divided > 0 },
  { id: 'orbit', unlock: "'열린 문' 결말", open: m => m.endings.release > 0 },
  { id: 'beacon', unlock: '기록원 곁에서 멈춰 있기', open: m => m.witness.quiet === true },
  { id: 'lance', unlock: '감시자를 모두 합쳐 3번 돌려보내기', open: m => m.guardian.spared >= 3 },
  { id: 'mine', unlock: '모두 합쳐 3번 쓰러지기', open: m => (m.deaths || 0) >= 3 },
]);
// 펄스가 아닌 시작 무기는 Lv1이면 첫 2분 처치가 펄스의 1/10 수준이다(균열 10 대 105, AUTOPLAY 측정).
// 시작 레벨로 초반을 맞춘다. 9분 처치 · 레벨이 펄스(처치 925 · Lv15)의 ±25% 안에 들도록 무기별로 둔다.
// 연쇄 · 창은 Lv2에서 처치가 30% 넘게 적어 Lv3. 위성은 Lv1이어도 Lv21이지만 받은 피해가 펄스의 3배라 그대로 둔다.
export const START_WEAPON_LEVELS = Object.freeze({ chain: 3, lance: 3 });
export const startWeaponLevel = id => START_WEAPON_LEVELS[id] ?? 2;

export const unlockedLoadouts = memory => loadouts.filter(l => l.open(memory)).map(l => l.id);
