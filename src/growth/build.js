import { fusionRecipes, fusionRequirements as required } from '../data/fusions.js';
import { branches } from '../data/specializations.js';
const fusionConsumed=(id,r)=>fusionRecipes.some(f=>f.base===id&&(r?.up?.['fusion_'+f.id]||0)>0);
const activeFusions=r=>fusionRecipes.filter(f=>(r?.up?.['fusion_'+f.id]||0)>0&&!fusionConsumed(f.id,r));
const weaponConsumed=(id,r)=>fusionRecipes.some(f=>(r?.up?.['fusion_'+f.id]||0)>0&&f.needs.some(([w])=>w===id));
const materialReady=([w,b],r)=>(r.up[w]||0)>=required.weapon&&r.branches[w]===b&&!weaponConsumed(w,r);
const fusionReady=(f,r)=>!!r&&!(r.up['fusion_'+f.id]||0)&&(f.base?(r.up['fusion_'+f.base]||0)>=required.foundation&&!fusionConsumed(f.base,r)&&materialReady(f.extra,r):f.needs.every(n=>materialReady(n,r)));
function refreshBuild(r){
  const used=new Set(),bases=new Set();
  for(const f of fusionRecipes)if(r.up['fusion_'+f.id]){
    const needs=f.base?[f.extra]:f.needs,invalid=needs.some(([w,b])=>(r.up[w]||0)<required.weapon||r.branches[w]!==b||used.has(w))||f.base&&(!(r.up['fusion_'+f.base]>=required.foundation)||bases.has(f.base));
    if(invalid)r.up['fusion_'+f.id]=0;else{for(const [w]of needs)used.add(w);if(f.base)bases.add(f.base);}
  }
}
const hasBranch=(weapon,id,r)=>!weaponConsumed(weapon,r)&&r?.branches?.[weapon]===id;
const branchReady=r=>branches.find(b=>(r?.up?.[b.id]||0)>=3&&!weaponConsumed(b.id,r)&&!r?.branches?.[b.id]);
const specialized=(id,r)=>!weaponConsumed(id,r)&&!!r?.branches?.[id];
// 다른 무기로 시작한 판에서 펄스를 아직 고르지 않았으면 기본 사격이 쉰다(시작 무기 선택).
const pulseDormant=r=>!!r?.startWeapon&&r.startWeapon!=='pulse'&&!(r.up?.pulse>0);
const pulseActive=r=>!weaponConsumed('pulse',r)&&!pulseDormant(r);

export { pulseDormant, pulseActive, fusionConsumed, activeFusions, weaponConsumed, fusionReady, refreshBuild, hasBranch, branchReady, specialized };
