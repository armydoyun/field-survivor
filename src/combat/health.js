import { HURT_TIME, RECOVERY_DELAY, CORE_SHIELD, CORE_THRESHOLD, GUARDIAN_YIELD } from '../core/config.js';
import { hasRelic } from '../world/effects.js';
import { armorScale, wardRadius } from './rules.js';

// State changes only; UI, storage and combat orchestration belong to the caller.

function commitPlayerHit(r,amount,profile){
  const p=r.player;if(p.hurt>0||p.hp<=0||r.time<r.invulnUntil)return null;
  const dealt=Math.max(1,Math.round(amount*armorScale(profile,r)));
  if(r.finalStep<2)r.director.hits++;p.hp=Math.max(0,p.hp-dealt);p.hurt=HURT_TIME;r.recoveryUntil=r.time+RECOVERY_DELAY;
  const stopped=hasRelic('clockwork',r)&&r.time>=r.relicCooldown;if(stopped){r.relicFreezeUntil=r.time+1.5;r.relicCooldown=r.time+14;}return {dealt,stopped};
}

// The caller checks full target eligibility before core initialization; do not repeat that check afterward.
function commitEnemyHit(r,enemy,amount,corePhase){
  if(enemy.hp<=0||enemy.kind===3&&enemy.phase===3)return null;
  // A live ward protects regular enemies; it never protects bosses or other wards.
  if(enemy.kind!==3&&enemy.kind!==8&&r.enemies.some(e=>e.kind===8&&e.hp>0&&(e.x-enemy.x)**2+(e.y-enemy.y)**2<=wardRadius(e)**2))amount*=enemy.elite?.82:.7;
  if(enemy.kind===3)amount*=enemy.phase===4?1.3:enemy.phase===1||enemy.phase===2?.82:1;
  if(enemy.final&&corePhase===0)amount=Math.min(amount,Math.max(0,enemy.hp-enemy.maxHp*CORE_SHIELD));
  if(enemy.kind!==3&&!enemy.coreNode&&r.finalStep<2){if(enemy.combatAt==null)enemy.combatAt=r.time;r.director.damage+=Math.max(0,Math.min(amount,enemy.hp));}
  enemy.hp-=amount;enemy.flash=.11;let choice=null;
  if(enemy.final&&enemy.hp<=enemy.maxHp*CORE_THRESHOLD){enemy.hp=Math.max(1,enemy.hp);enemy.phase=3;r.finalStep=3;choice='finalchoice';}
  else if(enemy.kind===3&&enemy.named&&enemy.hp<=0){enemy.hp=0;enemy.phase=3;r.bossChoiceId=enemy.id;enemy.yieldUntil=r.time+GUARDIAN_YIELD;enemy.yieldStill=0;}
  return {amount,choice};
}

export { commitPlayerHit, commitEnemyHit };
