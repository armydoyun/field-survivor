import { createHash } from 'node:crypto';
import { createMockBrowser } from './mock-browser.js';
// Shared by baseline generation and current regression. Save excludes every presentation-only cache.
export function visualGameplaySample(createDebugGame,id){
 const env=createMockBrowser({observers:true}),descriptors=new Map();for(const [key,value]of Object.entries(env)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 let app;
 try{
  app=createDebugGame({mountPanel:false,settings:{enemyAI:false}});const t=app.tools;t.giveSkill(id,4,{isolate:true});t.giveSkill('crit',3);t.giveSkill('area',2);t.spawn(0,12,{distance:/^(mine|spec:mine:)/.test(id)?20:100,hp:1e6});t.hold(false);
  for(let i=1;i<=180;i++){if(i===61)t.configure('lowDetail',true);if(i===121){t.configure('lowDetail',false);t.configure('reducedMotion',true);}env.__inspect.flushFrame(1000+i*1000/60);}
  if(t.report().panic)throw Error('render panic '+id);return createHash('sha256').update(t.snapshot()).digest('hex');
 }finally{app?.dispose();for(const [key,value]of descriptors)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}
}
