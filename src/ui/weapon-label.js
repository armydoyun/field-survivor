import { weaponNames, weaponIcons } from '../data/weapons.js';
import { skillColors } from '../data/visuals.js';
import { escapeHtml } from './html.js';

// 무기 이름 글자색: 스킬 색(밝은 파스텔)을 본문 글자색과 섞어 밝은 배경에서도 읽히게 한다.
// 스킬 색 40% + 본문색 60% → 흰 배경 대비 4.6 ~ 5.3:1(WCAG AA 4.5 이상), 색감은 살짝 남는다.
export const LABEL_TINT = Object.freeze({ base: '#23303b', amount: .4 });
const channels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export function labelColor(hex) {
  const base = channels(LABEL_TINT.base), color = channels(hex);
  return '#' + color.map((v, i) => Math.round(v * LABEL_TINT.amount + base[i] * (1 - LABEL_TINT.amount)).toString(16).padStart(2, '0')).join('');
}

export function weaponLabel(id,fallback=id){return weaponNames[id]?`<span class="weapon-identity" style="color:${labelColor(skillColors[id]?.[0]||'#f7d989')}"><span aria-hidden="true">${weaponIcons[id]}</span> ${weaponNames[id]}</span>`:escapeHtml(fallback);}
