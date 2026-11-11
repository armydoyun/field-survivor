import test from 'node:test';
import assert from 'node:assert/strict';
import { createJuice, spring, JUICE } from '../src/render/juice.js';

const advance = (j, seconds, step = 1 / 60) => { for (let t = 0; t < seconds - 1e-9; t += step) j.tick(step); };

test('enemies pop in from small, squash when hit, stretch when pushed, and settle back to normal', () => {
  const j = createJuice({ enabled: () => true }), e = { kind: 0, flash: 0 };
  const first = j.enemyShape(e); assert.ok(first.sx < .3, `spawns small ${first.sx}`);
  advance(j, JUICE.spawnTime * .6); const growing = j.enemyShape(e); assert.ok(growing.sx > first.sx);
  advance(j, 1); const idle = j.enemyShape(e); assert.ok(Math.abs(idle.sx - 1) < .01 && Math.abs(idle.sy - 1) < .01);
  e.flash = .11; j.enemyShape(e); advance(j, .05); const hit = j.enemyShape(e); assert.ok(hit.sx > 1.05 && hit.sy < .95, `squash ${hit.sx} ${hit.sy}`);
  advance(j, 1); e.flash = 0; assert.ok(Math.abs(j.enemyShape(e).sx - 1) < .01);
  e.pushX = 60; e.pushY = 0; const pushed = j.enemyShape(e); assert.ok(pushed.sx > 1.2 && pushed.angle === 0);
});

test('the player stretches along movement, squashes when hurt and pops on level-up; recoil is brief', () => {
  const j = createJuice({ enabled: () => true }), r = { player: { x: 0, y: 0, hurt: 0 } };
  j.playerShape(r);
  for (let i = 0; i < 20; i++) { j.tick(1 / 60); r.player.x += 190 / 60; j.playerShape(r); }
  const moving = j.playerShape(r); assert.ok(moving.sx > 1.08 && moving.sy < .96 && Math.abs(moving.angle) < .01);
  for (let i = 0; i < 60; i++) { j.tick(1 / 60); j.playerShape(r); }
  r.player.hurt = .5; j.playerShape(r); j.tick(.04); const hurt = j.playerShape(r); assert.ok(hurt.sy > hurt.sx, 'hurt squash is vertical');
  advance(j, 1); r.player.hurt = 0; j.pop(); j.tick(.05); const pop = j.playerShape(r); assert.ok(pop.sx > 1.05 && pop.sy > 1.05);
});

test('hit stop keeps the longer request, is capped, drains with real time, and everything is off when disabled', () => {
  const j = createJuice({ enabled: () => true });
  j.hitStop(.05); j.hitStop(.03); assert.equal(j.state().freeze, .05); j.hitStop(5); assert.equal(j.state().freeze, JUICE.hitStop.max);
  assert.equal(j.consumeFreeze(.1), true); assert.equal(j.consumeFreeze(.1), true); assert.equal(j.consumeFreeze(.1), false);
  const off = createJuice({ enabled: () => false });
  off.hitStop(.1); off.recoil(); off.pop(); assert.equal(off.state().freeze, 0); assert.equal(off.enemyShape({ flash: 0 }), null); assert.equal(off.playerShape({ player: { x: 0, y: 0 } }), null);
  assert.equal(spring(0), 0); assert.ok(Math.abs(spring(2)) < 1e-6);
});
