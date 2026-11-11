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
