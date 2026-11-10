// npm run bench:autoplay → AUTOPLAY-VALIDATION.json
// 봇이 실제 게임 코드로 한 판(최대 30분 + 중심핵 전투)을 처음부터 끝까지 플레이하고 분 단위 기록을 남긴다.
// 화면에 뜬 선택지는 오버레이 HTML의 data-action / data-choice를 읽어 사람처럼 누른다. 이동은 적 무리를 피해 원을 그린다.
// 목적: 후반 성장 속도 · 생존 난이도 · 중심핵 전투 길이를 같은 조건에서 비교한다. 모의 DOM/Canvas이며 실제 사람의 플레이가 아니다.
import { writeFileSync } from "node:fs";
import { createMockBrowser } from "../tests/mock-browser.js";
import { createDebugGame } from "../src/debug/create-debug-game.js";
import { paceAt } from "../src/core/difficulty.js";
import { startWeaponLevel } from "../src/data/loadouts.js";

// 근거리 시작 무기와 봇이 다가갈 거리(균열은 사거리 약 220 안).
const CLOSE_RANGE = new Map([
  ["nova", 85],
  ["orbit", 85],
  ["mine", 85],
  ["rift", 170],
]);
import { fusionRecipes } from "../src/data/fusions.js";

const FRAME_MS = 1000 / 60;
const LIMIT = 1800 + 300; // 30분 + 중심핵 전투 최대 5분

// 레벨업 우선순위: 무기를 Lv5까지 올려 전문화 · 융합으로 가고, 그다음 공통 화력 · 생존.
const WEAPONS = ["pulse", "nova", "rift", "chain", "orbit", "lance", "mine", "beacon"];
const PASSIVES = [
  "power",
  "haste",
  "multishot",
  "area",
  "vitality",
  "crit",
  "focus",
  "regen",
  "armor",
  "speed",
  "magnet",
  "pierce",
];

export const POLICIES = {
  preserve: { signal: "hear", witness: "witness-hear", site: "keep", guardian: "spare" },
  consume: { signal: "burn", witness: "witness-take", site: "take", guardian: "end" },
};

const actionsIn = html => [...html.matchAll(/data-(action|choice)="([^"]+)"/g)].map(m => ({ kind: m[1], id: m[2] }));

// 융합 계획: 가진 무기 · 전문화와 가장 잘 맞는 기본 융합을 고르고, 만든 뒤에는 그 기반의 상위융합 재료를 고른다.
// 재료 [무기, 전문화] 중 다른 전문화를 이미 골랐으면 불가능한 계획이다.
const feasible = (run, [w, b]) => !run.branches[w] || run.branches[w] === b;
export function fusionPlan(run) {
  const made = fusionRecipes.filter(f => (run.up["fusion_" + f.id] || 0) > 0);
  const base = made.find(f => !f.base);
  if (base) {
    const higher = fusionRecipes.filter(f => f.base === base.id && feasible(run, f.extra));
    const pick = higher.sort((a, b) => (run.up[b.extra[0]] || 0) - (run.up[a.extra[0]] || 0))[0];
    return { recipe: base, materials: pick ? [pick.extra] : [] };
  }
  let best = null,
    bestScore = -Infinity;
  for (const f of fusionRecipes.filter(f => !f.base)) {
    if (!f.needs.every(m => feasible(run, m))) continue;
    const score = f.needs.reduce(
      (sum, [w, b]) => sum + (run.branches[w] === b ? 3 : 0) + Math.min(5, run.up[w] || 0) * 0.5,
      0
    );
    if (score > bestScore) {
      best = f;
      bestScore = score;
    }
  }
  return best ? { recipe: best, materials: best.needs } : { recipe: null, materials: [] };
}

function chooseUpgrade(choices, up, maxWeapons, plan = null) {
  const owned = WEAPONS.filter(w => (up[w] || 0) > 0),
    wanted = new Set((plan?.materials || []).map(([w]) => w));
  const score = id => {
    if (id.startsWith("fusion_")) return 100;
    const w = WEAPONS.indexOf(id);
    if (w >= 0 && wanted.has(id) && (up[id] || 0) < 5) return 95 - (up[id] || 0);
    if (w >= 0) return (up[id] || 0) > 0 ? 80 - (up[id] || 0) : owned.length < maxWeapons ? 60 - w : 5;
    const p = PASSIVES.indexOf(id);
    return p >= 0 ? 40 - p : 10;
  };
  return [...choices].sort((a, b) => score(b) - score(a))[0];
}

// immortal: 받은 피해를 더한 뒤 HP를 다시 채운다(회피 실력과 무관하게 성장 · 난이도 곡선만 본다).
export function autoplay({
  seed = 42,
  policy = "preserve",
  maxWeapons = 4,
  limit = LIMIT,
  timeScale = 4,
  immortal = true,
  objectives = true,
  planner = true,
  startWeapon = "pulse",
  startLevel = null,
} = {}) {
  const env = createMockBrowser({ observers: true }),
    descriptors = new Map();
  for (const [key, value] of Object.entries(env)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const rules = POLICIES[policy];
  const overlay = env.document.getElementById("overlay");
  const click = (kind, id) => {
    const target = { dataset: kind === "choice" ? { choice: id } : { action: id } };
    target.closest = sel =>
      (sel === "[data-choice]" && kind === "choice") || (sel === "[data-action]" && kind === "action") ? target : null;
    overlay.dispatch("click", { target });
  };
  const held = new Set();
  const hold = codes => {
    for (const c of held)
      if (!codes.includes(c)) {
        env.dispatch("keyup", { code: c });
        held.delete(c);
      }
    for (const c of codes)
      if (!held.has(c)) {
        env.dispatch("keydown", { code: c });
        held.add(c);
      }
  };
  let app;
  try {
    app = createDebugGame({
      seed,
      mountPanel: false,
      settings: { autoSpawn: true, worldEvents: true, choices: true, godMode: false, timeScale },
    });
    const t = app.tools;
    // 시작 무기(새 게임의 시작 무기 선택과 같은 상태): 그 무기 시작 레벨(startWeaponLevel) + 펄스 휴면.
    if (startWeapon !== "pulse") {
      const data = JSON.parse(t.snapshot());
      data.run.startWeapon = startWeapon;
      data.run.up[startWeapon] = startLevel ?? startWeaponLevel(startWeapon);
      t.loadSnapshot(JSON.stringify(data));
    }
    t.hold(false);
    const timeline = [],
      decisions = {};
    let frame = 0,
      minute = 0,
      damage = 0,
      virtualDeaths = 0,
      pool = Infinity,
      lastTime = 0,
      lastHp = t.report().hp,
      run = JSON.parse(t.snapshot()).run,
      stuck = 0,
      lastMode = "";
    let finale = null,
      death = null;
    const tried = new Set(),
      trace = [];
    while (frame++ < 400000) {
      env.__inspect.flushFrame(1000 + frame * FRAME_MS);
      const report = t.report(),
        mode = report.mode;
      const lost = report.hp < lastHp ? lastHp - report.hp : 0;
      damage += lost;
      // 가상 HP 통: 실제 최대 HP · 재생으로 버틴다고 보고 0이 될 때마다 가상 사망 1회(생존 보상의 가치를 잰다).
      if (report.mode === "playing") {
        const dt = Math.max(0, report.time - lastTime);
        pool = Math.min(report.maxHp, pool + (report.regen || 0) * dt) - lost;
        if (pool <= 0) {
          virtualDeaths++;
          pool = report.maxHp;
        }
      }
      lastTime = report.time || lastTime;
      if (immortal && report.hp > 0 && report.hp < report.maxHp && report.mode === "playing") t.setHp(report.maxHp);
      lastHp = immortal && report.mode === "playing" ? report.maxHp : report.hp;
      if (finale && (mode === "ending" || (finale.thresholdAt && report.time === 0))) {
        finale.endedAt = finale.thresholdAt;
        break;
      }
      if (mode === "gameover" || (report.time === 0 && frame > 60 && !report.hp)) {
        death = { time: +run.time.toFixed(1), level: run.level };
        break;
      }
      if (mode !== "playing") {
        hold([]);
        stuck = mode === lastMode ? stuck + 1 : 0;
        lastMode = mode;
        const html = overlay.innerHTML || "",
          options = actionsIn(html);
        decisions[mode] = (decisions[mode] || 0) + 1;
        if (mode === "levelup") {
          run = JSON.parse(t.snapshot()).run;
          const pick = chooseUpgrade(run.choices || [], run.up, maxWeapons, planner ? fusionPlan(run) : null);
          if (pick) click("choice", pick);
          continue;
        }
        if (mode === "branch" && planner) {
          run = JSON.parse(t.snapshot()).run;
          const weapon = WEAPONS.find(w => (run.up[w] || 0) >= 3 && !run.branches[w]),
            want = fusionPlan(run).materials.find(([w]) => w === weapon);
          const option = want && options.find(o => o.id === "branch-" + want[1]);
          if (option) {
            click("action", option.id);
            continue;
          }
        }
        if (mode === "fusion") {
          const next = options.find(
            o => o.id.startsWith("fusion-") && !["fusion-close", "fusion-guide"].includes(o.id) && !tried.has(o.id)
          );
          if (next) {
            tried.add(next.id);
            click("action", next.id);
          } else {
            tried.clear();
            click("action", "fusion-close");
          }
          continue;
        }
        const prefer = { signal: rules.signal, encounter: rules.witness, site: "site-" + rules.site }[mode];
        const pick =
          options.find(o => o.id === prefer) ||
          options.find(
            o =>
              !["menu", "ledger-open", "reroll", "fusion-close", "fusion-guide", "new", "reset-open"].includes(o.id) &&
              !o.id.startsWith("ledger")
          ) ||
          options[0];
        if (mode === "finalintro") {
          run = JSON.parse(t.snapshot()).run;
          finale = { startedAt: +run.time.toFixed(1), level: run.level };
        }
        if (mode === "finalchoice" && finale && !finale.thresholdAt) finale.thresholdAt = +run.time.toFixed(1);
        if (pick) click(pick.kind, pick.id);
        if (stuck > 30) {
          env.dispatch("keydown", { code: "Escape" });
          stuck = 0;
        }
        continue;
      }
      lastMode = "playing";
      if (frame % 4 === 0) {
        run = JSON.parse(t.snapshot()).run;
        const p = run.player;
        // 무기를 내린 감시자: 정책대로 멈추거나 E
        const yielding = run.enemies.find(e => e.id === run.bossChoiceId && e.phase === 3);
        if (yielding && Math.hypot(yielding.x - p.x, yielding.y - p.y) < 110) {
          if (rules.guardian === "spare") {
            hold([]);
            continue;
          }
          env.dispatch("keydown", { code: "KeyE" });
          env.dispatch("keyup", { code: "KeyE" });
        }
        // 융합 가능하면 G
        if (frame % 240 === 0) {
          env.dispatch("keydown", { code: "KeyG" });
          env.dispatch("keyup", { code: "KeyG" });
        }
        // 이동: 가까운 적의 반대 방향 + 접선(원 그리기). 표식(탐사 · 작전 · 기록원)이 있으면 그쪽을 섞는다.
        let ax = 0,
          ay = 0;
        let near = 0,
          closest = null,
          closestD2 = Infinity;
        // 적 몸체와 적 탄환(가중 2배)을 피한다. 가까울수록 강하게.
        for (const e of run.enemies) {
          if (e.hp <= 0) continue;
          const dx = p.x - e.x,
            dy = p.y - e.y,
            d2 = dx * dx + dy * dy;
          if (e.kind !== 3 && d2 < closestD2) {
            closest = e;
            closestD2 = d2;
          }
          if (d2 < 260 * 260) {
            const w = (e.kind === 3 ? 4 : 1) / Math.max(300, d2);
            ax += dx * w;
            ay += dy * w;
            if (d2 < 120 * 120) near++;
          }
        }
        for (const b of run.bullets || []) {
          const dx = p.x - b.x,
            dy = p.y - b.y,
            d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140) {
            const w = 2 / Math.max(200, d2);
            ax += dx * w;
            ay += dy * w;
          }
        }
        // 표류 구역(예고 포함)은 사람처럼 크게 피한다.
        for (const z of run.drift?.zones || []) {
          const dx = p.x - z.x,
            dy = p.y - z.y,
            d = Math.hypot(dx, dy) || 1;
          if (d < z.radius + 90) {
            ax += (dx / d) * 0.02;
            ay += (dy / d) * 0.02;
          }
        }
        const len = Math.hypot(ax, ay) || 1,
          tx = -ay / len,
          ty = ax / len;
        let vx = ax / len + tx * 0.6,
          vy = ay / len + ty * 0.6;
        // 근거리 시작 무기(노바 · 위성 · 지뢰 · 균열)로 펄스가 아직 휴면이면 사람처럼 적에게 다가가 무기 범위에 넣는다.
        const melee = CLOSE_RANGE.has(run.startWeapon) && !(run.up.pulse > 0);
        if (melee && closest && near < 4 && closestD2 > CLOSE_RANGE.get(run.startWeapon) ** 2) {
          const d = Math.sqrt(closestD2);
          vx = vx * 0.35 + (closest.x - p.x) / d;
          vy = vy * 0.35 + (closest.y - p.y) / d;
        }
        // 최종전: 중심핵(또는 남은 연결점)과 140 거리를 유지하며 돈다. 멀리 도망가면 사거리 밖이 된다.
        const core =
          run.finalStep === 2 && (run.enemies.find(e => e.coreNode && e.hp > 0) || run.enemies.find(e => e.final));
        if (core) {
          const dx = p.x - core.x,
            dy = p.y - core.y,
            d = Math.hypot(dx, dy) || 1,
            pull = d > 170 ? -1 : d < 110 ? 1 : 0;
          vx = (dx / d) * pull - dy / d;
          vy = (dy / d) * pull + dx / d;
        }
        const goal = core
          ? null
          : run.site ||
            (objectives && run.objective?.phase && run.objective.targetId
              ? run.enemies.find(e => e.id === run.objective.targetId && e.hp > 0)
              : null) ||
            (objectives ? run.objective : null) ||
            (run.npc?.spawned && run.npc.state === "waiting" ? run.npc : null);
        if (goal && near < 6 && Math.hypot(goal.x - p.x, goal.y - p.y) > 40) {
          const gx = goal.x - p.x,
            gy = goal.y - p.y,
            gl = Math.hypot(gx, gy);
          vx = vx * 0.5 + gx / gl;
          vy = vy * 0.5 + gy / gl;
        }
        if (goal && Math.hypot(goal.x - p.x, goal.y - p.y) < 70) {
          env.dispatch("keydown", { code: "KeyE" });
          env.dispatch("keyup", { code: "KeyE" });
        }
        const keys = [];
        if (vx > 0.3) keys.push("KeyD");
        else if (vx < -0.3) keys.push("KeyA");
        if (vy > 0.3) keys.push("KeyS");
        else if (vy < -0.3) keys.push("KeyW");
        hold(keys);
        trace.push({
          t: +run.time.toFixed(1),
          hp: Math.round(p.hp),
          near,
          bullets: (run.bullets || []).length,
          hazards: (run.hazards || []).length,
          guardian: run.enemies
            .filter(e => e.kind === 3)
            .map(e => `${e.named ? "N" : "H"}${e.phase}:${Math.round(Math.hypot(e.x - p.x, e.y - p.y))}`)
            .join(","),
          keys: [...held].join(""),
        });
        if (trace.length > 80) trace.shift();
        if (run.time >= (minute + 1) * 60) {
          minute = Math.floor(run.time / 60);
          const pace = paceAt(run.time);
          timeline.push({
            minute,
            phase: pace.name,
            level: run.level,
            maxHp: Math.round(report.maxHp),
            hp: Math.round(p.hp),
            damageTaken: Math.round(damage),
            virtualDeaths,
            kills: run.kills,
            enemies: run.enemies.length,
            weapons: Object.fromEntries(WEAPONS.filter(w => run.up[w]).map(w => [w, run.up[w]])),
            branches: { ...run.branches },
            fusions: Object.keys(run.fusionStates || {}),
            kinds: run.enemies.reduce(
              (m, e) => ((m[(e.elite ? "E" : "") + e.kind] = (m[(e.elite ? "E" : "") + e.kind] || 0) + 1), m),
              {}
            ),
            bullets: (run.bullets || []).length,
            objective: run.objective?.id || "",
            episode: run.journey?.active?.kind || "",
          });
        }
        if (run.time > limit) break;
      }
    }
    try {
      run = JSON.parse(t.snapshot()).run || run;
    } catch {
      /* 판이 끝나 실험 판이 비었다 */
    }
    return {
      seed,
      policy,
      death,
      finale,
      timeline,
      decisions,
      trace,
      final: { level: run.level, kills: run.kills, virtualDeaths, objectives: { ...(run.objectiveOutcomes || {}) } },
    };
  } finally {
    app?.dispose();
    for (const [key, value] of descriptors)
      if (value) Object.defineProperty(globalThis, key, value);
      else delete globalThis[key];
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seeds = (process.argv[2] || "42").split(",").map(Number),
    policies = (process.argv[3] || "preserve").split(",");
  const runs = [];
  for (const policy of policies)
    for (const seed of seeds) {
      const started = Date.now(),
        r = autoplay({ seed, policy });
      runs.push(r);
      console.log(
        `seed ${seed} ${policy}: ${r.death ? `사망 ${r.death.time}s (Lv${r.death.level})` : r.finale ? `중심핵 ${r.finale.startedAt}s → 결말 ${r.finale.thresholdAt ?? "-"}s` : "제한 도달"} · ${((Date.now() - started) / 1000).toFixed(0)}초 소요`
      );
      for (const m of r.timeline.filter(m => m.minute % 5 === 0))
        console.log(
          `  ${String(m.minute).padStart(2)}분 Lv${m.level} HP${m.hp} 피해${m.damageTaken} 처치${m.kills} 적${m.enemies} 무기${JSON.stringify(m.weapons)} 융합${m.fusions.length}`
        );
    }
  writeFileSync(
    new URL("../AUTOPLAY-VALIDATION.json", import.meta.url),
    JSON.stringify({ version: "2.6.27", note: "Bot autoplay with mock DOM/Canvas. Not human play.", runs }, null, 2) +
      "\n"
  );
}
