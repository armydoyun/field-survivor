// 스킬 밸런스 배율표. 공격 동작은 그대로 두고 그 스킬이 주는 피해에만 곱한다.
// 기준과 측정: tools/skill-benchmark.mjs (npm run bench:skills → SKILL-BALANCE.json), SKILL-BALANCE.md.
// 값이 없으면 1. 기본 무기 배율은 전문화하지 않은 상태에만, 전문화 배율은 그 전문화를 고른 무기에만 적용된다.
export const skillBalance = Object.freeze({
  base: Object.freeze({
    "beacon": 1.22,
    "chain": 1.94,
    "lance": 1.05,
    "mine": 0.7,
    "nova": 0.86,
    "rift": 0.59,
  }),
  spec: Object.freeze({
    "beacon:relay": 0.95,
    "beacon:rover": 2.24,
    "chain:circuit": 1.74,
    "chain:return": 3.0,
    "lance:return": 2.03,
    "lance:stake": 1.05,
    "mine:leap": 1.17,
    "mine:pressure": 1.4,
    "nova:boundary": 1.28,
    "orbit:eccentric": 3.0,
    "orbit:escort": 0.83,
    "pulse:reservoir": 2.23,
    "pulse:tracking": 1.71,
    "rift:fold": 0.67,
    "rift:trail": 0.73,
  }),
  fusion: Object.freeze({
    "fs_bullet_barrier": 1.22,
    "fs_conductive_guard": 2.81,
    "fs_distributed_cuts": 1.3,
    "fs_instant_slash": 0.49,
    "fs_leaping_lances": 1.17,
    "fs_mobile_mines": 0.82,
    "fs_mobile_transmission": 2.08,
    "fs_reflux_lightning": 1.77,
    "fs_rotating_cutters": 2.07,
    "fs_shock_mines": 0.83,
    "fs_support_guns": 1.69,
    "fs_surging_strata": 2.16,
    "hs_barrage_bullet_barrier": 1.09,
    "hs_barrage_rapid_pulse": 0.88,
    "hs_barrage_support_guns": 1.29,
    "hs_crusher_conductive_guard": 1.58,
    "hs_crusher_distributed_cuts": 1.2,
    "hs_crusher_rotating_cutters": 1.49,
    "hs_frontline_surging_strata": 2.1,
    "hs_storm_reflux_lightning": 1.44,
    "hs_thunder_slash_instant_slash": 0.54,
  }),
});

export const baseBalance = (type, r) => {
  const branch = r?.branches?.[type];
  return (branch ? skillBalance.spec[`${type}:${branch}`] : skillBalance.base[type]) ?? 1;
};
export const fusionBalance = id => skillBalance.fusion[id] ?? 1;
