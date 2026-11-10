import { createHash } from 'node:crypto';
import { createMockBrowser } from './mock-browser.js';
// 서사 계층(프로필 기억·판 안의 이야기 진행·기록 로그)과 소리 설정(profile.audio)은 이 검사의 대상이 아니다. 서사 재설계(NARRATIVE-REDESIGN.md)로
// 저장 모양이 바뀌어도 전투 회귀만 보도록 해시에서 뺀다. 무기·적·탄환·성장·유물·여정 등 나머지 저장 상태는 모두 포함한다.
const NARRATIVE_RUN_KEY=/^(logs|npc|signal|anomaly|site|objective|echo|front|legacy|guardian(Fate|Order|Meet)|story)/;
export function combatProjection(save){
 const data=JSON.parse(save);delete data.profile.memory;delete data.profile.audio;
 if(data.run)for(const key of Object.keys(data.run))if(NARRATIVE_RUN_KEY.test(key))delete data.run[key];
 return JSON.stringify(data);
}
// Shared by baseline generation and current regression. Save excludes every presentation-only cache.
export function visualGameplaySample(createDebugGame,id){
 const env=createMockBrowser({observers:true}),descriptors=new Map();for(const [key,value]of Object.entries(env)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 let app;
 try{
  app=createDebugGame({mountPanel:false,settings:{enemyAI:false}});const t=app.tools;t.giveSkill(id,4,{isolate:true});t.giveSkill('crit',3);t.giveSkill('area',2);t.spawn(0,12,{distance:/^(mine|spec:mine:)/.test(id)?20:100,hp:1e6});t.hold(false);
  for(let i=1;i<=180;i++){if(i===61)t.configure('lowDetail',true);if(i===121){t.configure('lowDetail',false);t.configure('reducedMotion',true);}env.__inspect.flushFrame(1000+i*1000/60);}
  if(t.report().panic)throw Error('render panic '+id);return createHash('sha256').update(combatProjection(t.snapshot())).digest('hex');
 }finally{app?.dispose();for(const [key,value]of descriptors)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}
}
