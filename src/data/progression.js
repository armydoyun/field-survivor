const phases = [
  { at: 0, name: '생존과 발견', interval: 0.82, extra: 0, hp: 1, speed: 1, cap: 85, xp: 1, elite: 0 },
  { at: 300, name: '빌드의 방향', interval: 0.69, extra: 0.14, hp: 1.7, speed: 1.06, cap: 120, xp: 1, elite: 0 },
  { at: 600, name: '전술 확장', interval: 0.52, extra: 0.28, hp: 3.2, speed: 1.14, cap: 140, xp: 1.45, elite: 0.08 },
  { at: 960, name: '세계의 반응', interval: 0.32, extra: 0.48, hp: 7, speed: 1.26, cap: 155, xp: 1.85, elite: 0.23 },
  { at: 1380, name: '최종 시험', interval: 0.19, extra: 0.65, hp: 14, speed: 1.4, cap: 165, xp: 2.2, elite: 0.38 },
  { at: 1800, name: '최종 신호', interval: 0.14, extra: 0.75, hp: 24, speed: 1.55, cap: 165, xp: 2.6, elite: 0.48 }
];

const keystones=[
  {id:'anchor',name:'고정된 심장',desc:'PULSE·BEACON·MINE 피해 +20% · 이동 속도 -8%',weapons:['pulse','beacon','mine']},
  {id:'drift',name:'떠도는 날',desc:'LANCE·RIFT·ORBIT 피해: 이동 중 및 멈춘 뒤 1초까지 +20%, 그 외 -10%',weapons:['lance','rift','orbit']},
  {id:'surge',name:'넘치는 전하',desc:'CHAIN·NOVA 피해 +20% · 최대 HP -10%',weapons:['chain','nova']},
  {id:'control',name:'닫힌 회로',desc:'최대 HP +12% · 모든 무기 피해 -8%',weapons:[]}
];

export { phases, keystones };
