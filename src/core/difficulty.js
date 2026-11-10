import { fusionParameters, fusionInterval } from '../combat/fusion-parameters.js';
import { fusionById } from '../data/fusions.js';
import { phases } from '../data/progression.js';
import { RUN_END } from './config.js';
import { rewardXp as enemyRewardXp } from '../growth/rewards.js';
import { anomalyActive } from '../world/effects.js';
import { weaponConsumed, hasBranch, specialized, activeFusions } from '../growth/build.js';
import { clamp } from './utils.js';
import { tacticalKind } from '../combat/rules.js';

export function paceAt(time) {
  const t = Math.max(0, time); let index = 0;
  while (index + 1 < phases.length && t >= phases[index + 1].at) index++;
  const a = phases[index], b = phases[Math.min(index + 1, phases.length - 1)];
  const f = a === b ? 0 : (t - a.at) / (b.at - a.at), lerp = key => a[key] + (b[key] - a[key]) * f;
  return { index, name: a.name, interval: lerp('interval'), extra: lerp('extra'), hp: lerp('hp') * (t > RUN_END ? 1 + Math.min(1, (t - RUN_END) / 3600) : 1), speed: lerp('speed'), cap: Math.round(lerp('cap')), xp: lerp('xp'), elite: lerp('elite'), surge: t >= 360 && (t - 360) % 300 < 22 };
}

export function createDifficulty({ sessionState, statistics }) {

  const rewardXp = enemy => enemyRewardXp(enemy, { time: sessionState.run.time, paceXp: paceAt(sessionState.run.time).xp, harvest: anomalyActive('border','harvest',sessionState.run) });

  function combatPower(r=sessionState.run){
    const s=statistics.stats(r),crit=1+statistics.pulseCritChance(s)*(s.critMult-1),auxCrit=1+statistics.pulseCritChance(s)*(s.critMult-1),damage=type=>statistics.weaponDamage(type,s,0,r);
    let total=(weaponConsumed('pulse',r)?0:damage('pulse')*(crit+Math.max(0,s.shots-1)*.38*.55*auxCrit)/s.interval);
    if(s.orbit)total+=damage('orbit')/.38*.65;
    if(s.nova)total+=damage('nova')/statistics.novaInterval(s.nova)*(hasBranch('nova','boundary',r)?1.2:hasBranch('nova','reflux',r)?1.3:1);
    if(s.chain)total+=damage('chain')/statistics.chainReload(s);
    if(s.lance)total+=damage('lance')*(specialized('lance',r)?1.4:1)/Math.max(statistics.lanceInterval(s),hasBranch('lance','stake',r)?2.1:0);
    if(s.rift)total+=damage('rift')/statistics.riftInterval(s);
    if(s.beacon)total+=damage('beacon')*1.5/statistics.beaconShotInterval(s);
    if(s.mine)total+=damage('mine')/statistics.mineInterval(s)*(.75);
    for(const f of activeFusions(r)){const p=fusionParameters(f,r,s),base=f.base?fusionById[f.base]:f;/* Director heuristic, not measured DPS. */total+=p.damage*(1/fusionInterval(base,p)+(f.base?.5/fusionInterval(f,p):0));}return Math.max(1,total);
  }

  function directorTick(dt){
    if(sessionState.run.finalStep>=2)return;const d=sessionState.run.director;d.clock+=dt;
    let count=0;for(const e of sessionState.run.enemies)if(e.hp>0&&e.kind!==3&&!e.coreNode){const distance=(e.x-sessionState.run.player.x)**2+(e.y-sessionState.run.player.y)**2;if(distance<600**2)count++;if(distance<490**2&&e.combatAt==null)e.combatAt=sessionState.run.time;}
    if(count){d.engaged+=dt;d.crowdSum+=count*dt;}if(d.clock<6)return;
    if(d.engaged>=3||d.kills>=3){const engaged=Math.max(d.engaged,Math.min(d.clock,3)),f=1-Math.exp(-engaged/24),blend=(old,next)=>d.samples?old+(next-old)*f:next;d.dps=blend(d.dps,d.damage/engaged);d.killRate=blend(d.killRate,d.kills/engaged);d.hitRate=blend(d.hitRate,d.hits/engaged);d.crowd=blend(d.crowd,d.crowdSum/engaged);d.samples++;
      if(d.specialKills>=3){const mix=(old,next)=>d.specialSamples?old+(next-old)*f:next;d.life=mix(d.life,d.lifeSum/d.specialKills);d.actionRate=mix(d.actionRate,d.specialActed/d.specialKills);d.specialSamples++;}
      const reference=100+Math.max(0,sessionState.run.time-600)*1.05,gate=clamp((sessionState.run.time-600)/360,0,1),target=gate*clamp(.36*Math.log2(Math.max(.5,combatPower()/reference))+.24*clamp(d.dps/reference-1,-.6,2)+.16*clamp(d.killRate-1,-1,2)-.65*clamp((d.crowd-35)/70,0,1)-Math.min(.5,d.hitRate*.8)+(d.specialSamples?.3*clamp((3.5-d.life)/3.5,0,1)*(1+clamp((.45-d.actionRate)/.45,0,1))-.6*clamp((d.life-6)/8,0,1):0),0,1);
      d.value=clamp(d.value+clamp((target-d.value)*f,-.08,.08),0,1);
    }
    d.clock=d.engaged=d.damage=d.kills=d.hits=d.crowdSum=d.specialKills=d.specialActed=d.lifeSum=0;
  }

  function pressureProfile(r=sessionState.run){const v=r&&r.time>=600?clamp(r.director.value,0,1):0;return {spawn:1+v*.1,hp:1+v*.08,tough:1+v*.1,elite:v*.02,shot:1+v*.04,tactics:1+v*.1};}

  const lateCombat=(r=sessionState.run)=>clamp((r.time-600)/1080,0,1);

  function enemyHealthScale(kind,elite=false,r=sessionState.run){const p=pressureProfile(r);return p.hp*(kind===3?1:(1+lateCombat(r)*((tacticalKind(kind)?.35:0)+(elite?.2:0)))*(tacticalKind(kind)||elite?p.tough:1));}

  function finalRating(r=sessionState.run){const power=combatPower({...r,momentumTime:Math.max(1,r.momentumTime)});return {power,hp:Math.round(85000*(1+.35*clamp(Math.log2(Math.max(1,power/1400)),0,2))),nodeHp:Math.round(1500+Math.min(2500,Math.max(0,power-1200)*.35))};}

  return { paceAt, rewardXp, directorTick, pressureProfile, lateCombat, enemyHealthScale, finalRating };
}
