import { keystones } from '../data/progression.js';
import { relics } from '../data/world.js';

const legacyEffect = (origin, choice, r) => r?.legacyOrigin === origin && r?.legacyChoice === choice;

const frontOption = (f, id) => f.paths.find(p => p.id === id);

const frontEffect = (id, choice, r) => r?.frontChoices?.[id] === choice;

const relicChoices = siteId => relics.filter(item => item.site === siteId);

const hasRelic = (id, r) => !!r?.relics?.includes(id);

const anomalyActive = (id, choice, r) => !!r && r.anomalyChoices?.[id] === choice && (id === 'echo' || r.time < (r.anomalyUntil?.[id] || 0));

const clockFrozen = r => anomalyActive('clock', 'hold', r) && r.time % 12 < 2;

export { legacyEffect, frontOption, frontEffect, relicChoices, hasRelic, anomalyActive, clockFrozen };

export function keystoneScale(type,r){const id=r?.journey?.keystone;const k=keystones.find(x=>x.id===id);if(!k?.weapons.includes(type))return 1;return id==='drift'?(r.momentumTime>0?1.2:.9):1.2;}

export const episodeTitle = kind => ({relay:'움직이는 중계',gates:'엇갈린 좌표',hunt:'추적하는 잔해'})[kind];
