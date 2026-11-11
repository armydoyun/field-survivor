// npm run audit:focus — 감시자 조준(T)이 모든 기본 무기 · 전문화 · 융합에 적용되는지 확인한다.
// 플레이어 곁(70)에 일반 적, 멀리(240)에 감시자를 세우고, 조준을 끈 판과 켠 판에서 감시자가 받은 피해를 비교한다.
import { writeFileSync } from "node:fs";
import { createMockBrowser } from "../tests/mock-browser.js";
import { createGame } from "../src/app/create-game.js";
import { initialProfile } from "../src/core/profile.js";
import { branches } from "../src/data/specializations.js";
import { fusionRecipes } from "../src/data/fusions.js";

// 표적을 고르지 않는 범위형(플레이어 주변 · 접촉 · 감지 장판): 조준 대상이 아니다.
export const AREA = new Set([
  "base:nova",
  "base:orbit",
  "base:mine",
  "spec:orbit:escort",
  "spec:orbit:eccentric",
  "spec:nova:boundary",
  "spec:nova:reflux",
  "spec:mine:pressure",
  "fusion:fs_pulse_typhoon",
  "fusion:hs_storm_pulse_typhoon",
]);

const BASE = ["pulse", "nova", "chain", "lance", "mine", "rift", "beacon", "orbit"];
export const FOCUS_LOADOUTS = [
  ...BASE.map(w => ({ name: "base:" + w, weapon: w })),
  ...branches.flatMap(b => b.options.map(o => ({ name: `spec:${b.id}:${o.id}`, weapon: b.id, option: o.id }))),
  ...fusionRecipes.map(f => ({ name: "fusion:" + f.id, fusion: f })),
];

function withBrowser(callback) {
  const env = createMockBrowser({ observers: true }),
    saved = new Map();
  env.location = { search: "?seed=42" };
  for (const [key, value] of Object.entries(env)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  try {
    return callback(env);
  } finally {
    for (const [key, d] of saved)
      if (d) Object.defineProperty(globalThis, key, d);
      else delete globalThis[key];
  }
}

const dummy = (r, extra) => ({
  id: r.nextId++,
  kind: 0,
  hp: 1e8,
  maxHp: 1e8,
  speed: 0,
  radius: 11,
  orbitHitAt: 0,
  phase: 0,
  aiTimer: 1e9,
  dx: 0,
  dy: 0,
  flash: 0,
  elite: false,
  xpScale: 1,
  ...extra,
});

export function guardianDamage(loadout, focus, frames = 480) {
  return withBrowser(env => {
    const s = {
      profile: initialProfile(),
      run: null,
      replaceRun(r) {
        s.run = r;
      },
      resetState() {
        s.profile = initialProfile();
        s.run = null;
      },
    };
    createGame(s, { seedSource: () => 42 });
    const button = { dataset: { action: "new" }, closest: q => (q === "[data-action]" ? button : null) };
    env.document.getElementById("overlay").dispatch("click", { target: button });
    const r = s.run,
      p = r.player;
    r.spawnClock = 1e9;
    r.ambientClock = 1e9;
    r.invulnUntil = 1e9;
    r.nextBoss = 1e9;
    const grunt = dummy(r, { x: p.x + 70, y: p.y + 10 }),
      guardian = dummy(r, { kind: 3, named: true, radius: 26, x: p.x - 240, y: p.y - 20, guardianAttack: null });
    r.enemies = [grunt, guardian];
    if (loadout.fusion) {
      const f = loadout.fusion;
      for (const [id, branch] of f.needs) {
        r.up[id] = 5;
        r.branches[id] = branch;
      }
      if (f.base) r.up["fusion_" + f.base] = 4;
      r.up["fusion_" + f.id] = 1;
    } else {
      r.up[loadout.weapon] = loadout.option ? 4 : 2;
      if (loadout.option) r.branches[loadout.weapon] = loadout.option;
    } // 전문화 없는 기본 무기는 Lv3 전문화 선택 창이 뜨지 않게 Lv2.
    if (loadout.weapon && loadout.weapon !== "pulse") r.startWeapon = loadout.weapon;
    if (focus) r.focusGuardian = true;
    for (let i = 1; i <= frames; i++) {
      env.__inspect.flushFrame(1000 + i * 16);
      guardian.x = p.x - 240;
      guardian.y = p.y - 20;
      guardian.phase = 0;
      guardian.aiTimer = 1e9;
      guardian.guardianAttack = null;
      guardian.hp = Math.max(guardian.hp, 1);
      grunt.x = p.x + 70;
      grunt.y = p.y + 10;
      grunt.hp = Math.max(grunt.hp, 1);
    }
    return { guardian: 1e8 - guardian.hp, grunt: 1e8 - grunt.hp };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = [];
  for (const l of FOCUS_LOADOUTS) {
    const off = guardianDamage(l, false),
      on = guardianDamage(l, true);
    const area = AREA.has(l.name),
      row = {
        name: l.name,
        off: Math.round(off.guardian),
        on: Math.round(on.guardian),
        area,
        ok: area || on.guardian > off.guardian,
      };
    rows.push(row);
    console.log(
      `${row.ok ? (area ? "범위" : "  OK") : "실패"} ${row.name.padEnd(42)} 감시자 피해 꺼짐 ${String(row.off).padStart(7)} → 켜짐 ${String(row.on).padStart(7)}`
    );
  }
  const failed = rows.filter(r => !r.ok);
  console.log(
    `조준 대상 ${rows.filter(r => !r.area).length}개 중 실패 ${failed.length}개 · 범위형 ${rows.filter(r => r.area).length}개 제외`
  );
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(rows, null, 2) + "\n");
  if (failed.length) process.exitCode = 1;
}
