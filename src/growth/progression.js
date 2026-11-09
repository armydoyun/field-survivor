import { runRandom } from '../core/random.js';
import { GEM_LIMIT } from '../core/config.js';
import { commitFusion, commitSpecialization, commitUpgrade, ensureChoices, commitReroll } from './commands.js';
import { collectXp, collectAllXp, dropXp, tickGems as advanceGems } from './experience.js';
import { grantKillLoot, rewardGold } from './rewards.js';
import { hasRelic } from '../world/effects.js';
import { appendRecord } from '../core/profile.js';

// Own growth mutations; callers own mode changes, input, feedback and saving.
export function createProgression({ sessionState, statistics }) {
  const record = line => appendRecord(sessionState.profile,sessionState.run,line);
  function chooseFusion(id){const f=commitFusion(sessionState.run,id);if(!f)return null;sessionState.profile.memory.fusions[id]=(sessionState.profile.memory.fusions[id]||0)+1;record(`${f.base?'상위융합':'융합'} · ${f.name}`);return f;}
  function chooseBranch(id){const result=commitSpecialization(sessionState.run,id);if(result)record(`전문화 · ${result.weapon.name} / ${result.option.name}`);return result;}
  const chooseUpgrade = id => commitUpgrade(sessionState.run,id,statistics.maxHpFor);
  const rerollUpgrade = (random=()=>runRandom(sessionState.run)) => commitReroll(sessionState.run,random);
  const choices = () => ensureChoices(sessionState.run,()=>runRandom(sessionState.run));
  function prepareUpgrade(){
    const r=sessionState.run;if(!r?.pending)return null;if(choices().length)return {converted:0};
    const count=r.pending;r.gold+=count*20;r.pending=0;record(`모든 스킬을 완성했다. 남은 성장 ${count}회가 골드로 전환됐다.`);return {converted:count};
  }
  const collect = xp => collectXp(sessionState.run,sessionState.profile,xp,hasRelic('harvest',sessionState.run),statistics.maxHpFor);
  const collectAll = () => collectAllXp(sessionState.run,sessionState.profile,hasRelic('harvest',sessionState.run),statistics.maxHpFor);
  const tickGems = (dt,magnet) => advanceGems(sessionState.run,sessionState.profile,dt,magnet,hasRelic('harvest',sessionState.run),statistics.maxHpFor);
  const rewardKill = (enemy,xp,multiplier=1) => grantKillLoot(sessionState.run,enemy,rewardGold(enemy)*multiplier,xp*multiplier);
  function tickAmbientXp(dt){
    const p=sessionState.run.player;
    if ((sessionState.run.ambientClock -= dt) <= 0) { sessionState.run.ambientClock = 7 + runRandom(sessionState.run) * 5; if (sessionState.run.gems.length < GEM_LIMIT - 12) { const amount = 2 + Math.floor(runRandom(sessionState.run) * 2), xp = 3 + Math.min(12, Math.floor(sessionState.run.time / 450) * 2); for (let i = 0; i < amount; i++) { const a = runRandom(sessionState.run) * Math.PI * 2, d = 130 + runRandom(sessionState.run) * 370; dropXp(sessionState.run, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, xp); } } }
  }
  return { chooseFusion, chooseBranch, chooseUpgrade, rerollUpgrade, choices, prepareUpgrade, collect, collectAll, tickGems, tickAmbientXp, rewardKill };
}
