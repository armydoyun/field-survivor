import { RECOVERY_FACTOR } from '../core/config.js';

const recoveryScale = (r) => r && r.time < (r.recoveryUntil || 0) ? RECOVERY_FACTOR : 1;

function commitRepeatedHealing(r,amount,maxHp){const p=r.player;if(p.hp<=0)return 0;const healed=Math.max(0,Math.min(maxHp-p.hp,amount*recoveryScale(r)));p.hp+=healed;return healed;}

export { recoveryScale, commitRepeatedHealing };
