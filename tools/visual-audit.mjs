// Developer-only raster audit. Optional Node canvas is used here; game runtime has no dependency.
// node tools/visual-audit.mjs [source-root] [output-directory] [canvas-module-path]
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve,join } from 'node:path';
import { mkdirSync,writeFileSync } from 'node:fs';
const root=resolve(process.argv[2]||fileURLToPath(new URL('../',import.meta.url))),output=resolve(process.argv[3]||join(root,'visual-review')),require=createRequire(import.meta.url);
const canvasModule=process.argv[4]||'@napi-rs/canvas',canvasApi=require(canvasModule),{createCanvas}=canvasApi;
const {createMockBrowser}=await import(pathToFileURL(join(root,'tests/mock-browser.js'))),{createDebugGame}=await import(pathToFileURL(join(root,'src/debug/create-debug-game.js'))),{fusionRecipes}=await import(pathToFileURL(join(root,'src/data/fusions.js'))),{branches}=await import(pathToFileURL(join(root,'src/data/specializations.js')));
mkdirSync(output,{recursive:true});
const cases=[...branches.map(b=>({id:b.id,name:b.id,group:'original'})),...branches.flatMap(b=>b.options.map(o=>({id:`spec:${b.id}:${o.id}`,name:`${b.id} / ${o.id}`,group:'specialized'}))),...fusionRecipes.map(f=>({id:'fusion:'+f.id,name:`${f.code} ${f.base?fusionRecipes.find(b=>b.id===f.base).code:f.id.slice(3)}`,group:f.base?'higher':'fusion'})),
 {id:'burst',name:'burst / kill shards + experience',group:'passive',burst:true},
 {id:'pulse',name:'pulse / cold + crit + multishot',group:'passive',invest:{haste:4,multishot:4,pierce:4,area:3,crit:4,focus:3,frost:4}},
 {id:'orbit',name:'orbit / armor + repair + momentum',group:'passive',invest:{edgecraft:4,repulsion:3,armor:3,regen:3,momentum:3,speed:3},status:true},
 {id:'fusion:fs_pulse_typhoon',name:'fusion / area + wavecraft + crit',group:'passive',invest:{area:4,wavecraft:4,crit:4,focus:3,frost:3}}],records=[];
function capture(item,{reduced=false,crowded=false}={}){
 const canvas=createCanvas(960,540),ctx=canvas.getContext('2d'),env=createMockBrowser({observers:true}),descriptors=new Map();env.document.getElementById('field').getContext=()=>ctx;
 for(const [key,value]of Object.entries(env)){descriptors.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 let app;
 try{
  app=createDebugGame({mountPanel:false,settings:{enemyAI:false,reducedMotion:reduced}});const tools=app.tools;
  tools.giveSkill(item.id,4,{isolate:true});
  if(item.invest)for(const [id,level]of Object.entries(item.invest))tools.giveSkill(id,level);if(item.status)tools.setHp(tools.report().maxHp*.45);
  if(item.combo){tools.giveSkill('fusion:hs_fleet_wing_lances',4);tools.giveSkill('spec:rift:trail',5);tools.giveSkill('spec:beacon:relay',5);}
  for(let left=crowded?165:18;left>0;left-=50)tools.spawn(0,Math.min(50,left),{distance:crowded?230:/^(mine|spec:mine:)/.test(item.id)?20:item.id==='orbit'?50:125,hp:item.burst?10:1e6});if(item.combo){const data=JSON.parse(tools.snapshot()),p=data.run.player,source=data.run.enemies[0];data.run.hazards=[{sourceId:source.id,boss:false,x:p.x-130,y:p.y+100,shape:'beam',angle:-.35,length:290,width:20,radius:48,fireAt:1,endAt:4,damage:10}];data.run.bullets=Array.from({length:7},(_,i)=>({x:p.x-150+i*50,y:p.y+70,vx:0,vy:0,radius:5,damage:10,life:6,kind:i%2?'arc':'return'}));tools.loadSnapshot(JSON.stringify(data));}
  env.dispatch('keydown',{code:'F6'});tools.hold(false);if(item.status||item.id.includes('mobile_transmission'))env.dispatch('keydown',{code:'KeyD'});
  let score=-1,best=null;const phases=[];
  for(let i=1;i<=270;i++){
   if((item.status||item.id.includes('mobile_transmission'))&&i%90===0){env.dispatch('keyup',{code:i%180===0?'KeyA':'KeyD'});env.dispatch('keydown',{code:i%180===0?'KeyD':'KeyA'});}
   env.__inspect.flushFrame(1000+i*1000/60);if(i%3)continue;
   if(tools.report().panic)throw Error('render panic: '+item.id);
   const data=ctx.getImageData(0,0,960,540).data;let next=0;for(let j=0;j<data.length;j+=64)if(data[j]+data[j+1]+data[j+2]>180)next++;
   const image=next>score||[30,75,150,240].includes(i)?canvas.toBuffer('image/png'):null;if(next>score){score=next;best=image;}
   if([30,75,150,240].includes(i))phases.push({time:i/60,image});
  }
  const report=tools.report();records.push({id:item.id,combo:!!item.combo,reduced,crowded,peakBrightSamples:score,panic:report.panic});return {image:best,phases};
 }finally{app?.dispose();for(const [key,value]of descriptors)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];}
}
const {loadImage}=canvasApi;
for(const group of (process.env.AUDIT_GROUPS||'original,specialized,fusion,higher,passive').split(',')){
 const items=cases.filter(v=>v.group===group),cols=4,cw=384,ch=252,atlas=createCanvas(cw*cols,Math.ceil(items.length/cols)*ch+68),ctx=atlas.getContext('2d');ctx.fillStyle='#101d26';ctx.fillRect(0,0,atlas.width,atlas.height);ctx.fillStyle='#ecf5ef';ctx.font='bold 22px sans-serif';ctx.fillText('FIELD SURVIVOR / '+group.toUpperCase(),20,32);ctx.font='13px sans-serif';ctx.fillStyle='#8faab3';ctx.fillText('Actual Canvas2D raster / fixed enemies / selected peak frame / 960 x 540 view',20,54);
 for(let i=0;i<items.length;i++){const result=capture(items[i]),x=(i%cols)*cw,y=68+Math.floor(i/cols)*ch,image=await loadImage(result.image);ctx.drawImage(image,x+4,y+2,cw-8,212);ctx.fillStyle='#dbeee7';ctx.font='14px sans-serif';ctx.fillText(items[i].name,x+12,y+236);}
 writeFileSync(join(output,group+'.png'),atlas.toBuffer('image/png'));
}
// Timing strips preserve preparation/attack/afterimage context rather than relying on peak frames alone.
const focus=['fusion:fs_instant_slash','fusion:fs_shock_mines','fusion:fs_pulse_typhoon','fusion:hs_thunder_slash_instant_slash','spec:rift:fold','spec:mine:pressure','spec:beacon:relay','spec:nova:reflux'];
const strip=createCanvas(1536,focus.length*248+52),sc=strip.getContext('2d');sc.fillStyle='#101d26';sc.fillRect(0,0,strip.width,strip.height);
for(let row=0;row<focus.length;row++){const result=capture(cases.find(c=>c.id===focus[row]));sc.fillStyle='#dbeee7';sc.font='15px sans-serif';sc.fillText(focus[row],12,row*248+25);for(let i=0;i<result.phases.length;i++){const v=result.phases[i];sc.drawImage(await loadImage(v.image),i*384+4,row*248+36,376,211);}}
writeFileSync(join(output,'timing.png'),strip.toBuffer('image/png'));
const stressItems=[cases.find(c=>c.id==='fusion:hs_storm_pulse_typhoon'),cases.find(c=>c.id==='fusion:hs_crusher_rotating_cutters'),cases.find(c=>c.id==='fusion:hs_thunder_slash_instant_slash'),cases.find(c=>c.id==='spec:beacon:relay'),{...cases.find(c=>c.id==='fusion:hs_storm_pulse_typhoon'),name:'2 higher + rift + beacon + hostile beam',combo:true}],stress=createCanvas(1536,stressItems.length*248+50),st=stress.getContext('2d');st.fillStyle='#101d26';st.fillRect(0,0,stress.width,stress.height);
for(let row=0;row<stressItems.length;row++)for(let col=0;col<4;col++){const flags={reduced:col%2===1,crowded:col>=2},result=capture(stressItems[row],flags);st.drawImage(await loadImage(result.image),col*384+4,row*248+30,376,211);st.fillStyle='#dbeee7';st.font='12px sans-serif';st.fillText(`${stressItems[row].name} / ${flags.crowded?'165 enemies':'normal'}${flags.reduced?' / reduced':''}`,col*384+8,row*248+22);}
writeFileSync(join(output,'stress.png'),stress.toBuffer('image/png'));
writeFileSync(join(output,'audit.json'),JSON.stringify({note:'Canvas rasterization, not browser layout or GPU/FPS verification. Peak frames plus timing strips and reduced/crowded variants.',records},null,2));
writeFileSync(join(output,'index.html'),'<!doctype html><html lang="ko"><meta charset="utf-8"><title>FIELD Skill Visual Review</title><style>body{margin:24px;background:#101d26;color:#dbeee7;font:16px system-ui}img{width:100%;max-width:1536px;display:block;margin:16px 0 40px}a{color:#9de7ff}</style><h1>FIELD SURVIVOR 스킬 그래픽 검토</h1><p>실제 게임 렌더러를 Canvas로 래스터화했습니다. 대표 프레임·시간 흐름·과밀/동작 줄이기를 비교합니다. 실제 브라우저 FPS 측정은 아닙니다.</p>'+['original','specialized','fusion','higher','passive','timing','stress'].map(n=>`<h2>${n}</h2><img src="${n}.png" alt="${n}">`).join(''));
console.log(JSON.stringify({cases:cases.length,rasterCases:records.length,output},null,2));
