import { runRandom } from '../core/random.js';
import { hasRelic } from '../world/effects.js';
import { spawnDeathChildren, spawnDeathBurst, commitEnemyDeath } from './death.js';
import { commitRepeatedHealing } from './recovery.js';
import { commitPlayerHit, commitEnemyHit } from './health.js';
import { targetable } from './rules.js';
import { pushEnemy } from './control.js';

export function createCombat({ sessionState, statistics, enemyRuntime, feedback, difficulty, progression, onEnemyDying, onEnemyKilled, onChoice, inspector }) {
  function spawnDeathAttacks(enemy,burstDepth){
    spawnDeathChildren(sessionState.run,enemy,enemyRuntime.spawnEnemy);const s=statistics.stats();
    spawnDeathBurst(sessionState.run,enemy,burstDepth,s.burst,()=>statistics.weaponDamage('burst',s),()=>runRandom(sessionState.run));
  }

  function healRepeated(amount,maxHp=statistics.stats().maxHp){return commitRepeatedHealing(sessionState.run,amount,maxHp);}

  function hurtPlayer(amount,r=sessionState.run){const hit=commitPlayerHit(r,amount,sessionState.profile);if(hit)feedback.showPlayerHit(hit);}

  let relicPulseBusy = false;

  function killEnemy(enemy,burstDepth=0,rewardMultiplier=1){
    onEnemyDying(enemy);commitEnemyDeath(sessionState.run,enemy);progression.rewardKill(enemy,difficulty.rewardXp(enemy),rewardMultiplier);feedback.showEnemyDeath(enemy);
    if(hasRelic('ember',sessionState.run)&&sessionState.run.kills%12===0&&!relicPulseBusy){
      relicPulseBusy=true;const s=statistics.stats(),radius=170;inspector?.circle(sessionState.run.player.x,sessionState.run.player.y,radius,'ember');feedback.ring(sessionState.run.player.x,sessionState.run.player.y,radius,'#d9c6b6',.36,'ember');
      for(const e of sessionState.run.enemies)if(targetable(e,sessionState.run)&&Math.hypot(e.x-sessionState.run.player.x,e.y-sessionState.run.player.y)<=radius+e.radius)damage(e,s.damage*1.4);
      relicPulseBusy=false;feedback.popup(sessionState.run.player.x,sessionState.run.player.y-38,'EMBER','#f5c8a8');
    }
    onEnemyKilled(enemy);spawnDeathAttacks(enemy,burstDepth);
  }

  function damage(enemy,amount,crit=false,vx=0,vy=0,burstDepth=0){
    if(!targetable(enemy,sessionState.run))return;const hit=commitEnemyHit(sessionState.run,enemy,amount,enemy.final?enemyRuntime.ensureCore().phase:null);if(!hit)return;
    inspector?.hit(enemy,hit.amount||0);if(hit.choice){onChoice(hit.choice);return;}
    if(vx||vy)pushEnemy(enemy,enemy.x-vx,enemy.y-vy,6);feedback.showEnemyHit(enemy,hit.amount,crit);if(enemy.hp<=0&&!(enemy.kind===3&&enemy.phase===3))killEnemy(enemy,burstDepth);
  }

  return { healRepeated, hurtPlayer, killEnemy, damage };
}
