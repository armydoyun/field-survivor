import { createGame } from '../app/create-game.js';
import { initialProfile } from '../core/profile.js';
import { createCombatInspector } from './combat-inspector.js';
import { createDebugCommands } from './commands.js';
import { mountDebugPanel } from './panel.js';

export function createDebugGame({seed=42,mountPanel=true,autoStart=true,settings:overrides={}}={}){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('시드는 0~4294967295 정수여야 합니다.');
  const state={profile:initialProfile(),run:null,replaceRun(value){state.run=value;},resetState(){state.profile=initialProfile();state.run=null;}};
  const memory=new Map(),backend=()=>({getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value),removeItem:key=>memory.delete(key)});
  const settings={autoSpawn:false,worldEvents:false,choices:false,playerAttacks:true,basePulse:true,enemyAI:true,godMode:true,blockEnemyDamage:false,hostileProjectiles:true,reducedMotion:false,lowDetail:false,timeScale:1};
  let tools,panel;
  const app=createGame(state,{backend,seedSource:()=>seed,createInspector:context=>createCombatInspector({...context,enabled:true}),setup:context=>{
    tools=createDebugCommands(context,settings);for(const [key,value]of Object.entries(overrides))tools.configure(key,value);
    if(mountPanel)panel=mountDebugPanel({tools,view:context.view,platform:context.platform,inspector:context.inspector,seed});
    return ()=>{panel?.dispose();tools.dispose();memory.clear();};
  }});
  if(autoStart)tools.start(seed);
  return {...app,tools};
}
