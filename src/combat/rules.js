import { CORE_SHIELD } from '../core/config.js';
import { PERK } from '../data/shop.js';

const incomingScale = time => 1 + 0.9 * Math.min(1, Math.max(0, time - 300) / 2100);

const armorScale = (profile, r) => (1 - Math.min(.25,(r?.up.armor || 0)*.04)) * (1 - (profile.perks.armor || 0)*PERK.armor);

const wardRadius=e=>e.elite?135:105;

const tacticalKind=kind=>kind===2||kind>=4;

const targetable = (e,r) => e.hp > 0 && !(e.kind === 3 && e.phase === 3) && !(e.final && r.journey.core?.phase === 0 && e.hp <= e.maxHp*CORE_SHIELD);

export { incomingScale, armorScale, wardRadius, tacticalKind, targetable };
