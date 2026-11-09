import { enemyType } from '../data/enemies.js';
import { dropXp, reserveXp } from './experience.js';

const rewardGold = enemy => enemyType[enemy.kind].gold * (enemy.elite ? 3 : 1);

const rewardXp = (enemy,{time,paceXp,harvest}) => Math.round(enemyType[enemy.kind].xp * (enemy.elite ? 3 : 1) * paceXp * (1 + .25*Math.min(1,Math.max(0,time-180)/600)) * (harvest ? 1.3 : 1) * (enemy.xpScale ?? 1));

function grantKillLoot(r,enemy,gold,xp){
  r.gold+=gold;const bonus=Math.min(r.xpReserve,5000);
  if(dropXp(r,enemy.x,enemy.y,xp+bonus))r.xpReserve-=bonus;else reserveXp(r,xp);
}

export { rewardGold, rewardXp, grantKillLoot };
