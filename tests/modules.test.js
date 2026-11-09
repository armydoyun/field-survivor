import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createUpgradeCatalog, upgradeSupports } from '../src/data/upgrades.js';
import { fusionRecipes } from '../src/data/fusions.js';
import { segmentHit, segmentEntry } from '../src/math/geometry.js';
import { n, integer, timeText, clamp } from '../src/core/utils.js';

const root = new URL('../', import.meta.url);
test('unretired data matches the original game; retired fusion data is intentionally excluded', async () => {
  const actual = { ...createUpgradeCatalog(), upgradeSupports };
  for (const name of ['enemies', 'shop', 'specializations', 'fusions', 'world', 'progression', 'visuals']) Object.assign(actual, await import(`../src/data/${name}.js`));
  const expected = JSON.parse(readFileSync(new URL('baseline-data.json', import.meta.url), 'utf8'));
  for(const key of ['upgrades','upgradeFamilies','upgradeDetails','fusionRecipes','fusionRules','fusionColors','fusionSurfaces','branches'])delete expected[key];
  const current=Object.keys(actual).filter(key=>!['upgrades','upgradeFamilies','upgradeDetails','fusionRecipes','fusionRules','fusionRequirements','fusionById','branches'].includes(key));assert.deepEqual(current.sort(),Object.keys(expected).sort());
  for (const [name, value] of Object.entries(actual).filter(([key])=>key in expected)) assert.equal(createHash('sha256').update(JSON.stringify(value)).digest('hex'), expected[name], name);
});
test('base upgrade limits remain unchanged and each new fusion has exactly one growth entry', () => {
  const a = createUpgradeCatalog(), b = createUpgradeCatalog();const baseline=JSON.parse(readFileSync(new URL('baseline-base-catalog.json',import.meta.url),'utf8'));assert.deepEqual(a.upgrades.filter(u=>!u.id.startsWith('fusion_')).map(({id,max})=>({id,max})),baseline.upgrades.map(({id,max})=>({id,max}))); 
  assert.deepEqual(a, b);
  assert.equal(new Set(a.upgrades.map(u => u.id)).size, a.upgrades.length);
  for (const f of fusionRecipes) {
    const id = 'fusion_' + f.id;
    assert.equal(a.upgrades.filter(u => u.id === id).length, 1);
    assert.equal(a.upgradeFamilies[id], f.base ? '상위융합' : '융합');
    assert.equal(a.upgradeDetails[id][0], f.desc);
  }
  a.upgrades[0].name = 'changed'; a.upgradeDetails.power[0] = 'changed'; a.upgradeFamilies.power = 'changed'; a.upgrades.pop();
  assert.deepEqual(createUpgradeCatalog(), b);
});
test('swept circle collision: contact, tangent, misses, zero length and entry order', () => {
  for (const [args, hit, entry] of [
    [[0, 0, 10, 0, 5, 0, 1], true, .4],
    [[0, 0, 10, 0, 5, 1, 1], true, .5],
    [[0, 0, 10, 0, 5, 2, 1], false, Infinity],
    [[0, 0, 10, 0, 12, 0, 1], false, Infinity],
    [[0, 0, 10, 0, -2, 0, 1], false, Infinity],
    [[0, 0, 0, 0, 0, 0, 1], true, 0],
    [[0, 0, 0, 0, 2, 0, 1], false, Infinity],
    [[0, 0, 10, 0, 0, 0, 1], true, 0],
    [[10, 0, 0, 0, 5, 0, 1], true, .4]
  ]) { assert.equal(segmentHit(...args), hit); assert.equal(segmentEntry(...args), entry); }
  assert.ok(segmentEntry(0, 0, 100, 0, 20, 0, 2) < segmentEntry(0, 0, 100, 0, 80, 0, 2));
});
test('number validation, bounds and time formatting preserve edge cases', () => {
  for (const value of [undefined, null, '3', NaN, Infinity, -Infinity]) assert.equal(n(value, 7, 0, 5), 7);
  assert.equal(n(-3, 0, 0, 5), 0); assert.equal(n(9, 0, 0, 5), 5);
  assert.equal(integer(3.9), 3); assert.equal(integer(-1), 0); assert.equal(clamp(12, 0, 10), 10);
  for (const [value, expected] of [[0, '00:00'], [59.9, '00:59'], [60, '01:00'], [1800, '30:00']]) assert.equal(timeText(value), expected);
});
test('every source parses as ESM and relative imports resolve within the source tree', () => {
  const files = readdirSync(new URL('src/', root), { recursive: true }).filter(p => p.endsWith('.js'));
  for (const file of files) {
    const url = new URL('src/' + file, root), source = readFileSync(url, 'utf8');
    const checked = spawnSync(process.execPath, ['--check', fileURLToPath(url)], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr);
    for (const match of source.matchAll(/import\s+(?:[^'";]*?from\s*)?['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('.'), `external runtime dependency: ${file}`);
      assert.ok(readFileSync(new URL(match[1], url)).length > 0);
    }
  }
  assert.match(readFileSync(new URL('index.html', root), 'utf8'), /<script type="module" src="\.\/src\/main\.js"><\/script>/);
});
