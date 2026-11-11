// npm run bench:autoplay → AUTOPLAY-VALIDATION.json
// 봇이 실제 게임 코드로 한 판(최대 30분 + 중심핵 전투)을 처음부터 끝까지 플레이하고 분 단위 기록을 남긴다.
// 화면에 뜬 선택지는 오버레이 HTML의 data-action / data-choice를 읽어 사람처럼 누른다. 이동은 적 무리를 피해 원을 그린다.
// 목적: 후반 성장 속도 · 생존 난이도 · 중심핵 전투 길이를 같은 조건에서 비교한다. 모의 DOM/Canvas이며 실제 사람의 플레이가 아니다.
import { writeFileSync } from "node:fs";
import { createMockBrowser } from "../tests/mock-browser.js";
import { createDebugGame } from "../src/debug/create-debug-game.js";
import { paceAt } from "../src/core/difficulty.js";
import { startWeaponLevel } from "../src/data/loadouts.js";
import { hazardHit } from "../src/math/geometry.js";
import { fusionRecipes } from "../src/data/fusions.js";

// 받은 피해의 출처를 피격 직후 판 상태로 어림한다: 예고 범위 · 표류 구역 · 탄 · 감시자 · 정예 · 일반 적 몸체.
function damageSource(r) {
  const p = r?.player;
  if (!p) return "unknown";
  if ((r.hazards || []).some(h => r.time >= h.fireAt && hazardHit(h, p, r.time))) return "hazard";
  if ((r.drift?.zones || []).some(z => r.time >= z.liveAt && Math.hypot(p.x - z.x, p.y - z.y) < z.radius + 12))
    return "drift";
  if ((r.bullets || []).some(b => Math.hypot(b.x - p.x, b.y - p.y) < 40 + (b.radius || 0))) return "bullet";
  let best = null,
    bestD = Infinity;
  for (const e of r.enemies || []) {
    const d = Math.hypot(e.x - p.x, e.y - p.y) - (e.radius || 12);
    if (e.hp > 0 && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  if (!best || bestD > 60) return "unknown";
  return best.kind === 3 ? "guardian" : best.elite ? "elite" : `body${best.kind}`;
}

// 봇이 회피 계산에 쓰는 플레이어 이동 속도(px/초, 기본 이동 속도 어림).
const BOT_SPEED = 190;

// 근거리 시작 무기와 봇이 다가갈 거리(균열은 사거리 약 220 안).
const CLOSE_RANGE = new Map([
  ["nova", 85],
  ["orbit", 85],
  ["mine", 85],
  ["rift", 170],
]);

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

// 회복 동선(v3.0): HP가 70% 아래면 600px 안의 회복 · 방패 보급을 줍는다. 방패는 300px 안이면 언제든.
function healPickup(run) {
  const p = run.player,
    low = p.hp < (run.maxHpSeen || p.hp) * 0.7;
  let best = null,
    bestD = Infinity;
  for (const q of run.pickups || []) {
    const d = Math.hypot(q.x - p.x, q.y - p.y),
      want = (q.type === "heal" && low && d < 600) || (q.type === "shield" && d < 300);
    if (want && d < bestD) {
      best = q;
      bestD = d;
    }
  }
  return best;
}

// 생존 카드(v3.0): HP가 절반 아래면 최대 HP · 재생 · 방어를 무기보다 먼저 고른다(사람의 판단 어림).
const SURVIVAL = ["vitality", "regen", "armor"];
function chooseUpgrade(choices, up, maxWeapons, plan = null, hpRatio = 1) {
  const owned = WEAPONS.filter(w => (up[w] || 0) > 0),
    wanted = new Set((plan?.materials || []).map(([w]) => w));
  const score = id => {
    if (id.startsWith("fusion_")) return 100;
    if (hpRatio < 0.5 && SURVIVAL.includes(id)) return 97 - SURVIVAL.indexOf(id);
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
  dodge = true,
  escape = false,
  focus = false,
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
      sources = {},
      guardianLog = [],
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
      if (lost > 0) {
        const hitRun = JSON.parse(t.snapshot()).run,
          source = damageSource(hitRun);
        sources[source] = (sources[source] || 0) + lost;
        if (process.env.FS_HIT_TRACE) {
          const p = hitRun.player,
            near = (hitRun.enemies || [])
              .map(e => ({ k: e.kind, el: !!e.elite, d: Math.round(Math.hypot(e.x - p.x, e.y - p.y)), ai: e.ai }))
              .sort((a, b) => a.d - b.d)
              .slice(0, 3);
          console.log(JSON.stringify({ t: +hitRun.time.toFixed(2), lost, source, hz: hitRun.hazards?.length, near }));
        }
      }
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
          const hpNow = t.report(),
            pick = chooseUpgrade(
              run.choices || [],
              run.up,
              maxWeapons,
              planner ? fusionPlan(run) : null,
              hpNow.maxHp ? hpNow.hp / hpNow.maxHp : 1
            );
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
        run.maxHpSeen = report.maxHp;
        // 감시자 등장 · 무기 내림 시각(난이도 진단용).
        for (const e of run.enemies)
          if (e.kind === 3 && e.named && !guardianLog.some(g => g.id === e.id))
            guardianLog.push({
              id: e.id,
              spawn: +run.time.toFixed(1),
              hp: Math.round(e.maxHp || e.hp),
              level: run.level,
            });
        for (const g of guardianLog) {
          const live = run.enemies.find(e => e.id === g.id);
          if (live && live.hp > 0) g.left = +(live.hp / (live.maxHp || live.hp)).toFixed(2);
          if (live && run.focusGuardian) g.focused = true;
          if (g.yield == null && run.bossChoiceId === g.id) g.yield = +run.time.toFixed(1);
        }
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
        // 감시자 조준(v3.1): focus 옵션이면 감시자가 보일 때 T를 켠다.
        if (focus && !run.focusGuardian && run.enemies.some(e => e.kind === 3 && e.hp > 0 && e.phase !== 3)) {
          env.dispatch("keydown", { code: "KeyT" });
          env.dispatch("keyup", { code: "KeyT" });
        }
        // 화부: 보존 정책은 곁에서 멈춰 불을 끄고, 연소 정책은 E로 불을 지핀다.
        const stoker = run.stoker?.state === "waiting" ? run.stoker : null;
        if (stoker && Math.hypot(stoker.x - p.x, stoker.y - p.y) < 70) {
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
        // 무리 탈출(v2.9): 가까운 적이 많으면 16방향 중 앞쪽 220px 부채꼴에 적이 가장 적은 쪽으로 빠져나간다.
        if (escape && near >= 3) {
          let best = null;
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2,
              ux = Math.cos(a),
              uy = Math.sin(a);
            let crowd = 0;
            for (const e of run.enemies) {
              if (e.hp <= 0) continue;
              const dx = e.x - p.x,
                dy = e.y - p.y,
                d = Math.hypot(dx, dy);
              if (d > 220 || d < 1) continue;
              const along = (dx * ux + dy * uy) / d;
              if (along > 0.35) crowd += (e.kind === 3 ? 4 : 1) * along * (1.4 - d / 220);
            }
            const score = crowd - (ux * vx + uy * vy) * 0.3;
            if (!best || score < best.score) best = { ux, uy, score };
          }
          vx = best.ux;
          vy = best.uy;
        }
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
            (run.npc?.spawned && run.npc.state === "waiting" ? run.npc : null) ||
            (run.stoker?.state === "waiting" ? run.stoker : null) ||
            healPickup(run);
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
        // 회피(NEXT-UPDATE-PLAN.md 5순위): 예고 범위(곧 발동 · 발동 중) 안이면 8방향 중 안전하고 원래 방향에 가까운 쪽으로 빠진다.
        if (dodge && run.hazards?.length) {
          const soon = run.hazards.filter(h => h.fireAt - run.time < 1.2 && h.endAt > run.time),
            danger = pt => soon.some(h => hazardHit(h, pt, Math.max(run.time, h.fireAt)));
          if (soon.length && danger(p)) {
            let best = null;
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2,
                ux = Math.cos(a),
                uy = Math.sin(a);
              if (danger({ x: p.x + ux * 70, y: p.y + uy * 70 })) continue;
              const score = ux * vx + uy * vy;
              if (!best || score > best.score) best = { ux, uy, score };
            }
            if (best) {
              vx = best.ux;
              vy = best.uy;
            }
          }
        }
        // 탄 회피: 0.6초 안에 스칠 탄이 있으면 8방향(+제자리) 중 가장 여유가 큰 쪽으로 움직인다(탄은 직선으로 본다).
        if (dodge) {
          const threats = (run.bullets || []).filter(b => {
            const rx = p.x - b.x,
              ry = p.y - b.y,
              v2 = b.vx * b.vx + b.vy * b.vy;
            if (rx * rx + ry * ry > 320 * 320 || !v2) return false;
            const tc = Math.max(0, Math.min(0.6, (rx * b.vx + ry * b.vy) / v2));
            return Math.hypot(rx - b.vx * tc, ry - b.vy * tc) < 22 + (b.radius || 0);
          });
          if (threats.length) {
            const margin = (ux, uy) => {
              let worst = Infinity;
              for (let s = 0.05; s <= 0.6; s += 0.05)
                for (const b of threats) {
                  const d =
                    Math.hypot(
                      p.x + ux * BOT_SPEED * s - (b.x + b.vx * s),
                      p.y + uy * BOT_SPEED * s - (b.y + b.vy * s)
                    ) - (b.radius || 0);
                  if (d < worst) worst = d;
                }
              return worst;
            };
            let best = { ux: 0, uy: 0, score: Math.min(margin(0, 0), 40) };
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2,
                ux = Math.cos(a),
                uy = Math.sin(a),
                score = Math.min(margin(ux, uy), 40) + (ux * vx + uy * vy) * 2;
              if (score > best.score) best = { ux, uy, score };
            }
            vx = best.ux;
            vy = best.uy;
          }
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
          obj: run.objective
            ? `${run.objective.id}:${run.objective.phase || 0}:${(run.objective.progress || 0).toFixed(1)}:${Math.round(Math.hypot(run.objective.x - p.x, run.objective.y - p.y))}`
            : "",
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
            gold: run.gold,
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
      sources,
      guardians: guardianLog,
      final: {
        stoker: run.stoker?.state ?? null,
        level: run.level,
        kills: run.kills,
        virtualDeaths,
        objectives: { ...(run.objectiveOutcomes || {}) },
      },
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
