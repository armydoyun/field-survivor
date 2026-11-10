import { keystoneScale } from '../world/effects.js';
import { fusionBalance } from '../data/balance.js';
// Evaluate investment once per attack. Emitted attacks keep this snapshot until expiration.
export function fusionParameters(f,r,s){
  const has=id=>f.needs.some(([w])=>w===id),u=r.up,lv=id=>u[id]||0;
  let rate=1;if(has('pulse'))rate*=.91**lv('haste')*(1-(r.momentumTime>0?.04*lv('momentum'):0));
  if(has('chain'))rate*=1-.05*lv('conduction');if(has('mine')||has('beacon'))rate*=1-.08*lv('machinery');
  const k=f.needs.reduce((sum,[id])=>sum+keystoneScale(id,r),0)/f.needs.length;
  return {damage:s.damage*k*fusionBalance(f.id)*(has('orbit')||has('rift')?1+.05*lv('edgecraft'):1)*(1+.18*(lv('fusion_'+f.id)-1))*(f.base?1.54*1.20:1),rate,
    size:(1+.08*lv('area'))*(has('nova')||has('lance')||has('rift')?1+.05*lv('wavecraft'):1)*(f.base?1.15:1),
    reach:f.base?1.10:1,length:(has('rift')?1+.05*lv('edgecraft'):1)*(f.base?1.10:1),aim:20*lv('placement'),hop:has('chain')?15*lv('conduction'):0,
    multishot:has('pulse')?lv('multishot'):0,pierce:has('pulse')?lv('pierce'):0,crit:s.crit,critMult:s.critMult,frost:lv('frost'),repulsion:lv('repulsion')};
}
export const fusionInterval=(f,p)=>Math.max(f.floor,f.interval*p.rate);
export function fusionUpgradeEffect(f,id){
  const has=(...ids)=>f.needs.some(([w])=>ids.includes(w));
  if(['power','crit','focus','frost'].includes(id))return '융합 직접 타격에 적용';
  if(id==='area'&&f.code!=='F06')return '융합 피해 영역 확대';
  if(id==='placement'&&!['F04','F07'].includes(f.code))return '표적 탐색 거리 증가';
  if(['haste','momentum'].includes(id)&&has('pulse'))return '주 공격 간격 감소';
  if(['multishot','pierce'].includes(id)&&has('pulse')&&['F01','F02','F09'].includes(f.code.startsWith('H')?({fs_rapid_pulse:'F01',fs_support_guns:'F02',fs_bullet_barrier:'F09'}[f.base]):f.code))return id==='multishot'?'기반 탄환의 보조탄 증가':'기반 탄환 관통 증가';
  if(id==='conduction'&&has('chain'))return '주 간격 감소·도약 거리 증가';
  if(id==='machinery'&&has('mine','beacon'))return '주 공격 간격 감소';
  if(id==='wavecraft'&&has('nova','lance','rift'))return '피해 영역 확대';
  if(id==='edgecraft'&&has('orbit','rift'))return '피해 증가·균열 계보의 선형 사거리 증가';
  if(id==='repulsion'&&!['F01','F02','F05','F06','F12'].includes(f.code))return '융합 넉백·적별 0.8초 제한';
  return '';
}
