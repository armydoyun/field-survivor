import test from 'node:test';
import assert from 'node:assert/strict';
import { shopItems, PERK, LEGACY_SHOP } from '../src/data/shop.js';
import { shopCost, shopSpent } from '../src/core/perks.js';
import { initialProfile, hydrateProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';

test('permanent upgrade prices: first levels fit one short run, everything maxed costs several full clears', () => {
  const first = shopItems.map(i => shopCost(i, 0)), total = shopItems.reduce((s, i) => s + shopSpent(i, i.max), 0);
  assert.ok(Math.max(...first) <= 800 && first.filter(c => c <= 200).length >= 5, `${first}`);
  assert.ok(total >= 90000 && total <= 150000, `total ${total}`);
  for (const i of shopItems) for (let l = 1; l < i.max; l++) assert.ok(shopCost(i, l) > shopCost(i, l - 1), i.id);
});

test('permanent upgrade effects stay below in-run growth: +30% damage, +100 HP, +36 speed at max', () => {
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 }), st = createStatistics({ sessionState: { profile, run } });
  run.player = { x: 0, y: 0, hp: 100, hurt: 0 };
  const base = st.stats(run);
  for (const i of shopItems) profile.perks[i.id] = i.max;
  const maxed = st.stats(run);
  assert.ok(Math.abs(maxed.damage / base.damage - (1 + 10 * PERK.power)) < 1e-9);
  assert.equal(maxed.maxHp - base.maxHp, 100); assert.equal(maxed.speed - base.speed, 36);
  assert.ok(Math.abs(maxed.regen - base.regen - .64) < 1e-9);
});

test('old saves keep their levels up to the new caps and get back what they overpaid', () => {
  const oldSpent = (id, lv) => { const [b, g] = LEGACY_SHOP[id]; let s = 0; for (let l = 0; l < lv; l++) s += Math.round(b * g ** l); return s; };
  const p = initialProfile(); hydrateProfile(p, { gold: 100, perks: { power: 15, health: 3, reroll: 3 } });
  assert.equal(p.perks.power, 10); assert.equal(p.perks.health, 3); assert.equal(p.perks.reroll, 3);
  const power = shopItems.find(i => i.id === 'power'), health = shopItems.find(i => i.id === 'health'), reroll = shopItems.find(i => i.id === 'reroll');
  const expected = Math.max(0, oldSpent('power', 15) - shopSpent(power, 10)) + Math.max(0, oldSpent('health', 3) - shopSpent(health, 3)) + Math.max(0, oldSpent('reroll', 3) - shopSpent(reroll, 3));
  assert.equal(p.gold, 100 + expected); assert.ok(expected > 30000);
  assert.ok(p.memory.archive.at(-1).includes('영구 강화 재조정'));
  const again = initialProfile(); hydrateProfile(again, JSON.parse(JSON.stringify(p))); assert.equal(again.gold, p.gold, 'no double refund');
});

test('relics: the harvest chalice heals without cutting XP but costs 10% damage; the capacitor boosts every weapon below half HP', async () => {
  const { RELIC } = await import('../src/data/world-choices.js');
  const { xpCollectionScale } = await import('../src/growth/experience.js');
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 }), st = createStatistics({ sessionState: { profile, run } });
  run.player = { x: 0, y: 0, hp: 100, hurt: 0 };
  const base = st.stats(run).damage;
  assert.equal(xpCollectionScale(profile, run, true), xpCollectionScale(profile, run, false));
  run.relics = ['harvest']; assert.ok(Math.abs(st.stats(run).damage / base - RELIC.harvestDamage) < 1e-9);
  run.relics = ['capacitor']; assert.ok(Math.abs(st.stats(run).damage - base) < 1e-9);
  run.player.hp = 50; assert.ok(Math.abs(st.stats(run).damage / base - RELIC.capacitorDamage) < 1e-9);
  assert.equal(st.stats(run).interval, st.stats({ ...run, relics: [] }).interval, 'no pulse-only interval bonus anymore');
});
