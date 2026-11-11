import { movePlayer } from '../input/movement.js';
import { branchReady } from '../growth/build.js';
import { tickLastRecord } from '../world/last-record.js';
import { createDrift } from '../world/drift.js';

export function createUpdate({ stoker, sessionState, view, platform, screen, feedback, statistics, difficulty, story, sites, objectives, journey, enemyRuntime, session, weapons, specializations, fusions, combat, collisions, population, pickups, growthActions, progression, finale, inspector, hints }) {
  let lastShields=null,lastDrift=0,driftOwner=null;
  const drift=createDrift({sessionState,combat});
  const { keys } = platform;

  function update(dt) {
    if (!sessionState.run) return;
    inspector?.beginStep();
    if (sessionState.run.relicPending) { screen.setMode('relic'); return; }
    feedback.tickSkillEchoes(dt);const p = sessionState.run.player, s = statistics.stats(); sessionState.run.time += dt;difficulty.directorTick(dt); p.hurt = Math.max(0, p.hurt - dt);
    const moving = movePlayer(sessionState.run,keys,s,dt);
    story.spawnWitness(); sites.spawnSite(); objectives.spawnObjective();
    if (journey.journeyTick(dt)) return;
    if (story.tickWitness(dt,moving)) return;
    story.tickGuardian(dt,moving);stoker?.spawnStoker();stoker?.tickStoker(dt,moving);tickLastRecord(sessionState.profile,sessionState.run);
    hints?.tickHints();
    const shields=sessionState.run.journey.core?.shields;if(shields!=null&&lastShields!=null&&shields<lastShields)feedback.sound?.('shield');lastShields=shields??null;
    population.maintainEnemies();
    objectives.updateObjective(dt);
    population.spawnPopulation(dt);
    sessionState.run.attackClock -= dt; if (sessionState.run.attackClock <= 0 && weapons.fire()) sessionState.run.attackClock = s.interval;
    specializations.specializationTick(dt,s); if(view.mode!=='playing')return; weapons.weaponTick(dt, specializations.legacyWeaponStats(s));
    if (view.mode !== 'playing') return;
    fusions?.fusionTick(dt,s);if(view.mode!=='playing')return;
    collisions.tickEnemies(dt,s);
    if (view.mode !== 'playing') return;
    if (!collisions.tickShots(dt,s)) return;
    enemyRuntime.tickHazards();drift.tickDrift(dt,s);const driftCount=sessionState.run.drift?.count??0;if(driftOwner!==sessionState.run){driftOwner=sessionState.run;lastDrift=driftCount;}if(driftCount>lastDrift)feedback.sound?.('drift');lastDrift=driftCount;
    collisions.tickBullets(dt,s);
    if (p.hp <= 0) { session.finish(); return; } // Collected EXP must not revive a lethal hit.
    // 무기를 내린 감시자(hp 0, bossChoiceId)는 결정이 날 때까지 남긴다.
    sessionState.run.enemies = sessionState.run.enemies.filter(e => e.hp > 0 || e.id === sessionState.run.bossChoiceId);
    progression.tickGems(dt,s.magnet);
    pickups.updatePickups(dt);
    progression.tickAmbientXp(dt);
    feedback.tickCombatFeedback(sessionState.run,dt);
    if (p.hp <= 0) { session.finish(); return; }
    combat.healRepeated(s.regen*dt,s.maxHp);
    if (branchReady(sessionState.run)) screen.setMode('branch'); else if (sessionState.run.pending) growthActions.openUpgrade(); else if (!story.openSignal() && !story.openAnomaly()) finale.openFinale();
  }

  return { update };
}
