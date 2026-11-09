import { runRandom } from '../core/random.js';
import { DESPAWN_RADIUS, RUN_END, ENEMY_LIMIT } from '../core/config.js';

// Population timing, pressure and off-screen retention have one owner.
export function createPopulation({ sessionState, difficulty, enemyRuntime, encounters, feedback, onGuardianSpawned }) {
  function maintainEnemies(){
    const p=sessionState.run.player;
    // Keep guardians in the encounter: relocate off-screen if the player outruns them.
    for (const e of sessionState.run.enemies) if (e.kind === 3 && e.phase !== 3) {
      const x = e.x - p.x, y = e.y - p.y, dist = Math.hypot(x, y);
      if (dist > DESPAWN_RADIUS) { e.x = p.x + x / dist * 620; e.y = p.y + y / dist * 620; }
    }
    sessionState.run.enemies = sessionState.run.enemies.filter(e => e.hp > 0 && (e.kind === 3 || e.id === sessionState.run.objective?.targetId || e.id === sessionState.run.journey.active?.targetId || e.coreNode || (e.x-p.x)**2+(e.y-p.y)**2 < DESPAWN_RADIUS**2));
    if (sessionState.run.objective?.id === 'hunter' && sessionState.run.objective.phase) {
      const target = sessionState.run.enemies.find(e => e.id === sessionState.run.objective.targetId);
      if (target) { const dx = target.x - p.x, dy = target.y - p.y, dist = Math.hypot(dx, dy); if (dist > DESPAWN_RADIUS) { target.x = p.x + dx / dist * 620; target.y = p.y + dy / dist * 620; } }
    }
  }

  function spawnPopulation(dt){
    const p=sessionState.run.player;
    const pace = difficulty.paceAt(sessionState.run.time), wave = sessionState.run.time < 360 ? 0 : 1 + Math.floor((sessionState.run.time - 360) / 300);
    if (sessionState.run.stage !== pace.index) { sessionState.run.stage = pace.index; feedback.popup(p.x, p.y - 60, `PHASE ${pace.index + 1} · ${pace.name}`, '#f4dbac'); }
    if (wave > sessionState.run.waveIndex) { sessionState.run.waveIndex = wave; feedback.popup(p.x, p.y - 82, 'WAVE INCOMING', '#f4bca9'); if (sessionState.run.time >= 600 && sessionState.run.finalStep < 2) encounters.spawnTacticalWave(wave); }
    if(sessionState.run.finalStep<2&&sessionState.run.time>=960&&sessionState.run.time<RUN_END){const start=sessionState.run.time>=1380?1380:960,cadence=sessionState.run.time>=1380?45:60;if(Math.floor((sessionState.run.time-start)/cadence)>Math.floor((sessionState.run.time-dt-start)/cadence))encounters.spawnTacticalWave(100+Math.floor((sessionState.run.time-start)/cadence),true);}
    if (sessionState.run.finalStep < 2 && sessionState.run.time < RUN_END && sessionState.run.time >= sessionState.run.nextBoss) {
      const cadence = sessionState.run.time >= 600 ? 240 : 180;
      if (!sessionState.run.enemies.some(e => e.kind === 3 && e.hp > 0) && sessionState.run.enemies.length < ENEMY_LIMIT - 1) {
        enemyRuntime.spawnEnemy(3); sessionState.run.nextBoss = Math.max(sessionState.run.nextBoss + cadence, sessionState.run.time + 1);
        onGuardianSpawned();
      } else sessionState.run.nextBoss = Math.max(sessionState.run.nextBoss + cadence, sessionState.run.time + cadence);
    }
    sessionState.run.spawnClock -= dt;
    if (sessionState.run.spawnClock <= 0 && sessionState.run.finalStep !== 2) {
      const cap = Math.min(ENEMY_LIMIT, pace.cap), interval = pace.interval / ((pace.surge ? 1.45 : 1)*difficulty.pressureProfile().spawn);
      if (sessionState.run.enemies.length < cap) enemyRuntime.spawnEnemy();
      if (sessionState.run.enemies.length < cap && runRandom(sessionState.run) < pace.extra) enemyRuntime.spawnEnemy();
      sessionState.run.spawnClock = interval;
    }
  }

  return { maintainEnemies, spawnPopulation };
}
