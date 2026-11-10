import { canInteractInWorld } from '../core/view-policy.js';
import { runRandom } from '../core/random.js';
import { objectives } from '../data/world.js';
import { ENEMY_LIMIT } from '../core/config.js';

// 붕괴된 중계기 동기화(v3.0 완화): 경합 중 진행 속도, 떠났을 때 풀리는 속도, 증원 간격(초).
export const RELAY = Object.freeze({ contested: .35, decay: .4, reinforce: 12 });
import { enemyType } from '../data/enemies.js';

export function createObjectives({ sessionState, view, progression, feedback, session, storage, enemyRuntime, difficulty, screen }) {
  function resolveKillObjective(enemy){if(enemy.id===sessionState.run.objective?.targetId&&sessionState.run.objective.id==='hunter'&&sessionState.run.objective.phase)closeObjective(true);}

  function closeObjective(success) {
    const o = sessionState.run?.objective, task = o && objectives[sessionState.run.objectiveStep]; if (!task || o.id !== task.id) return false;
    sessionState.run.objective = null; sessionState.run.objectiveStep++; sessionState.profile.memory.objectives[task.id][success ? 'complete' : 'failed']++; sessionState.run.objectiveOutcomes[task.id] = success ? 'complete' : 'failed';
    if (success) { sessionState.run.gold += task.gold; progression.collect(task.xp); feedback.popup(sessionState.run.player.x, sessionState.run.player.y - 48, 'OBJECTIVE CLEAR', '#a3e5d3'); }
    else {
      feedback.popup(sessionState.run.player.x, sessionState.run.player.y - 48, 'SIGNAL LOST', '#e8b7a0');
      // 놓친 표적은 신호와 함께 물러난다. 강화된 정예가 판 끝까지 남아 압박하지 않게 한다(보상도 없다).
      const target = o.targetId && sessionState.run.enemies.find(e => e.id === o.targetId && e.hp > 0);
      if (target) { feedback.burst(target.x, target.y, '#e8b7a0', 10); target.hp = 0; sessionState.run.enemies = sessionState.run.enemies.filter(e => e !== target); }
    }
    session.record(`작전 · ${task.name} · ${success ? `완수 +${task.gold}G / EXP ${task.xp}` : '신호 소실'}`); storage.save(); return true;
  }

  function ignoreObjective(task) {
    sessionState.run.objective = null; sessionState.run.objectiveOutcomes[task.id] = 'ignored'; sessionState.profile.memory.objectives[task.id].ignored++;
    sessionState.run.objectiveStep++; session.record(`작전 미응답 · ${task.name} · 신호가 끊겼다.`); storage.save();
  }

  function spawnObjective() {
    if (!sessionState.run || sessionState.run.objective || sessionState.run.objectiveStep >= objectives.length) return;
    const task = objectives[sessionState.run.objectiveStep];
    if (sessionState.run.time > task.at + 240) { ignoreObjective(task); return; }
    if (sessionState.run.time < task.at) return;
    const angle = runRandom(sessionState.run) * Math.PI * 2, distance = 300 + runRandom(sessionState.run) * 100, p = sessionState.run.player;
    sessionState.run.objective = { id: task.id, x: p.x + Math.cos(angle) * distance, y: p.y + Math.sin(angle) * distance, phase: 0, progress: 0, left: 0, targetId: 0, reinforceAt: 0 };
    session.record(`작전 신호 · ${task.name} · ${task.brief}`); storage.save();
  }

  function meetObjective() {
    const o = sessionState.run?.objective;
    if (!canInteractInWorld(view) || !o || Math.hypot(sessionState.run.player.x - o.x, sessionState.run.player.y - o.y) > 75) return false;
    if (!o.phase) {
      o.phase = 1; o.left = o.id === 'relay' ? 52 : o.id === 'courier' ? 100 : 100;
      if (o.id === 'relay') o.reinforceAt = sessionState.run.time + 4;
      if (o.id === 'courier') { const angle = runRandom(sessionState.run) * 2 * Math.PI, p = sessionState.run.player; o.x = p.x + Math.cos(angle) * 380; o.y = p.y + Math.sin(angle) * 380; }
      if (o.id === 'hunter') {
        if (sessionState.run.enemies.length < ENEMY_LIMIT) {
          const e = enemyRuntime.promoteElite(enemyRuntime.spawnEnemy(8)); e.hp = enemyType[8].hp*difficulty.paceAt(sessionState.run.time).hp*3; e.maxHp = e.hp; o.targetId = e.id;
          const p = sessionState.run.player, angle = runRandom(sessionState.run) * 2 * Math.PI; e.x = p.x + Math.cos(angle) * 320; e.y = p.y + Math.sin(angle) * 320;
          for (let i = 0; i < 3 && sessionState.run.enemies.length < ENEMY_LIMIT; i++) { const guard = enemyRuntime.spawnEnemy(i === 0 ? 2 : 1); guard.x = e.x + (i - 1) * 44; guard.y = e.y + 30; }
        } else { o.phase = 0; screen.toast('적이 너무 많습니다 · 잠시 후 다시 시도하세요.'); return true; }
      }
      session.record(`작전 개시 · ${objectives[sessionState.run.objectiveStep].name}`); feedback.popup(sessionState.run.player.x, sessionState.run.player.y - 40, 'MISSION START', '#a3e5d3'); storage.save(); return true;
    }
    if (o.id === 'courier') { closeObjective(true); return true; }
    return false; // Other active missions must not swallow E interactions with sites or NPCs.
  }

  function updateObjective(dt) {
    const o = sessionState.run.objective; if (!o) return;
    if (!o.phase) { if (sessionState.run.time > objectives[sessionState.run.objectiveStep].at + 240) ignoreObjective(objectives[sessionState.run.objectiveStep]); return; }
    o.left = Math.max(0, o.left - dt);
    if (o.id === 'relay') {
      const p = sessionState.run.player, near = Math.hypot(p.x - o.x, p.y - o.y) < 115, contested = sessionState.run.enemies.some(e => e.hp > 0 && e.kind !== 3 && Math.hypot(e.x - o.x, e.y - o.y) < 78);
      // v3.0: 적이 장치 곁에 있어도 동기화는 느리게(35%) 이어진다. 장치를 떠나면 천천히 풀린다.
      o.progress = Math.max(0, Math.min(16, o.progress + (near ? (contested ? dt * RELAY.contested : dt) : -dt * RELAY.decay)));
      if (sessionState.run.time >= o.reinforceAt && sessionState.run.enemies.length < ENEMY_LIMIT - 2) {
        const angle = runRandom(sessionState.run) * Math.PI * 2;
        for (let i = 0; i < 2; i++) { const e = enemyRuntime.spawnEnemy(i ? 1 : sessionState.run.time >= 600 ? 7 : 0); e.x = o.x + Math.cos(angle + i * 1.5) * 190; e.y = o.y + Math.sin(angle + i * 1.5) * 190; }
        o.reinforceAt = sessionState.run.time + RELAY.reinforce;
      }
      if (o.progress >= 16) { closeObjective(true); return; }
    }
    if (o.id === 'hunter' && !sessionState.run.enemies.some(e => e.id === o.targetId && e.hp > 0)) { closeObjective(false); return; }
    if (o.left <= 0) closeObjective(false);
  }

  return { resolveKillObjective, closeObjective, spawnObjective, meetObjective, updateObjective };
}
