import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { createStatistics } from '../src/core/statistics.js';
import { relics, anomalies } from '../src/data/world.js';
import { shopItems, PERK } from '../src/data/shop.js';
import { RELIC } from '../src/data/world-choices.js';
import { HARVEST_RATE, HARVEST_CAP } from '../src/core/config.js';
import { loadouts, unlockedLoadouts } from '../src/data/loadouts.js';

// 설명문 속 숫자가 실제 계산과 같은지 확인한다(v3.2 검수). 숫자를 바꾸면 이 검사가 설명문도 고치라고 알려 준다.
function setup() { const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 }); run.player = { x: 0, y: 0, hp: 100, hurt: 0 }; return { profile, run, st: createStatistics({ sessionState: { profile, run } }) }; }
const desc = (list, id) => list.find(x => x.id === id).desc;
const pct = v => Math.round(v * 100);

test('relic descriptions match their numbers', () => {
  const { run, st } = setup(), base = st.stats(run);
  run.relics = ['glass']; const glass = st.stats(run);
  assert.ok(desc(relics, 'glass').includes(`+${pct(glass.damage / base.damage - 1)}%`) && desc(relics, 'glass').includes(`-${pct(1 - glass.maxHp / base.maxHp)}%`));
  const harvest = desc(relics, 'harvest');
  assert.ok(harvest.includes('EXP 25당 HP 1') && harvest.includes(`초당 ${HARVEST_RATE}`) && harvest.includes(`${HARVEST_CAP}까지`) && harvest.includes(`-${pct(1 - RELIC.harvestDamage)}%`));
  const cap = desc(relics, 'capacitor'); assert.ok(cap.includes(`${pct(RELIC.capacitorHp)}%`) && cap.includes(`+${pct(RELIC.capacitorDamage - 1)}%`));
});

test('the ground-shift choices state their real max HP, regen and damage', () => {
  const echo = anomalies.find(a => a.id === 'echo'), keep = echo.options.find(o => o.id === 'keep').effect, erase = echo.options.find(o => o.id === 'erase').effect;
  const { run, st } = setup(), base = st.stats(run);
  run.anomalyChoices = { echo: 'keep' }; const k = st.stats(run);
  assert.ok(keep.includes(`최대 HP +${k.maxHp - base.maxHp}`) && keep.includes(`+${(k.regen - base.regen).toFixed(2)}`));
  run.anomalyChoices = { echo: 'erase' }; const e = st.stats(run);
  assert.ok(erase.includes(`피해 +${pct(e.damage / base.damage - 1)}%`) && erase.includes(`최대 HP -${base.maxHp - e.maxHp}`));
});

test('permanent upgrade descriptions match PERK', () => {
  const expect = { power: `+${pct(PERK.power)}%`, health: `+${PERK.health}`, speed: `+${PERK.speed}`, luck: `+${pct(PERK.luck)}%p`, regen: `+${PERK.regen}`, magnet: `+${PERK.magnet}`, learning: `+${pct(PERK.learning)}%p`, armor: `-${PERK.armor * 100}%p` };
  for (const [id, text] of Object.entries(expect)) assert.ok(desc(shopItems, id).includes(text), `${id}: ${desc(shopItems, id)} / ${text}`);
});

test('start weapon unlock texts describe their real conditions', () => {
  const memory = initialProfile().memory;
  assert.deepEqual(unlockedLoadouts(memory), ['pulse']);
  const cases = { nova: m => { m.endings.preserve = 1; }, rift: m => { m.endings.consume = 1; }, chain: m => { m.endings.divided = 1; }, orbit: m => { m.endings.release = 1; }, beacon: m => { m.witness.quiet = true; }, lance: m => { m.guardian.spared = 3; }, mine: m => { m.deaths = 3; } };
  for (const l of loadouts.filter(l => l.id !== 'pulse')) { const m = initialProfile().memory; cases[l.id](m); assert.deepEqual(unlockedLoadouts(m), ['pulse', l.id], `${l.id}: ${l.unlock}`); }
});

test('player-facing text uses Korean weapon names and correct particles (no PULSE/NOVA codes, no 기뢰을 · 칼날 칼날)', async () => {
  const { createUpgradeCatalog } = await import('../src/data/upgrades.js');
  const { branches } = await import('../src/data/specializations.js');
  const { keystones } = await import('../src/data/progression.js');
  const catalog = createUpgradeCatalog();
  const texts = [
    ...catalog.upgrades.map(u => u.desc), ...Object.values(catalog.upgradeDetails).flat(),
    ...branches.flatMap(b => b.options.map(o => o.desc)), ...keystones.map(k => k.desc), ...shopItems.map(i => i.desc),
    ...relics.map(r => r.desc), ...anomalies.flatMap(a => a.options.map(o => o.effect))
  ];
  const codes = /\b(PULSE|NOVA|ORBIT|CHAIN|LANCE|MINE|RIFT|BEACON)\b/, particles = /(코어|기뢰|번개|충격파)(을|과)\b|(위성|창|칼날|포탑)(를|와)\b|(코어 코어|칼날 칼날|충격파 충격파|포탑 포탑)/;
  for (const t of texts) { assert.doesNotMatch(t, codes, t); assert.doesNotMatch(t, particles, t); }
});

test('base weapon damage formulas in the level-up details match the real damage, balance multiplier included', async () => {
  const { createUpgradeCatalog } = await import('../src/data/upgrades.js');
  const { skillBalance } = await import('../src/data/balance.js');
  const details = createUpgradeCatalog().upgradeDetails;
  const formulas = { nova: [.88, .17], chain: [.75, .09], lance: [1.05, .24], mine: [1.1, .26], rift: [.88, .2], beacon: [.62, .13] };
  const { run, st } = setup();
  for (const [id, [a, b]] of Object.entries(formulas)) {
    const k = skillBalance.base[id] ?? 1;
    assert.ok(details[id][1].includes(`× ${k}(무기 보정`), `${id} detail names its multiplier`);
    for (const level of [1, 3, 5]) { run.up[id] = level; const s = st.stats(run); assert.ok(Math.abs(st.weaponDamage(id, s) - s.damage * (a + b * level) * k) < 1e-9, `${id} L${level}`); }
  }
  for (const level of [1, 5]) { run.up.nova = level; const s = st.stats(run); assert.equal(st.novaRadius(s), 112 + 22 * level); assert.equal(st.novaInterval(level), Math.max(1.7, 4.2 - .38 * level)); }
});
