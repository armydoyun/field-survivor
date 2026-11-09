const shopItems = [
  { id: 'power', name: '기본 공격력', desc: '모든 무기에 쓰이는 기본 공격력 +2', base: 40, growth: 1.58, max: 15, value: lv => `${14+lv*2} 공격력` },
  { id: 'health', name: '최대 체력', desc: '기본 최대 HP +15', base: 45, growth: 1.55, max: 15, value: lv => `${100+lv*15} HP` },
  { id: 'speed', name: '이동 속도', desc: '기본 이동 속도 +10', base: 55, growth: 1.50, max: 10, value: lv => `${190+lv*10} 속도` },
  { id: 'luck', name: '치명타 확률', desc: 'PULSE 치명타 확률 +2%p · 다른 무기 미적용', base: 55, growth: 1.42, max: 10, value: lv => `+${lv*2}%p` },
  { id: 'regen', name: '영구 체력 재생', desc: '초당 HP +0.1 · 피격 후 3초간 반복 회복 25%', base: 60, growth: 1.42, max: 10, value: lv => `+${(lv*.1).toFixed(2)} HP/s` },
  { id: 'magnet', name: '회수 장비', desc: '보석 흡수 반경 +12', base: 60, growth: 1.50, max: 5, value: lv => `+${lv*12} 반경` },
  { id: 'learning', name: '전투 분석', desc: '획득 경험치 +4%p · 소수 보너스 누적', base: 100, growth: 1.55, max: 5, value: lv => `+${lv*4}% EXP` },
  { id: 'armor', name: '기본 장갑', desc: '받는 피해 -1.5%p · 전투 장갑과 별도 곱연산', base: 75, growth: 1.50, max: 5, value: lv => `-${Number((lv*1.5).toFixed(1))}% 피해` },
  { id: 'reroll', name: '전술 재설계', desc: '새 도전마다 레벨업 선택지 새로고침 +1회', base: 180, growth: 1.80, max: 3, value: lv => `${lv}회 / 새 도전` }
];

export { shopItems };
