// 게임 주스(v3.3): 스쿼시 앤 스트레치 · 피격 반동 · 히트스톱.
// 모든 상태는 그리기 쪽(WeakMap · 지역 변수)에만 두고 판 상태(run)에는 쓰지 않는다. 전투 계산 · 난수 · 저장과 무관하다.
// '이펙트: 간단히' 설정이나 운영체제의 동작 줄이기 설정이면 전부 꺼진다(히트스톱 포함).

// 감쇠 진동: 0에서 시작해 튀었다가 가라앉는다. t는 경과 초.
export const spring = (t, freq = 26, damp = 9) => Math.exp(-damp * t) * Math.sin(freq * t);

export const JUICE = Object.freeze({
  spawnTime: .22,        // 적이 나타날 때 커지는 시간
  hitSquash: .26,        // 적이 맞을 때 눌리는 정도
  pushStretch: .32,      // 밀려날 때 늘어나는 최대치
  moveStretch: .06,      // 플레이어 이동 늘어남 최대치(v3.2 피드백: .14는 과해서 절반 이하로)
  hurtSquash: .3,        // 플레이어 피격 눌림
  recoil: .07,           // 발사 반동
  pop: .22,              // 레벨업 · 선택 확정 팽창
  hitStop: { hurt: .06, elite: .05, guardian: .12, max: .14 }
});

export function createJuice({ enabled }) {
  const enemies = new WeakMap();
  let player = { x: null, y: null, vx: 0, vy: 0, hurtAt: -1, wasHurt: 0, kickAt: -1, kick: 0, popAt: -1 }, owner = null, freeze = 0, clock = 0;

  // 화면 시계: 판 시간이 멈춰도(히트스톱 · 선택 화면) 흔들림이 자연스럽게 끝나도록 실제 시간으로 센다.
  function tick(dt) { clock += dt; }

  // 적 하나의 변형: 등장 팽창 · 피격 눌림 · 밀림 늘어남. 반환값은 { sx, sy, angle }.
  function enemyShape(e) {
    if (!enabled()) return null;
    let s = enemies.get(e);
    if (!s) { s = { born: clock, flash: 0, hitAt: -1 }; enemies.set(e, s); }
    if ((e.flash || 0) > s.flash + 1e-6) s.hitAt = clock;
    s.flash = e.flash || 0;
    const born = clock - s.born, hit = s.hitAt < 0 ? 1 : clock - s.hitAt;
    let sx = 1, sy = 1, angle = 0;
    if (born < JUICE.spawnTime * 2.5) { const k = born < JUICE.spawnTime ? born / JUICE.spawnTime : 1; const grow = k * k * (3 - 2 * k) + .18 * spring(born, 22, 10); sx *= grow; sy *= grow; }
    if (hit < .4) { const w = spring(hit, 30, 11) * JUICE.hitSquash * (e.kind === 3 ? .5 : 1); sx *= 1 + w; sy *= 1 - w; }
    const pushed = Math.hypot(e.pushX || 0, e.pushY || 0);
    if (pushed > 1) { const st = Math.min(JUICE.pushStretch, pushed / 90); angle = Math.atan2(e.pushY, e.pushX); sx *= 1 + st; sy *= 1 - st * .55; }
    return { sx: Math.max(.05, sx), sy: Math.max(.05, sy), angle };
  }

  // 플레이어 변형: 이동 방향으로 늘어남, 피격 눌림, 발사 반동, 레벨업 팽창.
  function playerShape(r) {
    if (!enabled()) return null;
    const p = r.player;
    if (owner !== r || player.x === null) { owner = r; player = { x: p.x, y: p.y, vx: 0, vy: 0, hurtAt: -1, wasHurt: 0, kickAt: -1, kick: 0, popAt: -1, at: clock }; }
    const dt = clock - (player.at ?? clock); player.at = clock;
    if (dt > 0) { const k = 1 - Math.exp(-dt * 18); player.vx += ((p.x - player.x) / dt - player.vx) * k; player.vy += ((p.y - player.y) / dt - player.vy) * k; }
    player.x = p.x; player.y = p.y;
    if ((p.hurt || 0) > player.wasHurt + 1e-6) player.hurtAt = clock;
    player.wasHurt = p.hurt || 0;
    const speed = Math.hypot(player.vx, player.vy), angle = speed > 1 ? Math.atan2(player.vy, player.vx) : 0;
    const st = Math.min(JUICE.moveStretch, speed / 190 * JUICE.moveStretch);
    let sx = 1 + st, sy = 1 - st * .5;
    const hurt = player.hurtAt < 0 ? 1 : clock - player.hurtAt;
    if (hurt < .45) { const w = spring(hurt, 24, 9) * JUICE.hurtSquash; sx *= 1 - w; sy *= 1 + w; }
    const kick = player.kickAt < 0 ? 1 : clock - player.kickAt;
    if (kick < .2) { const w = spring(kick, 40, 18) * player.kick; sx *= 1 - w; sy *= 1 + w * .6; }
    const pop = player.popAt < 0 ? 1 : clock - player.popAt;
    if (pop < .5) { const w = spring(pop, 20, 7) * JUICE.pop; sx *= 1 + w; sy *= 1 + w; }
    return { sx, sy, angle };
  }

  function recoil(power = JUICE.recoil) { if (!enabled()) return; player.kickAt = clock; player.kick = Math.min(.12, power); }
  function pop() { if (enabled()) player.popAt = clock; }

  // 히트스톱: 짧게 판 시간을 멈춘다. 겹치면 더 긴 쪽만, 상한 JUICE.hitStop.max.
  function hitStop(seconds) { if (enabled()) freeze = Math.min(JUICE.hitStop.max, Math.max(freeze, seconds)); }
  function consumeFreeze(dt) { if (freeze <= 0) return false; freeze = Math.max(0, freeze - dt); return true; }

  return { tick, enemyShape, playerShape, recoil, pop, hitStop, consumeFreeze, state: () => ({ freeze, clock }) };
}

// 중심(x, y) 기준으로 변형을 걸고 draw를 부른다. 변형이 없으면 그대로 그린다.
export function withShape(ctx, x, y, shape, draw) {
  if (!shape || (Math.abs(shape.sx - 1) < .003 && Math.abs(shape.sy - 1) < .003)) { draw(); return; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(shape.angle); ctx.scale(shape.sx, shape.sy); ctx.rotate(-shape.angle); ctx.translate(-x, -y);
  draw(); ctx.restore();
}
