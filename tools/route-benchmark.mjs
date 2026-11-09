// npm run bench:route → ROUTE-VALIDATION.json
// 서사 경로가 중심핵 전투(결말 전투)를 얼마나 바꾸는지 실제 게임 코드로 모의 실행해 비교한다(NARRATIVE-REDESIGN.md 8절).
// 같은 빌드 · 같은 시드에서 경로 필드만 바꾸고, 플레이어는 움직이지 않는다. 자연 생성 적은 끈다.
// 받은 피해는 매 프레임 HP 감소분을 더하고 HP를 다시 채워 측정한다(쓰러지지 않음). 모의 DOM/Canvas이며 실제 플레이 난이도 증거가 아니다.
import { writeFileSync } from "node:fs";
import { createMockBrowser } from "../tests/mock-browser.js";
import { createDebugGame } from "../src/debug/create-debug-game.js";

const LIMIT = 600; // 게임 시간(초)
const TIME_SCALE = 4;
const FRAME_MS = 1000 / 60;

const memoryRoute = sign => ({
  signalChoices: Array(3).fill(sign > 0 ? "hear" : "burn"),
  signalStep: 3,
  siteDecisions: {
    coordinate: sign > 0 ? "keep" : "take",
    reservoir: sign > 0 ? "keep" : "take",
    archive: sign > 0 ? "keep" : "take",
  },
});
const npc = (state, silenced = false) => ({
  spawned: true,
  state,
  x: 0,
  y: 0,
  still: 0,
  encounterPending: false,
  secretPending: false,
  silenced,
});
export const ROUTES = [
  { id: "neutral", label: "중립(선택 없음)", fields: {} },
  {
    id: "mercy-preserve",
    label: "자비 3 · 기억 +7",
    fields: { ...memoryRoute(1), npc: npc("heard", true), guardianFate: { spare: 3, end: 0 } },
  },
  {
    id: "mercy-consume",
    label: "자비 3 · 기억 -7",
    fields: { ...memoryRoute(-1), npc: npc("taken"), guardianFate: { spare: 3, end: 0 } },
  },
  {
    id: "ruthless-preserve",
    label: "분해 3 · 기억 +7",
    fields: { ...memoryRoute(1), npc: npc("heard"), guardianFate: { spare: 0, end: 3 } },
  },
  {
    id: "ruthless-consume",
    label: "분해 3 · 기억 -7",
    fields: { ...memoryRoute(-1), npc: npc("taken"), guardianFate: { spare: 0, end: 3 } },
  },
];
export const BUILDS = [
  { id: "pulse", label: "PULSE Lv4 단독", skills: [["pulse", 4]] },
  { id: "fusion", label: "기본 융합 Lv4(초고속 연사포)", skills: [["fusion:fs_rapid_pulse", 4]] },
  {
    id: "higher",
    label: "상위융합 Lv4(연사 계열) + 공격력 Lv5",
    skills: [
      ["fusion:hs_barrage_rapid_pulse", 4],
      ["power", 5],
    ],
  },
];

export function simulate(build, route, limit = LIMIT) {
  const env = createMockBrowser({ observers: true }),
    descriptors = new Map();
  for (const [key, value] of Object.entries(env)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  let app;
  try {
    app = createDebugGame({ mountPanel: false, settings: { godMode: false, timeScale: TIME_SCALE } });
    const t = app.tools;
    build.skills.forEach(([id, level], i) => t.giveSkill(id, level, { isolate: i === 0 }));
    const data = JSON.parse(t.snapshot());
    Object.assign(data.run, { time: 1800 }, structuredClone(route.fields));
    t.loadSnapshot(JSON.stringify(data));
    t.spawnCore();
    t.hold(false);
    const start = JSON.parse(t.snapshot()).run,
      core = start.enemies.find(e => e.final);
    const result = {
      build: build.id,
      route: route.id,
      coreHp: core.maxHp,
      nodes: start.enemies.filter(e => e.coreNode).length,
      nodeHp: start.enemies.find(e => e.coreNode)?.maxHp || 0,
      shields: start.journey.core?.shields || 0,
      nodesClearedAt: null,
      thresholdAt: null,
      damageTaken: 0,
      shieldsUsed: 0,
    };
    let frame = 0,
      hp = t.report().hp;
    while (true) {
      env.__inspect.flushFrame(1000 + ++frame * FRAME_MS);
      const report = t.report(),
        elapsed = report.time - 1800;
      if (report.hp < hp) result.damageTaken += hp - report.hp;
      if (report.hp < report.maxHp) t.setHp(report.maxHp);
      hp = t.report().hp;
      if (frame % 15 === 0 || report.mode === "finalchoice") {
        const run = JSON.parse(t.snapshot()).run;
        if (result.nodesClearedAt == null && run.journey.core?.phase === 1) result.nodesClearedAt = +elapsed.toFixed(1);
        result.shieldsUsed = result.shields - (run.journey.core?.shields || 0);
        if (report.mode === "finalchoice" || run.finalStep === 3) {
          result.thresholdAt = +elapsed.toFixed(1);
          break;
        }
      }
      if (elapsed >= limit) break;
    }
    result.damageTaken = Math.round(result.damageTaken);
    return result;
  } finally {
    app?.dispose();
    for (const [key, value] of descriptors)
      if (value) Object.defineProperty(globalThis, key, value);
      else delete globalThis[key];
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = [];
  for (const build of BUILDS)
    for (const route of ROUTES) {
      const row = simulate(build, route);
      rows.push(row);
      console.log(
        `${build.id.padEnd(7)} ${route.id.padEnd(18)} 중심핵 HP ${String(row.coreHp).padStart(6)} · 연결점 ${row.nodes} · 방패 ${row.shieldsUsed}/${row.shields} · 연결점 해제 ${row.nodesClearedAt ?? "-"}s · 결말 ${row.thresholdAt ?? `>${LIMIT}`}s · 받은 피해 ${row.damageTaken}`
      );
    }
  const result = {
    version: "2.6.27",
    note: `Seed 42, fixed build, player stationary, no natural spawns, core fight from 30:00, up to ${LIMIT}s game time. Damage is refilled each frame and summed. Mock canvas only; not browser FPS or general balance evidence.`,
    routes: ROUTES.map(({ id, label }) => ({ id, label })),
    builds: BUILDS.map(({ id, label }) => ({ id, label })),
    rows,
  };
  writeFileSync(new URL("../ROUTE-VALIDATION.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
}
