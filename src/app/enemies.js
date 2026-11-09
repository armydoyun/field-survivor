import { runRandom } from '../core/random.js';
import { createEnemySpawner } from '../combat/spawner.js';
import { createHostileAttacks } from '../combat/hostile-attacks.js';
import { movementVector } from '../input/movement.js';
import { createGuardians } from '../combat/guardians.js';
import { createCoreBoss } from '../combat/core-boss.js';
import { createEnemyBehavior } from '../combat/enemies.js';

export function createEnemyRuntime({ sessionState, platform, cameraView, difficulty, combat, statistics, feedback, inspector }) {
  const { keys } = platform;

  function spawnFinalCore(){return coreBoss.spawnFinalCore(sessionState.run,sessionState.profile);}

  function spawnEnemy(kind=-1){return enemySpawner.spawnEnemy(sessionState.run,kind,cameraView.camera);}

  function promoteElite(e){return enemySpawner.promoteElite(sessionState.run,e);}

  function placeOffscreen(e){return enemySpawner.placeOffscreen(sessionState.run,e,cameraView.camera);}

  function moveEnemy(e,dt){return enemyBehavior.moveEnemy(sessionState.run,sessionState.profile,e,dt);}

  function ensureCore(){return coreBoss.ensureCore(sessionState.run,sessionState.profile);}

  function shotScaleFor(e){return hostileAttacks.shotScaleFor(sessionState.run,e);}

  function tickHazards(){return hostileAttacks.tickHazards(sessionState.run);}

  const enemySpawner=createEnemySpawner({random:()=>runRandom(sessionState.run),paceAt:(...args) => difficulty.paceAt(...args),pressureProfile:(...args) => difficulty.pressureProfile(...args),enemyHealthScale:(...args) => difficulty.enemyHealthScale(...args),lateCombat:(...args) => difficulty.lateCombat(...args)});

  const hostileAttacks=createHostileAttacks({inspector,lateCombat:(...args) => difficulty.lateCombat(...args),pressureProfile:(...args) => difficulty.pressureProfile(...args),hurtPlayer:(...args) => combat.hurtPlayer(...args)});

  const movement=()=>movementVector(keys), spawnForRun=(r,kind)=>enemySpawner.spawnEnemy(r,kind,cameraView.camera);

  const guardians=createGuardians({random:()=>runRandom(sessionState.run),attacks:hostileAttacks,movementVector:movement,hurtPlayer:(...args) => combat.hurtPlayer(...args)});

  const coreBoss=createCoreBoss({spawnEnemy:spawnForRun,finalRating:(...args) => difficulty.finalRating(...args),hurtPlayer:(...args) => combat.hurtPlayer(...args)});

  const enemyBehavior=createEnemyBehavior({random:()=>runRandom(sessionState.run),stats:(...args) => statistics.stats(...args),paceAt:(...args) => difficulty.paceAt(...args),movementVector:movement,spawnEnemy:spawnForRun,moveGuardian:guardians.moveGuardian,moveCore:coreBoss.moveCore,attacks:hostileAttacks,ring:(...args) => feedback.ring(...args),hurtPlayer:(...args) => combat.hurtPlayer(...args)});

  return { spawnFinalCore, spawnEnemy, promoteElite, placeOffscreen, moveEnemy, ensureCore, shotScaleFor, tickHazards, guardians };
}
