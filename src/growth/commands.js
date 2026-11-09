import { runRandom } from '../core/random.js';
import { makeFusionRuntime } from '../combat/fusion-record.js';
import { fusionRecipes } from '../data/fusions.js';
import { branchReady, fusionReady, refreshBuild } from './build.js';
import { availableUpgrades, makeChoices, canReroll } from './cards.js';
import { retireWeaponAttacks } from '../combat/loadout.js';

// Explicit run input; no DOM, profile, save, modal, or visual feedback. Invalid commands leave state untouched.
function commitSpecialization(r,id){
  if(!r)return null;const current=branchReady(r),pick=current?.options.find(o=>o.id===id);if(!pick)return null;
  r.branches[current.id]=id;retireWeaponAttacks(r,[current.id]);refreshBuild(r);return {weapon:current,option:pick};
}
function commitFusion(r,id){
  if(!r)return null;const f=fusionRecipes.find(f=>f.id===id);if(!f||!fusionReady(f,r))return null;
  r.up['fusion_'+id]=1;if(f.base)delete r.fusionStates[f.base];retireWeaponAttacks(r,f.needs.map(x=>x[0]));r.choices=null;r.fusionStates[id]=makeFusionRuntime(id);return f;
}
function commitUpgrade(r,id,maxHpFor){
  if(!r?.choices?.includes(id)||!availableUpgrades(r).some(u=>u.id===id))return false;
  r.up[id]=(r.up[id]||0)+1;const clock={chain:'chainClock',nova:'novaClock',lance:'lanceClock',mine:'mineClock',rift:'riftClock',beacon:'beaconClock'}[id];if(clock&&r.up[id]===1)r[clock]=0;if(id==='vitality')r.player.hp=Math.min(maxHpFor(r),r.player.hp+25);
  refreshBuild(r);r.pending--;r.choices=null;return true;
}

function ensureChoices(r,random=()=>runRandom(r)){if(!r.choices?.length)r.choices=makeChoices(r,[],random);return r.choices;}
function commitReroll(r,random=()=>runRandom(r)){
  if(!r?.pending||!r.choices?.length||r.rerolls<=0||!canReroll(r))return false;
  const previous=r.choices,next=makeChoices(r,previous,random);if(next.every(id=>previous.includes(id))){const fresh=availableUpgrades(r).filter(u=>!previous.includes(u.id));next[next.length-1]=fresh[Math.floor(random()*fresh.length)].id;}
  r.rerolls--;r.choices=next;return true;
}

export { commitSpecialization, commitFusion, commitUpgrade, ensureChoices, commitReroll };
