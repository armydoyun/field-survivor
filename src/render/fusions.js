import { fusionParameters } from '../combat/fusion-parameters.js';
import { fusionById } from '../data/fusions.js';
import { activeFusions } from '../growth/build.js';
import { createSkillDesign, fusionStyle, skillStyle, skillDetail } from './skill-style.js';
import { W, H } from '../core/config.js';
// Geometry comes from combat snapshots; rendering never advances attacks or consumes RNG.
export function createFusionView({sessionState,platform,statistics,primitives,cameraView}){
 const {ctx}=platform,design=createSkillDesign(ctx);
 function drawFusions(){
  const r=sessionState.run;if(!r)return;const detail=primitives?.visualDetail?.()??skillDetail(r,cameraView?.reducedMotion?.()),motion=!cameraView?.reducedMotion?.(),s=statistics.stats();
  const camera=cameraView?.camera||r.player,visible=(x,y,radius=30)=>Math.abs(x-camera.x)<W/2+radius&&Math.abs(y-camera.y)<H/2+radius;
  for(const f of activeFusions(r)){
   const q=r.fusionStates[f.id];if(!q)continue;
   const base=f.base?fusionById[f.base]:f,baseStyle=fusionStyle[base.code],upperStyle=fusionStyle[f.code],p=fusionParameters(f,r,s),color=baseStyle[0],accent=f.base?upperStyle[1]:baseStyle[1];
   const paint=(v,fade=1)=>{
    const ink=v.layer==='upper'?upperStyle[0]:color,opts={fade,detail,accent:v.layer==='upper'?upperStyle[1]:accent};
    if(v.type==='slash')design.slash(v.x,v.y,v.angle,v.rx,v.ry,ink,opts);
    else if(v.type==='circle')design.area(v.x,v.y,v.radius,ink,{...opts,motif:['F03','F08','F14','F16'].includes(base.code)?'blast':'pulse'});
    else if(v.type==='rect')design.front(v.x,v.y,v.angle,v.width,v.depth,ink,opts);
    else if(v.type==='line'&&v.width<=2)design.lightning(v.x,v.y,v.x2,v.y2,ink,{...opts,seed:Math.round(v.x+v.y)});
    else if(v.type==='line')design.rail(v.x,v.y,v.x2,v.y2,v.width,ink,{...opts,passive:v.age>.035});
    else if(v.type==='link')design.rail(v.x,v.y,v.x2,v.y2,1,accent,{...opts,passive:true});
   };
   for(const e of q.effects){
    const layer=e.channel.startsWith('upper')?'upper':'base',ink=layer==='upper'?upperStyle[0]:color;
    if(e.type==='bolt'){
     if(visible(e.x,e.y))design.bolt(e.x,e.y,Math.atan2(e.vy,e.vx),e.radius,ink,{detail,aux:e.c<.3,fade:.95});
    }else if(e.type==='lance'){
     if(e.age<e.delay||!visible(e.x,e.y))continue;
     const a=e.phase==='out'?Math.atan2(e.vy,e.vx):Math.atan2(r.player.y-e.y,r.player.x-e.x);
     if(primitives)primitives.skillCraft(e.x,e.y,e.radius,a,ink,true,base.code==='F14');else design.bolt(e.x,e.y,a,e.radius,ink,{detail,lance:true});
    }else if(e.type==='ring'){
     const t=e.age/e.half,radius=Math.max(0,e.start+(e.radius-e.start)*(t<=1?t:2-t));
     if(visible(e.x,e.y,e.radius+e.width))design.annulus(e.x,e.y,radius,e.width,ink,{detail,fade:.8,back:t>1});
    }else if(e.type==='blast'){
     if(!visible(e.x,e.y,e.radius))continue;
     const t=Math.min(1,e.age/e.delay);design.area(e.x,e.y,e.radius,ink,{detail,warning:true,fade:.65});
     const x=e.sx+(e.x-e.sx)*t,y=e.sy+(e.y-e.sy)*t-(motion?Math.sin(t*Math.PI)*22:0),a=Math.atan2(e.y-e.sy,e.x-e.sx);
     design.bolt(x,y,a,7,ink,{detail,fade:.9,lance:true});
    }else if(e.type==='mine'){
     if(!visible(e.x,e.y,e.radius))continue;
     if(e.transport&&e.age<e.transport){const t=e.age/e.transport;design.mine(e.sx+(e.x-e.sx)*t,e.sy+(e.y-e.sy)*t,ink,{detail,armed:false});}
     else{design.mine(e.x,e.y,ink,{detail,armed:e.age>=e.delay,progress:e.age/e.delay,chain:e.chain});
      if(detail)design.area(e.x,e.y,e.sensor,ink,{detail:false,warning:true,fade:.55});
      if(e.triggerAt!=null)design.area(e.x,e.y,18,accent,{detail:false,fade:.7});}
    }else if(e.type==='rect'&&!e.done){if(visible(e.x,e.y,Math.max(e.width,e.depth)))design.front(e.x,e.y,e.angle,e.width,e.depth,ink,{detail,warning:true,fade:.65});}
    else if(e.type==='zone'){
     if(visible(e.x,e.y,e.radius))design.area(e.x,e.y,e.radius,ink,{detail,zone:true,fade:.55,motif:'cut'});
    }else if(e.type==='trail'){
     if(visible((e.x+e.x2)/2,(e.y+e.y2)/2,150))design.rail(e.x,e.y,e.x2,e.y2,e.width,ink,{detail,fade:Math.min(.65,(e.life-e.age)/.2),passive:false});
    }
   }
   // Fixed-step trails can emit identical harmless echoes. Draw each geometry once, never stack 12 opaque bands.
   const echoes=new Map();for(const v of q.visuals){if(v.type==='line'&&base.code==='F12'&&v.width>2)continue;
    const key=[v.type,v.layer,v.x,v.y,v.x2,v.y2,v.radius,v.angle,v.rx,v.ry].join(':');echoes.set(key,v);
   }
   for(const v of [...echoes.values()].slice(-(detail?skillStyle.maxEchoes:10))){
    const radius=v.radius||v.rx||Math.max(v.width||0,v.depth||0,Math.hypot((v.x2??v.x)-v.x,(v.y2??v.y)-v.y));
    if(visible(v.x,v.y,radius))paint(v,Math.max(0,1-v.age/v.life)*(v.type==='circle'?.65:1));
   }
   if(f.group==='hs_crusher')design.area(r.player.x,r.player.y,250*p.size,upperStyle[0],{detail:false,warning:true,fade:.28});
   for(let i=0;i<q.units.length;i++){
    const u=q.units[i];if(!u||!visible(u.x,u.y))continue;const upper=i>=4,ink=upper?upperStyle[0]:color;
    if(base.code==='F07'&&!upper){const dx=Math.cos(u.angle)*50*p.length,dy=Math.sin(u.angle)*50*p.length;design.rail(u.x-dx,u.y-dy,u.x+dx,u.y+dy,30*p.size,ink,{detail,fade:.85});}
    else if(base.code==='F08'&&!upper){if(primitives)primitives.skillCraft(u.x,u.y,12*p.size,u.angle+Math.PI/2,ink,true);}
    else if(f.group==='hs_fleet'&&upper){if(primitives)primitives.skillCraft(u.x,u.y,12,Math.atan2(u.y-r.player.y,u.x-r.player.x)+Math.PI/2,ink,true,true);}
    else if(['F02','F09','F12','F16'].includes(base.code)&&!upper||f.group==='hs_barrage'&&upper){
     const target=r.enemies.find(e=>e.id===(upper?q.baseTargets?.[0]:u.lastTarget));const a=target?Math.atan2(target.y-u.y,target.x-u.x):q.angle||0;
     if(primitives)primitives.skillEmitter(u.x,u.y,a,ink,true,upper);
    }else{
     design.mine(u.x,u.y,ink,{detail,armed:true,progress:1});
     if(detail&&upper)design.area(u.x,u.y,17,accent,{detail:false,warning:true,fade:.45});
    }
   }
  }
 }
 return {drawFusions};
}
