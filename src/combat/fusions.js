import { makeFusionRuntime } from './fusion-record.js';
import { activeFusions } from '../growth/build.js';
import { fusionById } from '../data/fusions.js';
import { fusionParameters, fusionInterval } from './fusion-parameters.js';
import { createFusionContext, STEP } from './fusions/context.js';
import { tickGuns } from './fusions/basic-guns.js';
import { tickFields } from './fusions/basic-fields.js';
import { tickMobile } from './fusions/basic-mobile.js';
import { tickHigher } from './fusions/higher.js';
import { tickEffects } from './fusions/effects.js';
export function createFusions({sessionState,view,statistics,combat,inspector}){
  function fusionTick(dt,s){
    const r=sessionState.run;if(!r||view.mode!=='playing')return;
    r.fusionRemainder=(r.fusionRemainder||0)+dt;
    const active=activeFusions(r);
    // Legacy weapons can emit between fusion ticks. Reclaim fusion bolts without firing expiry effects.
    const bolts=Object.values(r.fusionStates).flatMap(q=>(q.effects||[]).filter(e=>e.type==='bolt').map(e=>({q,e}))).sort((a,b)=>(a.e.channel==='upper-bolts')-(b.e.channel==='upper-bolts')||b.e.age-a.e.age);
    let excess=r.shots.length+bolts.length-320;
    for(const {q,e}of bolts){if(excess--<=0)break;q.effects.splice(q.effects.indexOf(e),1);}
    // All weapons share the step: attack and RNG order also stay stable with several active fusions.
    while(r.fusionRemainder+1e-9>=STEP&&view.mode==='playing'){
      r.fusionRemainder=Math.max(0,r.fusionRemainder-STEP);
      for(const f of active){
        const q=r.fusionStates[f.id]||=makeFusionRuntime(f.id),base=f.base?fusionById[f.base]:f;
        const p=fusionParameters(f,r,s),c=createFusionContext(r,q,f,p,combat,view,inspector),interval=fusionInterval(base,p);
        tickGuns(c,base.code,interval);if(view.mode!=='playing')return;
        tickFields(c,base.code,interval);if(view.mode!=='playing')return;
        tickMobile(c,base.code,interval);if(view.mode!=='playing')return;
        if(f.base){c.visualLayer('upper');tickHigher(c);}if(view.mode!=='playing')return;
        tickEffects(c,STEP);q.age+=STEP;q.clock=Math.max(0,(q.clocks.main||0)-q.age);
        if(view.mode!=='playing')return;
      }
    }
    if(r.fusionPushHits)r.fusionPushHits=r.fusionPushHits.filter(h=>r.time-h.at<.8);
  }
  return {fusionTick};
}
