import { runRandom } from '../core/random.js';
import { ENEMY_LIMIT } from '../core/config.js';
import { tacticalKind } from './rules.js';

const burstChance = level => level > 0 ? Math.min(.75,.125+level*.125) : 0;

function commitEnemyDeath(r,enemy){
  enemy.hp=0;r.kills++;if(enemy.kind!==3&&!enemy.coreNode&&r.finalStep<2){const d=r.director;d.kills++;if(tacticalKind(enemy.kind)||enemy.elite){d.specialKills++;d.lifeSum+=Math.max(0,r.time-(enemy.combatAt??r.time));if(enemy.actionSeen||enemy.phase===1||enemy.phase===2||enemy.eliteAttack)d.specialActed++;}}
}

// Entity creation stays with the spawner; this owns child placement and inherited death rules.
function spawnDeathChildren(r,enemy,spawnEnemy){
  if(enemy.kind===6)for(const offset of(enemy.elite?[-18,0,18]:[-12,12])){if(r.enemies.length>=ENEMY_LIMIT)break;const child=spawnEnemy(1);child.x=enemy.x+offset;child.y=enemy.y-offset;child.hp=child.maxHp=9;child.radius=8;child.speed+=22;}
}

// Evaluate damage only for emitted fragments, after the chance roll and within the projectile cap.
function spawnDeathBurst(r,enemy,burstDepth,level,getDamage,random=()=>runRandom(r)){
  if(level&&burstDepth<2&&random()<burstChance(level))for(let i=0;i<6&&r.shots.length<250;i++){const a=i*Math.PI/3;r.shots.push({x:enemy.x,y:enemy.y,vx:Math.cos(a)*280,vy:Math.sin(a)*280,kind:'burst',burstDepth:burstDepth+1,damage:getDamage(),crit:false,radius:3.2,life:.55,pierce:1,hit:[enemy.id]});}
}

export { commitEnemyDeath, spawnDeathChildren, spawnDeathBurst, burstChance };
