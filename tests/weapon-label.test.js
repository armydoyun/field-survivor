import test from 'node:test';
import assert from 'node:assert/strict';
import { weaponLabel, labelColor } from '../src/ui/weapon-label.js';
import { weaponNames } from '../src/data/weapons.js';
import { skillColors } from '../src/data/visuals.js';

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const luminance = hex => { const [r, g, b] = rgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

test('weapon names keep a hint of their skill color but stay readable on the light panels (WCAG AA)', () => {
  for (const id of Object.keys(weaponNames)) {
    const color = /color:(#[0-9a-f]{6})/.exec(weaponLabel(id))[1];
    assert.ok(contrast(color, '#fdfefe') >= 4.5, `${id} ${color}`);
    assert.ok(contrast(color, '#f4f6f7') >= 4.2, `${id} on page`);
    if (skillColors[id]) assert.notEqual(color, labelColor('#23303b'), `${id} keeps a tint`);
  }
  assert.equal(labelColor('#23303b'), '#23303b');
});

test('every weapon has a small SVG icon that follows the label color', async () => {
  const { weaponSvg, weaponSvgPaths } = await import('../src/ui/weapon-icons.js');
  for (const id of Object.keys(weaponNames)) {
    const html = weaponLabel(id);
    assert.ok(html.includes('<svg class="weapon-icon" viewBox="0 0 16 16"'), id);
    assert.ok(weaponSvgPaths[id].includes('currentColor'), id);
    assert.ok(!/#[0-9a-f]{3,6}/i.test(weaponSvgPaths[id]), `${id} uses only currentColor`);
  }
  assert.equal(weaponSvg('unknown'), '');
  assert.equal(new Set(Object.values(weaponSvgPaths)).size, Object.keys(weaponSvgPaths).length);
});

test('level-up cards show one short current → next line, and new weapons say so', async () => {
  const { initialProfile } = await import('../src/core/profile.js');
  const { createRun } = await import('../src/core/run.js');
  const { createStatistics } = await import('../src/core/statistics.js');
  const { createGrowthMetrics } = await import('../src/ui/growth-metrics.js');
  const { createModalContent } = await import('../src/ui/modal-content.js');
  const profile = initialProfile(), run = createRun(profile, { maxHp: 100, xpNext: 24 }), s = { profile, run };
  const statistics = createStatistics({ sessionState: s }), g = createGrowthMetrics({ sessionState: s, statistics, buildModel: { branchLabel: () => '', fusionGuideState: () => ({}), fusionMaterialName: () => '' } });
  assert.equal(g.upgradeChange('power'), '공통 공격력 14 → 17.08');
  assert.ok(g.upgradeChange('nova').startsWith('새 무기 · 충격파 반경 '));
  assert.ok(!g.upgradeChange('burst').includes('0% →'));
  run.up.nova = 2; assert.ok(/충격파 반경 \d+ → \d+/.test(g.upgradeChange('nova')));
  run.choices = ['power', 'nova']; const html = createModalContent({ sessionState: s, view: { mode: 'levelup' }, growthMetrics: g, route: () => null }).buildModal();
  assert.equal((html.match(/class="option-change"/g) || []).length, 2); assert.ok(html.includes('weapon-icon'));
});

test('icon SVG is valid XML for the in-game strip: no element repeats an attribute', async () => {
  const { weaponSvgPaths } = await import('../src/ui/weapon-icons.js');
  for (const [id, paths] of Object.entries(weaponSvgPaths))
    for (const tag of paths.match(/<[a-z]+[^>]*>/g)) {
      const names = [...tag.matchAll(/\s([a-z-]+)="/g)].map(m => m[1]);
      assert.equal(new Set(names).size, names.length, `${id}: ${tag}`);
    }
});
