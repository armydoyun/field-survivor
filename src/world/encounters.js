import { ENEMY_LIMIT } from '../core/config.js';
import { movementVector } from '../input/movement.js';

// 10:00 이후 전술 웨이브. (기억의 잔향 · 전선 교차는 서사 재설계 5단계에서 제거했다.)
export function createEncounters({ sessionState, platform, feedback, difficulty, enemyRuntime }) {
  const { keys } = platform;

  function spawnTacticalWave(wave,intercept=false) {
    if (sessionState.run.time < 600 || sessionState.run.finalStep >= 2) return;
    const p = sessionState.run.player, mode = intercept || sessionState.run.time >= 1800 ? 'cross' : sessionState.run.time >= 1200 ? (sessionState.run.guardianFate.spare > sessionState.run.guardianFate.end ? 'line' : 'cross') : wave % 2 ? 'line' : 'arc';
    const members = intercept ? [7,5,7,9,10,8] : mode === 'line' ? [8,2,0,0] : mode === 'arc' ? [6,1,6,1] : [9,1,9,6,8,2];
    const cap = Math.min(ENEMY_LIMIT, difficulty.paceAt(sessionState.run.time).cap);
    if (sessionState.run.enemies.length + members.length > cap) return;
    if (!intercept && members.includes(8) && sessionState.run.enemies.filter(e => e.kind === 8 && e.hp > 0).length >= 4) return;
    const v=movementVector(keys),a=intercept&&(v.x||v.y)?Math.atan2(v.y,v.x):wave*1.618,nx=Math.cos(a),ny=Math.sin(a),tangentX=-ny,tangentY=nx,spawned=[];
    members.forEach((kind,i) => {if(intercept&&sessionState.run.enemies.filter(e=>e.hp>0&&e.kind===kind).length>=({7:10,9:5,10:3,8:4}[kind]||165))return;const e = enemyRuntime.spawnEnemy(kind), distance = mode === 'line' ? 660 - i * 38 : mode === 'arc' ? 640 : 650;
      const flank = mode === 'line' ? 0 : mode === 'arc' ? (i - 1.5) * 85 : (i - 2.5) * 98;
      e.x = p.x + nx * distance + tangentX * flank; e.y = p.y + ny * distance + tangentY * flank;if(intercept&&sessionState.run.time>=1380&&i%2===0)enemyRuntime.promoteElite(e);spawned.push(e);
    });
    for(const e of spawned)enemyRuntime.placeOffscreen(e);
    feedback.popup(p.x,p.y-75, mode === 'line' ? 'GUARDED COLUMN' : mode === 'arc' ? 'FLANKING FRONT' : 'CROSSFIRE FRONT', '#e4c4ab');
  }

  return { spawnTacticalWave };
}
