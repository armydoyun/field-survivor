import { canInteractInWorld } from '../core/view-policy.js';
import { echoes, fronts } from '../data/world.js';
import { RUN_END, ENEMY_LIMIT } from '../core/config.js';
import { movementVector } from '../input/movement.js';

export function createEncounters({ sessionState, view, platform, session, storage, screen, decisions, feedback, difficulty, enemyRuntime }) {
  const { keys } = platform;

  function spawnEcho() {
    if (!sessionState.run || sessionState.run.echoStep >= echoes.length) return;
    const e = echoes[sessionState.run.echoStep]; if (sessionState.run.time < e.at) return;
    if (sessionState.run.echoSite && sessionState.run.time >= (echoes[sessionState.run.echoStep + 1]?.at || RUN_END)) { finishEcho('silent'); return; }
    if (!sessionState.run.echoSite) {
      if (!sessionState.run.echoSeed[e.id]) sessionState.run.echoSeed[e.id] = e.id === 'witness' ? (sessionState.run.npc.state === 'taken' ? 'taken' : sessionState.run.npc.state === 'heard' ? 'heard' : 'none') : e.id === 'guardian' ? (sessionState.run.guardianOrder === 'spare' ? 'spared' : sessionState.run.guardianOrder === 'end' ? 'ended' : 'none') : Object.values(sessionState.run.objectiveOutcomes).includes('complete') ? 'rescued' : 'none';
      const a = sessionState.run.echoStep * 2.2 + 0.8, p = sessionState.run.player;
      sessionState.run.echoSite = { id: e.id, x: p.x + Math.cos(a) * 230, y: p.y + Math.sin(a) * 230 };
      session.record(`기억의 잔향 · ${e.name}이 나타났다. 과거의 선택을 다시 마주할 수 있다.`); storage.save();
    }
  }

  function meetEcho() {
    if (!canInteractInWorld(view) || !sessionState.run?.echoSite || Math.hypot(sessionState.run.player.x - sessionState.run.echoSite.x, sessionState.run.player.y - sessionState.run.echoSite.y) > 72) return false;
    sessionState.run.echoPending = true; keys.clear(); screen.setMode('echo'); storage.save(); return true;
  }

  function finishEcho(choice){
    if((choice!=='silent'&&view.mode!=='echo')||!decisions.finishEcho(choice))return false;
    if(choice!=='silent')feedback.popup(sessionState.run.player.x,sessionState.run.player.y-45,choice==='keep'?'MEMORY RESTORED':'MEMORY CONVERTED','#b9cddd');
    if(view.mode==='echo')screen.setMode('playing');storage.save();return true;
  }

  function spawnFront() {
    const f = fronts[sessionState.run.frontStep]; if (!f || sessionState.run.time < f.at) return;
    if (sessionState.run.front && sessionState.run.time >= f.at + 180) { resolveFront('silent'); return; }
    if (sessionState.run.front) return;
    if (sessionState.run.time >= f.at + 180) { sessionState.run.front = { id: f.id, x: sessionState.run.player.x, y: sessionState.run.player.y }; resolveFront('silent'); return; }
    const p = sessionState.run.player;
    sessionState.run.front = { id: f.id, x: p.x, y: p.y + (sessionState.run.frontStep % 2 ? 155 : -155) };
    session.record(`전선 교차 · ${f.title}. 두 송신기가 서로 다른 주파수로 울린다. E · 접속`); storage.save();
  }

  function resolveFront(choice){
    if(!decisions.resolveFront(choice))return false;
    if(choice!=='silent'){feedback.popup(sessionState.run.player.x,sessionState.run.player.y-48,'PATH RECORDED','#a7d9db');feedback.ring(sessionState.run.player.x,sessionState.run.player.y,54,'#a7d9db',.35);}
    storage.save();return true;
  }

  function meetFront() {
    if (!canInteractInWorld(view) || !sessionState.run?.front) return false;
    const p = sessionState.run.player, f = sessionState.run.front;
    for (const [i,dx] of [[0,-150],[1,150]]) if ((p.x - f.x - dx) ** 2 + (p.y - f.y) ** 2 < 64 ** 2) return resolveFront(fronts[sessionState.run.frontStep].paths[i].id);
    return false;
  }

  function spawnTacticalWave(wave,intercept=false) {
    if (sessionState.run.time < 600 || sessionState.run.finalStep >= 2) return;
    const p = sessionState.run.player, mode = intercept || sessionState.run.time >= 1800 ? 'cross' : sessionState.run.time >= 1200 ? (sessionState.run.echoOutcomes.guardian === 'keep' || sessionState.run.guardianFate.spare > sessionState.run.guardianFate.end ? 'line' : 'cross') : wave % 2 ? 'line' : 'arc';
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

  return { spawnEcho, meetEcho, finishEcho, spawnFront, meetFront, spawnTacticalWave };
}
