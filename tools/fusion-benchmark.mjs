// Repeatable CPU/logic probe. The mock canvas has no GPU or browser layout cost.
import { performance as clock } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { createMockBrowser } from '../tests/mock-browser.js';
import { createDebugGame } from '../src/debug/create-debug-game.js';
import { fusionRecipes } from '../src/data/fusions.js';
const rows=[];
function sample(f,count,before=false){
 const env=createMockBrowser({observers:true}),descriptors=new Map();for(const [key,value]of Object.entries(env)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 let app;
 try{
  app=createDebugGame({mountPanel:false,settings:{enemyAI:false}});const t=app.tools;t.giveSkill('fusion:'+f.id,f.base?1:4,{isolate:true});
  if(before){const data=JSON.parse(t.snapshot());delete data.run.up['fusion_'+f.id];delete data.run.fusionStates[f.id];t.loadSnapshot(JSON.stringify(data));}
  for(let left=count;left>0;left-=50)t.spawn(0,Math.min(50,left),{distance:180,hp:1e6});t.hold(false);
  const timings=[];let peakBolts=0,peakFields=0;
  for(let i=1;i<=300;i++){const at=clock.now();env.__inspect.flushFrame(1000+i*1000/60);timings.push(clock.now()-at);if(i%30===0){const r=JSON.parse(t.snapshot()).run,es=Object.values(r.fusionStates).flatMap(q=>q.effects||[]);peakBolts=Math.max(peakBolts,es.filter(e=>e.type==='bolt').length+r.shots.length);peakFields=Math.max(peakFields,es.filter(e=>e.type!=='bolt').length);}}
  const end=JSON.parse(t.snapshot()).run,damage=end.enemies.reduce((sum,e)=>sum+1e6-e.hp,0),sorted=timings.slice(60).sort((a,b)=>a-b);
  return {id:f.id,count,before,damage,peakBolts,peakFields,meanCpuMs:sorted.reduce((a,b)=>a+b,0)/sorted.length,p95CpuMs:sorted[Math.floor(sorted.length*.95)]};
 }finally{app?.dispose();for(const [key,value]of descriptors)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}
}
for(const f of fusionRecipes)for(const count of [1,30,80,165])rows.push(sample(f,count));
const transitions=fusionRecipes.filter(f=>f.base).map(f=>{const before=sample(f,30,true),after=rows.find(r=>r.id===f.id&&r.count===30);return {id:f.id,beforeDamage:before.damage,afterDamage:after.damage,ratio:after.damage/before.damage};});
const result={version:'2.6.27',note:'Fixed ring at distance180, 5 seconds, no passives, no enemy AI. Warmup first60 frames excluded from CPU samples. Mock canvas only; not browser FPS or general balance evidence.',rows,transitions};
writeFileSync(new URL('../FUSION-VALIDATION.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({cases:rows.length,maxP95:Math.max(...rows.map(r=>r.p95CpuMs)),upperRatios:transitions.map(t=>({id:t.id,ratio:+t.ratio.toFixed(3)}))},null,2));
