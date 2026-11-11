import { restoreRandomState } from '../core/random.js';
import { makeDirector, createRun } from '../core/run.js';
import { n, clamp, integer } from '../core/utils.js';
import { FIRST_GUARDIAN, RECOVERY_DELAY, W, H } from '../core/config.js';
import { createStatistics } from '../core/statistics.js';
import { paceAt } from '../core/difficulty.js';
import { xpNeed, dropXp, reserveXp } from '../growth/experience.js';
import { upgrades } from '../data/upgrades.js';
import { upgradeUseful } from '../growth/cards.js';
import { restoreJourney, restoreWorld } from './restore-world.js';
import { loadouts } from '../data/loadouts.js';
import { restoreLoadout, restoreWeaponStates } from './restore-weapons.js';
import { DRIFT, DRIFT_KINDS } from '../world/drift.js';
import { lastRecordOpen } from '../world/last-record.js';
import { lastRecord } from '../data/world.js';
import { restoreCombat, restorePickups } from './restore-combat.js';

// Explicit saved input and profile; no current session or browser state.
function restoreDirector(raw){const d=makeDirector();for(const k of Object.keys(d))d[k]=n(raw?.[k],0,0,1e7);d.clock=clamp(d.clock,0,6);d.engaged=clamp(d.engaged,0,d.clock);d.value=n(raw?.value,0,0,1);d.actionRate=n(raw?.actionRate,1,0,1);d.specialActed=Math.min(d.specialActed,d.specialKills);return d;}

export function restoreRun(raw,profile) {
  if (!raw || typeof raw !== 'object' || !raw.player || !Array.isArray(raw.enemies) || !Array.isArray(raw.shots) || !Array.isArray(raw.gems)) return null;
  const journey=restoreJourney(raw.journey,n(raw.time,0,0,1e7));if(!journey)return null;
  const statistics=createStatistics({sessionState:{profile,run:null}}),r=createRun(profile,{journey,maxHp:statistics.maxHpFor(null),xpNext:xpNeed(1)}),p=raw.player;r.director=restoreDirector(raw.director);
  r.riftClock = n(raw.riftClock, 2.8, 0, 6); r.beaconClock = n(raw.beaconClock, 3.8, 0, 10); r.ambientClock = n(raw.ambientClock, 8, 0, 20); r.time = n(raw.time, 0, 0, 1e7); r.level = integer(raw.level, 1, 1, 10000); r.xpNext = xpNeed(r.level); r.xp = integer(Number.isFinite(raw.xpNext)&&raw.xpNext>0&&raw.xpNext!==r.xpNext?raw.xp/raw.xpNext*r.xpNext:raw.xp, 0, 0, r.xpNext - 1); r.xpFraction = n(raw.xpFraction, 0, 0, 1 - Number.EPSILON); r.rerolls = integer(raw.rerolls, 0, 0, profile.perks.reroll || 0);
  r.kills = integer(raw.kills); r.gold = integer(raw.gold); r.xpReserve = integer(raw.xpReserve, 0, 0, 1e8); r.nextId = integer(raw.nextId, 1, 1); r.attackClock = n(raw.attackClock, 0, 0, 2); r.spawnClock = n(raw.spawnClock, 0.5, 0, 2); r.nextBoss = n(raw.nextBoss, FIRST_GUARDIAN, FIRST_GUARDIAN, 1e7); r.novaClock = n(raw.novaClock, 2.8, 0, 6); r.chainClock = n(raw.chainClock, 0, 0, 6); r.stage = paceAt(r.time).index; r.lanceClock = n(raw.lanceClock, 1, 0, 10); r.mineClock = n(raw.mineClock, 2.5, 0, 10); r.momentumTime = n(raw.momentumTime, 0, 0, 1); r.waveIndex = r.time < 360 ? 0 : 1 + Math.floor((r.time - 360) / 300); r.orbitGuards = Array.isArray(raw.orbitGuards) ? raw.orbitGuards.slice(0, 5).map(x => n(x, 0, 0, 1e7)) : [];
  restoreLoadout(r,raw);
  restoreWorld(r,raw,profile);
  if (raw.startWeapon !== 'pulse' && loadouts.some(l => l.id === raw.startWeapon)) r.startWeapon = raw.startWeapon;
  if (raw.focusGuardian === true) r.focusGuardian = true;
  if (raw.lastRecord && typeof raw.lastRecord === 'object' && lastRecordOpen(profile.memory)) r.lastRecord = { said: integer(raw.lastRecord.said, 0, 0, lastRecord.words.length) };
  // 표류 구역: 순번 · 다음 생성 시각과 떠 있던 구역(최대 DRIFT.max개)을 이어 간다.
  if (raw.drift && typeof raw.drift === 'object') r.drift = { next: n(raw.drift.next, r.time, 0, 1e7), count: integer(raw.drift.count, 0, 0, 1e6), zones: (Array.isArray(raw.drift.zones) ? raw.drift.zones : []).filter(z => z && DRIFT_KINDS.includes(z.kind ?? 'burn')).slice(0, DRIFT.max).map(z => ({ kind: z.kind ?? 'burn', x: n(z.x, 0, -1e7, 1e7), y: n(z.y, 0, -1e7, 1e7), vx: n(z.vx, 0, -DRIFT.speed, DRIFT.speed), vy: n(z.vy, 0, -DRIFT.speed, DRIFT.speed), radius: DRIFT.radius, liveAt: n(z.liveAt, 0, 0, 1e7), endAt: n(z.endAt, 0, 0, 1e7) })) };
  r.player = { x: n(p.x, W / 2, -1e7, 1e7), y: n(p.y, H / 2, -1e7, 1e7), hp: n(p.hp, 100, 0, 1e7), hurt: n(p.hurt, 0, 0, 2) };
  r.player.hp = Math.min(r.player.hp, statistics.stats(r).maxHp);
  if (r.player.hp <= 0) return null;
  restoreCombat(r,raw);
  r.gems = [];
  for (const g of raw.gems.slice(0, 500)) if (g && Number.isFinite(g.x) && Number.isFinite(g.y)) {
    const xp = integer(g.xp, 3, 1, 1e7), count = integer(g.count, 1, 1, 10000);
    if (!dropXp(r, n(g.x), n(g.y), xp, count)) reserveXp(r,xp*count);
  }
  r.invulnUntil = n(raw.invulnUntil, 0, 0, 1e7); r.recoveryUntil = n(raw.recoveryUntil, 0, 0, r.time + RECOVERY_DELAY);
  r.pickupClock = n(raw.pickupClock, 55, 1, 150);
  restorePickups(r,raw);
  r.pending = integer(raw.pending, 0, 0, 100); r.choices = Array.isArray(raw.choices) ? raw.choices.filter(id => upgradeUseful(id,r)&&upgrades.some(u => u.id === id && r.up[id] < u.max)).slice(0, 3) : null;
  if (!r.pending) r.choices = null;
  restoreWeaponStates(r,raw);
  const rng=restoreRandomState(raw.rng);if(rng)r.rng=rng;
  return r;
}
