import { weaponNames, weaponIcons } from '../data/weapons.js';
import { skillColors } from '../data/visuals.js';
import { escapeHtml } from './html.js';
export function weaponLabel(id,fallback=id){return weaponNames[id]?`<span class="weapon-identity" style="color:${skillColors[id]?.[0]||'#f7d989'}"><span aria-hidden="true">${weaponIcons[id]}</span> ${weaponNames[id]}</span>`:escapeHtml(fallback);}
