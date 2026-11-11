import { GEM_LIMIT, GEM_KEEP_RADIUS, HARVEST_CAP, HARVEST_RATE } from '../core/config.js';
import { signalReward, witnessReward } from '../data/world-choices.js';
import { PERK } from '../data/shop.js';
import { commitRepeatedHealing } from '../combat/recovery.js';

const xpNeed = level => Math.floor(24 * Math.pow(level, 1.34) * (.78 + .22 * Math.min(1, Math.max(0, level - 1) / 23)));
// 기억한 신호 · 들어 준 기록원은 경험치를 더한다(보존 경로의 성장 축).
const xpBonus=(profile,r)=>1+(r?.up.salvage||0)*.08+(profile.perks.learning||0)*PERK.learning+(r?.signalChoices||[]).filter(x=>x==='hear').length*signalReward.xp+(r?.npc?.state==='heard'?witnessReward.xp:0);
// 수확의 잔은 v3.2부터 경험치를 깎지 않는다(회복만 더한다). 인자는 호출부 호환을 위해 남긴다.
const xpCollectionScale=(profile,r,_harvest)=>xpBonus(profile,r);

function dropXp(r, x, y, xp, count = 1) {
  for (const gem of r.gems) if (gem.xp === xp && (gem.x - x) ** 2 + (gem.y - y) ** 2 < 72 ** 2) { gem.count += count; return true; }
  if (r.gems.length >= GEM_LIMIT) return false;
  r.gems.push({ x, y, xp, count }); return true;
}

function reserveXp(r, xp) { r.xpReserve = Math.min(1e8, r.xpReserve + xp); }

// Each original drop rounds independently, even when several share one drawable gem.
function collectGem(r, profile, gem, harvest, maxHpFor) { for (let i = 0; i < (gem.count || 1); i++) collectXp(r, profile, gem.xp, harvest, maxHpFor); }

function collectXp(r, profile, xp, harvest, maxHpFor) {
  if (harvest) {
    xp *= .75;
    const maxHp = maxHpFor(r), heal = Math.min(xp*.04, r.harvestBudget, Math.max(0,maxHp-r.player.hp));
    commitRepeatedHealing(r,heal,maxHp); r.harvestBudget -= heal;
  }
  const total = xp * xpBonus(profile,r) + (r.xpFraction || 0), gained = Math.floor(total + 1e-9);
  r.xpFraction = Math.max(0,total-gained); r.xp += gained;
  while (r.xp >= r.xpNext) { r.xp -= r.xpNext; r.level++; r.xpNext = xpNeed(r.level); r.pending++; }
}

function collectAllXp(r, profile, harvest, maxHpFor) {
  const orbs = r.gems, reserve = r.xpReserve, total = orbs.reduce((sum,gem) => sum+gem.xp*gem.count,reserve);
  r.gems = []; r.xpReserve = 0;
  for (const gem of orbs) collectGem(r,profile,gem,harvest,maxHpFor);
  if (reserve > 0) collectXp(r,profile,reserve,harvest,maxHpFor);
  return total;
}

function tickGems(r, profile, dt, magnet, harvest, maxHpFor) {
  r.harvestBudget = Math.min(HARVEST_CAP,r.harvestBudget+HARVEST_RATE*dt);
  const p = r.player;
  for (let i = r.gems.length-1; i >= 0; i--) {
    const gem = r.gems[i], x = p.x-gem.x, y = p.y-gem.y, d2 = x*x+y*y;
    if (d2 < 17**2) { collectGem(r,profile,gem,harvest,maxHpFor); r.gems.splice(i,1); }
    else if (d2 > GEM_KEEP_RADIUS**2) { reserveXp(r,gem.xp*gem.count); r.gems.splice(i,1); }
    else if (d2 < magnet**2) { const distance = Math.sqrt(d2), v = Math.min(distance,(140+(magnet-distance)*2)*dt); gem.x += x/distance*v; gem.y += y/distance*v; }
  }
}

export { xpNeed, xpBonus, xpCollectionScale, dropXp, reserveXp, collectXp, collectGem, collectAllXp, tickGems };
