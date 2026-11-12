// npm run bench:skills → SKILL-BALANCE.json
// 모든 스킬을 같은 조건에서 실제 게임 코드로 실행해 초당 피해(DPS)를 비교한다.
// 조건: 시드 42, 패시브 없음, HP 1e6 표적, 10초. 단일 고정 · 무리 30 고정 · 다가오는 무리 40(쇄도) 세 배치.
// 기본 무기는 Lv5, 전문화는 원본 Lv5 + 전문화, 융합·상위융합은 Lv4(도달 가능한 최대치)로 비교한다.
// 모의 DOM/Canvas이며 이동하는 적 · 패시브 투자 · 실제 플레이 체감은 반영하지 않는다.
import { writeFileSync } from "node:fs";
import { createMockBrowser } from "../tests/mock-browser.js";
import { createDebugGame } from "../src/debug/create-debug-game.js";
import { branches } from "../src/data/specializations.js";
import { fusionRecipes } from "../src/data/fusions.js";
import { VERSION } from "../src/core/config.js";

const SECONDS = 10;
const FRAMES = SECONDS * 60;

export const SKILLS = [
  ...branches.map(b => ({ id: b.id, tier: "base", level: 5 })),
  ...branches.flatMap(b => b.options.map(o => ({ id: `spec:${b.id}:${o.id}`, tier: "spec", level: 5 }))),
  ...fusionRecipes.map(f => ({ id: `fusion:${f.id}`, tier: f.base ? "higher" : "fusion", level: 4, code: f.code })),
];

// 고정 표적 거리: 기뢰는 발밑(20), 위성은 궤도(50), 나머지는 대부분의 사거리 안(120).
const distanceFor = id => (/mine/.test(id) ? 20 : /^(orbit|spec:orbit)/.test(id) ? 50 : 120);

// single: 고정 표적 1 · crowd: 고정 표적 30 · swarm: 260 거리에서 다가오는 적 40(적 AI 켬, 플레이어 무적)
export const SCENARIOS = {
  single: { count: 1, ai: false },
  crowd: { count: 30, ai: false },
  swarm: { count: 40, ai: true, distance: 260 },
};

export function measure(skill, scenario) {
  const { count, ai, distance } = SCENARIOS[scenario];
  const env = createMockBrowser({ observers: true }),
    descriptors = new Map();
  for (const [key, value] of Object.entries(env)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  let app;
  try {
    app = createDebugGame({ mountPanel: false, settings: { enemyAI: ai } });
    const t = app.tools;
    t.giveSkill(skill.id, skill.level, { isolate: true });
    t.spawn(0, count, { distance: distance ?? distanceFor(skill.id), hp: 1e6 });
    t.hold(false);
    for (let i = 1; i <= FRAMES; i++) env.__inspect.flushFrame(1000 + (i * 1000) / 60);
    const run = JSON.parse(t.snapshot()).run;
    const damage = run.enemies.reduce((sum, e) => sum + (1e6 - e.hp), 0);
    return Math.round(damage / SECONDS);
  } finally {
    app?.dispose();
    for (const [key, value] of descriptors)
      if (value) Object.defineProperty(globalThis, key, value);
      else delete globalThis[key];
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = SKILLS.map(skill => ({
    ...skill,
    single: measure(skill, "single"),
    crowd: measure(skill, "crowd"),
    swarm: measure(skill, "swarm"),
  }));
  for (const tier of ["base", "spec", "fusion", "higher"]) {
    const list = rows.filter(r => r.tier === tier),
      median = key => [...list].sort((a, b) => a[key] - b[key])[Math.floor(list.length / 2)][key];
    const ms = median("single"),
      mc = median("crowd"),
      mw = median("swarm");
    console.log(`\n== ${tier} (중앙값 단일 ${ms} / 무리 ${mc} / 쇄도 ${mw})`);
    for (const r of list.sort((a, b) => b.swarm - a.swarm))
      console.log(
        `${(r.code ? r.code + " " : "") + r.id}`.padEnd(46),
        `단일 ${String(r.single).padStart(5)} (${(r.single / ms).toFixed(2)})`,
        `무리 ${String(r.crowd).padStart(5)} (${(r.crowd / mc).toFixed(2)})`,
        `쇄도 ${String(r.swarm).padStart(5)} (${(r.swarm / mw).toFixed(2)})`
      );
  }
  const result = {
    version: VERSION,
    note: `Seed 42, isolated skill, no passives, fixed targets (HP 1e6) at distance 120 (mines 20, orbit 50) for single/crowd; swarm = 40 approaching from 260 with enemy AI. ${SECONDS}s. DPS = total damage / seconds. Mock canvas only.`,
    rows,
  };
  writeFileSync(new URL("../SKILL-BALANCE.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
}
