import { weaponLabel } from './weapon-label.js';
import { branches } from '../data/specializations.js';
import { fusionRecipes } from '../data/fusions.js';
import { weaponConsumed, fusionConsumed, fusionReady } from '../growth/build.js';

export function createBuildModel({ sessionState }) {
  const fusionMaterialName=([id,branch])=>`${weaponLabel(id)} · ${branches.find(b=>b.id===id).options.find(o=>o.id===branch).name}`;

  const branchLabel = (weapon, r = sessionState.run) => branches.find(b => b.id === weapon)?.options.find(o => o.id === r?.branches?.[weapon])?.name || '';

  function guideWeaponMaterial(n,need=5,r=sessionState.run){
    const [id,branch]=n,level=r?.up?.[id]||0,selected=r?.branches?.[id],name=fusionMaterialName(n),chosen=branchLabel(id,r),consumer=fusionRecipes.find(f=>(r?.up?.['fusion_'+f.id]||0)>0&&f.needs.some(([w])=>w===id));let state='reference',detail=`요구 Lv.${need}`;
    if(r){if(weaponConsumed(id,r)){state='consumed';detail=`보유 없음 · ${consumer.name} 재료로 소비 · 기록 Lv.${level} · 선택 경로 ${chosen||'없음'}`;}else if(selected&&selected!==branch){state='blocked';detail=`다른 경로 ${chosen} 선택 · 변경 불가 · 원본 Lv.${level}`;}else if(!level&&id!=='pulse'){state='missing';detail=`원본 미보유 · 획득 후 지정 전문화와 Lv.${need} 필요`;}else if(!selected){state='pending';detail=`원본 Lv.${level}/${need} · 전문화 미선택${level<3?' · Lv.3에서 선택':''}`;}else if(level<need){state='pending';detail=`지정 전문화 보유 · Lv.${level}/${need} · ${need-level}레벨 부족`;}else{state='met';detail=`지정 전문화 보유 · Lv.${level}/${need} · 충족`;}}
    return {name,state,detail,level,selected};
  }

  function fusionGuideState(f,r=sessionState.run){
    const requirements=f.base?(()=>{const base=fusionRecipes.find(b=>b.id===f.base),level=r?.up?.['fusion_'+f.base]||0,prior=fusionGuideState(base,r);let state='reference',detail='요구 Lv.4';if(r){if(fusionConsumed(f.base,r)){state='consumed';detail=`상위 재료로 소비됨 · 기록 Lv.${level}`;}else if(level){state=level>=4?'met':'pending';detail=`현재 보유 · Lv.${level}/4${level>=4?' · 충족':` · ${4-level}레벨 부족`}`;}else{state=prior.state==='blocked'?'blocked':'pending';detail='선행 융합 미보유'+(state==='blocked'?' · 선행 경로 닫힘: '+prior.requirements.filter(v=>['consumed','blocked'].includes(v.state)).map(v=>v.name+' — '+v.detail).join(' / '):' · 제작 후 Lv.4 필요');}}return [{name:base.name,state,detail,level},guideWeaponMaterial(f.extra,5,r)];})():f.needs.map(n=>guideWeaponMaterial(n,5,r)),level=r?.up?.['fusion_'+f.id]||0,closed=requirements.filter(v=>['consumed','blocked'].includes(v.state));let state='reference',label='조건 안내',note='도전 중 보유·경로·소비 상태를 표시합니다.';
    if(r){if(level){const consumer=fusionRecipes.find(v=>v.base===f.id&&(r.up['fusion_'+v.id]||0)>0);state=consumer?'consumed':'active';label=consumer?'상위 재료로 소비됨':'현재 보유';note=consumer?`${consumer.name}에 사용 · 기록 Lv.${level} · 기존 공격 종료`:`Lv.${level}/4 · 재료의 기존 공격은 종료됨`;}else if(closed.length){state='blocked';label='경로 닫힘';note=closed.map(v=>v.name).join(' / ')+' 사용 불가 · 이번 도전에서 제작 불가';}else if(fusionReady(f,r)){state='ready';label='융합 가능';note='지정 경로·현재 보유·레벨 조건 충족 · G로 선택';}else{state='pending';label='준비 중';note='아직 조건 미충족 · 현재 도전에서 도달 가능한 경로';}}
    return {state,label,note,requirements,level};
  }
  function specializationGuide(b,o,r=sessionState.run){
    const level=r?.up?.[b.id]||0,chosen=branchLabel(b.id),selected=r?.branches?.[b.id]===o.id,used=weaponConsumed(b.id,r),held=!!r&&(b.id==='pulse'||level>0),consumer=used?fusionRecipes.find(f=>(r.up['fusion_'+f.id]||0)>0&&f.needs.some(([w])=>w===b.id)):null;let state='reference',label='조건 안내',note='원본 Lv.3에서 한 경로 선택';
    if(r){if(used){state=selected?'consumed':'blocked';label=selected?'선택 경로 · 소비됨':'선택 불가';note=`${chosen} 선택 · ${consumer.name} 재료로 소비됨 · 기록 Lv.${level} · 원본 공격 종료·재획득 불가`;}else if(chosen&&!selected){state='blocked';label='다른 경로 선택';note=`현재 ${chosen} 선택 · 이번 도전에서 변경 불가 · 원본 Lv.${level}`;}else if(selected){state='active';label='선택 · 현재 보유';note=`원본 Lv.${level} · 활성 전문화`; }else if(!held){state='missing';label='원본 미보유';note='원본 무기 획득 후 Lv.3에서 선택';}else{state=level>=3?'ready':'pending';label=level>=3?'선택 대기':'원본 보유';note=`원본 Lv.${level}/3 · ${level>=3?'전문화 선택 조건 충족':`선택까지 ${3-level}레벨`} · 전문화 미선택`;}}
    const next=fusionRecipes.filter(f=>!f.base&&f.needs.some(([w,id])=>w===b.id&&id===o.id));return {state,label,note,next};
  }

  function fusionPathPreview(f,r=sessionState.run){
    if(!r||f.base)return '';
    const projected={...r,up:{...r.up,['fusion_'+f.id]:1}},compatible=([w,b])=>!weaponConsumed(w,projected)&&(!r.branches[w]||r.branches[w]===b);
    const paths=fusionRecipes.filter(u=>u.base&&!fusionConsumed(u.base,projected)&&!(r.up['fusion_'+u.id]||0)&&compatible(u.extra)&&((r.up['fusion_'+u.base]||0)>0||u.base===f.id||fusionRecipes.find(b=>b.id===u.base).needs.every(compatible)));
    return paths.length?`이번 선택 후 준비 가능한 상위 경로 ${paths.length}개. 조합 도감에서 추가 무기와 경로를 확인하세요.`:activeUpper(projected)?'상위융합 보유. 이번 선택으로 새 상위 제작 경로는 남지 않습니다.':'주의: 이번 선택으로 남은 상위 제작 경로가 모두 닫힙니다. 추가 원본 재료를 확보할 수 없어 이 도전에서는 상위융합을 만들 수 없습니다.';
  }
  const activeUpper=r=>fusionRecipes.some(f=>f.base&&(r.up['fusion_'+f.id]||0)>0);
  return { branchLabel, fusionGuideState, fusionMaterialName, specializationGuide, fusionPathPreview };
}
