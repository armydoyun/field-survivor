import { fusionUpgradeEffect } from '../combat/fusion-parameters.js';
import { runRandom } from '../core/random.js';
import { upgrades, upgradeSupports } from '../data/upgrades.js';
import { fusionRecipes } from '../data/fusions.js';
import { branches } from '../data/specializations.js';
import { fusionConsumed, activeFusions, weaponConsumed, hasBranch, specialized } from './build.js';

export { fusionUpgradeEffect } from '../combat/fusion-parameters.js';

function originalUpgradeEffect(id,r){const pulse=!weaponConsumed('pulse',r);if(['haste','momentum','multishot','pierce','crit','focus','area'].includes(id))return pulse;if(id==='frost')return pulse||((r.up.beacon||0)>0&&!weaponConsumed('beacon',r)&&!hasBranch('beacon','relay',r));if(upgradeSupports[id])return upgradeSupports[id].some(w=>(r.up[w]||0)>0&&!weaponConsumed(w,r)&&!(id==='repulsion'&&w==='nova'&&hasBranch(w,'reflux',r))&&!(id==='wavecraft'&&w==='rift'&&!specialized('rift',r)));return true;}

function upgradeUseful(id,r){if(!r)return false;if(id.startsWith('fusion_'))return (r.up[id]||0)>0&&!fusionConsumed(id.slice(7),r);if(weaponConsumed(id,r))return false;return originalUpgradeEffect(id,r)||activeFusions(r).some(f=>fusionUpgradeEffect(f,id));}

const availableUpgrades = (r) => upgrades.filter(u=>(r.up[u.id]||0)<u.max&&upgradeUseful(u.id,r));

function growthCandidates(pool,r){
  const paths=[],add=(f,upper)=>{const base=upper&&(r.up['fusion_'+f.base]||0)>0;if(upper&&fusionConsumed(f.base,r)||!upper&&(r.up['fusion_'+f.id]||0)>0)return;const needs=base?[f.extra]:f.needs;if(needs.some(([w,b])=>weaponConsumed(w,r)||r.branches[w]&&r.branches[w]!==b))return;const ids=needs.filter(([w])=>(r.up[w]||0)<5).map(([w])=>w);let cost=needs.reduce((n,[w])=>n+Math.max(0,5-(r.up[w]||0)),0);if(upper){cost+=Math.max(0,4-(r.up['fusion_'+f.base]||1));if(base&&(r.up['fusion_'+f.base]||0)<4)ids.push('fusion_'+f.base);}const choices=pool.filter(u=>ids.includes(u.id));if(choices.length)paths.push({upper,cost,choices});};
  const seekUpper=activeFusions(r).length>0&&!activeFusions(r).some(f=>f.base);for(const f of fusionRecipes)add(f,!!f.base);const eligible=seekUpper&&paths.some(p=>p.upper)?paths.filter(p=>p.upper):paths.filter(p=>!p.upper),best=Math.min(...eligible.map(p=>p.cost));return [...new Set(eligible.filter(p=>p.cost===best).flatMap(p=>p.choices))];
}

function makeChoices(r,exclude=[],random=()=>runRandom(r)){const pool=availableUpgrades(r),result=[],pick=list=>{const fresh=list.filter(u=>!result.includes(u.id)),preferred=fresh.filter(u=>!exclude.includes(u.id)),set=preferred.length?preferred:fresh;if(set.length&&result.length<3)result.push(set[Math.floor(random()*set.length)].id);};pick(growthCandidates(pool,r));const owned=pool.filter(u=>u.id.startsWith('fusion_')||branches.some(b=>b.id===u.id&&(r.up[u.id]||0)>0));pick(owned);if(result.length<3)pick(random()<.4?pool.filter(u=>branches.some(b=>b.id===u.id)&&!(r.up[u.id]||0)):pool.filter(u=>!branches.some(b=>b.id===u.id)&&!u.id.startsWith('fusion_')));while(result.length<Math.min(3,pool.length))pick(pool);return result;}

const canReroll = r => !!r?.choices?.length && availableUpgrades(r).some(u => !r.choices.includes(u.id));

export { originalUpgradeEffect, upgradeUseful, availableUpgrades, growthCandidates, makeChoices, canReroll };
