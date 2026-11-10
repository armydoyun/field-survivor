import { n, integer } from '../core/utils.js';
import { enemyType, guardianPatterns } from '../data/enemies.js';
import { setPush, refreshSlow } from '../combat/control.js';
import { weaponConsumed } from '../growth/build.js';
import { GUARDIAN_YIELD, GUARDIAN_STILL } from '../core/config.js';

const eliteKinds=['boost','leap','brood','cast'];

const restoreEliteAttack=a=>a&&eliteKinds.includes(a.kind)?{kind:a.kind,x:n(a.x),y:n(a.y),sx:n(a.sx),sy:n(a.sy),elapsed:n(a.elapsed,0,0,5),warn:n(a.warn,1,.7,1.5),duration:n(a.duration,.5,.1,2),fired:!!a.fired}:null;

const restoreGuardianAttack = a => a && guardianPatterns.includes(a.kind) ? {kind:a.kind,x:n(a.x),y:n(a.y),angle:n(a.angle,0,-100,100),step:integer(a.step,0,0,8),clock:n(a.clock,0,-1,5)} : null;

export function restoreCombat(r,raw){
  const yielding = e => e.kind === 3 && e.phase === 3 && e.hp === 0 && e.id === r.bossChoiceId && !e.final;
  r.enemies = raw.enemies.slice(0, 240).filter(e => e && Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp) && (e.hp > 0 || e.hp === 0 && e.kind === 3 && e.phase === 3 && e.id === r.bossChoiceId && !e.final)).map(e => ({ id: integer(e.id, 0), kind: integer(e.kind, 0, 0, enemyType.length - 1), x: n(e.x), y: n(e.y), hp: n(e.hp, 1, e.kind === 3 && e.phase === 3 && e.id === r.bossChoiceId && !e.final ? 0 : 1, 1e6), maxHp: n(e.maxHp, 20, 1, 1e6), speed: n(e.speed, 50, 1, 250), radius: n(e.radius, 12, 5, 42), xpScale:n(e.xpScale,1,.5,1), combatAt:Number.isFinite(e.combatAt)?n(e.combatAt,0,0,r.time):null, actionSeen:e.actionSeen===true, orbitHitAt: n(e.orbitHitAt, 0, 0, 1e7), slowUntil: n(e.slowUntil, 0, 0, 1e7), slowAmount: n(e.slowAmount, 0, 0, 0.65), slowEffects: Array.isArray(e.slowEffects) ? e.slowEffects.slice(0, 16).filter(x => x && Number.isFinite(x.amount) && Number.isFinite(x.until)).map(x => ({ amount: n(x.amount, 0, 0, .65), until: n(x.until, 0, 0, 1e7) })) : [], phase: integer(e.phase, 0, 0, e.kind === 3 ? 4 : 2), ...(e.kind === 3 ? { bossCycle: integer(e.bossCycle,0,0,999999), guardianAttack: restoreGuardianAttack(e.guardianAttack), lastAttack: guardianPatterns.includes(e.lastAttack)?e.lastAttack:'', ...(e.final ? {} : yielding(e) ? { named: true, yieldUntil: n(e.yieldUntil, r.time + GUARDIAN_YIELD, r.time, r.time + GUARDIAN_YIELD), yieldStill: n(e.yieldStill, 0, 0, GUARDIAN_STILL) } : e.named === true ? { named: true } : { hollow: true }) } : {}), aiTimer: n(e.aiTimer, 1.5, 0, 10), dx: n(e.dx, 0, -1, 1), dy: n(e.dy, 0, -1, 1), pushX: n(e.pushX,0,-120,120), pushY: n(e.pushY,0,-120,120), flash: 0, elite: e.elite === true, shotScale:Number.isFinite(e.shotScale)?n(e.shotScale,1,.5,2):undefined, eliteClock:n(e.eliteClock,3,0,15), eliteCasts:integer(e.eliteCasts,0,0,2), eliteAttack:e.elite===true&&e.kind!==3&&!e.coreNode?restoreEliteAttack(e.eliteAttack):null, markX: n(e.markX,e.x), markY: n(e.markY,e.y), coreNode: e.coreNode === true && e.kind === 8, final: e.final === true && e.kind === 3 }));
  r.hazards=(Array.isArray(raw.hazards)?raw.hazards:[]).slice(0,6).filter(h=>h&&Number.isFinite(h.x)&&Number.isFinite(h.y)&&r.enemies.some(e=>e.id===h.sourceId&&e.hp>0)).map(h=>({sourceId:integer(h.sourceId),boss:h.boss===true,x:n(h.x),y:n(h.y),radius:n(h.radius,48,20,h.shape==='ring'?190:60),shape:['ring','beam'].includes(h.shape)?h.shape:undefined,angle:n(h.angle,0,-100,100),turn:n(h.turn,0,-Math.PI/3,Math.PI/3),length:n(h.length,260,60,290),width:n(h.width,20,16,20),gap:n(h.gap,Math.PI*.4,.8,1.6),fireAt:n(h.fireAt,r.time,0,r.time+3),endAt:n(h.endAt,r.time,0,r.time+6),damage:n(h.damage,12,1,20)})).filter(h=>h.endAt>h.fireAt&&h.endAt>r.time);
  for(const e of r.enemies)setPush(e,e.kind===3?0:e.pushX,e.kind===3?0:e.pushY);
  for (const e of r.enemies) refreshSlow(e, r.time);
  r.nextId = Math.max(r.nextId, ...r.enemies.map(e => e.id + 1), 1);
  if (r.objective?.id === 'hunter' && r.objective.phase && !r.enemies.some(e => e.id === r.objective.targetId && e.kind === 8)) r.objective = null;
  if (!r.enemies.some(e => e.id === r.bossChoiceId && e.kind === 3 && e.phase === 3)) r.bossChoiceId = 0;
  r.shots = raw.shots.slice(0, 250).filter(s => s && !weaponConsumed(s.kind,r) && ['pulse','burst','lance','mirror','beacon'].includes(s.kind) && Number.isFinite(s.x) && Number.isFinite(s.y)).map(s => ({ kind: ['pulse','burst','lance','mirror','beacon'].includes(s.kind) ? s.kind : 'pulse', burstDepth: integer(s.burstDepth, 0, 0, 2), x: n(s.x), y: n(s.y), vx: n(s.vx, 0, -1000, 1000), vy: n(s.vy, 0, -1000, 1000), damage: n(s.damage, 5, 0, 1e6), crit: !!s.crit, aux: s.aux === true, radius: n(s.radius, 4, 1, 25), cold: s.cold === true, life: n(s.life, 0, 0, 3), pierce: integer(s.pierce, 1, 0, 11), hit: Array.isArray(s.hit) ? s.hit.filter(Number.isInteger).slice(0, 11) : [] }));
  r.bullets = (Array.isArray(raw.bullets) ? raw.bullets : []).slice(0, 100).filter(b => b && Number.isFinite(b.x) && Number.isFinite(b.y)).map(b => ({ x: n(b.x), y: n(b.y), vx: n(b.vx, 0, -500, 500), vy: n(b.vy, 0, -500, 500), radius: n(b.radius, 5, 2, 12), damage: n(b.damage, 10, 1, 100), life: n(b.life, 2, 0, 6), boss: b.boss === true,kind:['return','arc'].includes(b.kind)?b.kind:undefined,age:n(b.age,0,0,6),turn:n(b.turn,0,-1.1,1.1) }));
}

export function restorePickups(r,raw){
  r.pickups = (Array.isArray(raw.pickups) ? raw.pickups : []).slice(0, 32).filter(q => q && ['magnet','heal','shield'].includes(q.type) && Number.isFinite(q.x) && Number.isFinite(q.y)).slice(0, 2).map(q => ({ type: q.type, x: n(q.x, 0, -1e7, 1e7), y: n(q.y, 0, -1e7, 1e7), life: n(q.life, 60, 0.1, 100) }));
}
