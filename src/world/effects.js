import { keystones } from '../data/progression.js';
import { relics } from '../data/world.js';

const relicChoices = siteId => relics.filter(item => item.site === siteId);

const hasRelic = (id, r) => !!r?.relics?.includes(id);

const anomalyActive = (id, choice, r) => !!r && r.anomalyChoices?.[id] === choice && (id === 'echo' || r.time < (r.anomalyUntil?.[id] || 0));

const clockFrozen = r => anomalyActive('clock', 'hold', r) && r.time % 12 < 2;

export { relicChoices, hasRelic, anomalyActive, clockFrozen };

export function keystoneScale(type,r){const id=r?.journey?.keystone;const k=keystones.find(x=>x.id===id);if(!k?.weapons.includes(type))return 1;return id==='drift'?(r.momentumTime>0?1.2:.9):1.2;}

export const episodeTitle = kind => ({relay:'움직이는 중계',gates:'엇갈린 좌표',hunt:'추적하는 잔해'})[kind];
