import { sites, objectives } from '../data/world.js';
import { W, H } from '../core/config.js';
import { clamp } from '../core/utils.js';

export function createNavigation({ sessionState, platform, journey, cameraView, primitives }) {
  const { ctx } = platform;

  function navigationTargets(){
    const result=[],p=sessionState.run.player,add=(id,point,name,color,reach=80,priority=1)=>{if(point&&Number.isFinite(point.x)&&Number.isFinite(point.y)){const distance=Math.hypot(point.x-p.x,point.y-p.y);result.push({id,x:point.x,y:point.y,name:name||'목표',color,reach,priority,distance});}};
    add('site',sessionState.run.site,sites[sessionState.run.siteStep]?.title||'탐사','#efd2a0',74);
    const o=sessionState.run.objective;if(o){const target=o.id==='hunter'&&o.phase?sessionState.run.enemies.find(e=>e.id===o.targetId&&e.hp>0):o;add('objective',target,objectives[sessionState.run.objectiveStep]?.name||'임무','#a5e0cf',o.phase?95:75,o.phase?0:1);}
    if(sessionState.run.npc.spawned&&sessionState.run.npc.state==='waiting')add('witness',sessionState.run.npc,'낯선 신호','#b6d6b9',75);
    const a=sessionState.run.journey.active;if(a){const target=a.kind==='hunt'?sessionState.run.enemies.find(e=>e.id===a.targetId&&e.hp>0):a;add('journey',target,journey.episodeTitle(a.kind),'#8ed9cc',a.kind==='relay'?88:60,0);}
    if(sessionState.run.finalStep===2)for(const e of sessionState.run.enemies)if(e.hp>0){if(e.coreNode)add('node-'+e.id,e,'연결점','#dfbd8b',90,0);else if(e.final&&sessionState.run.journey.core?.phase===1)add('core',e,'중심핵','#edc69b',250,0);}
    return result.sort((a,b)=>a.priority-b.priority||a.distance-b.distance||a.id.localeCompare(b.id));
  }

  function navigationLayout(targets,cx,cy,measure=text=>text.length*8){
    const p=sessionState.run.player,left=cx-W/2-cameraView.camera.shakeX+8,top=cy-H/2-cameraView.camera.shakeY+8,right=left+W-16,bottom=top+H-16,placed=[];
    for(const t of targets.filter(t=>t.distance>t.reach).slice(0,4)){
      const angle=Math.atan2(t.y-p.y,t.x-p.x),ux=Math.cos(angle),uy=Math.sin(angle),text=(t.name.length>10?t.name.slice(0,9)+'…':t.name)+' · '+Math.round(t.distance),w=Math.min(186,measure(text)+22),h=24;
      let radius=62;for(let tries=0;tries<4;tries++){if(!placed.some(q=>Math.hypot(q.x-p.x-ux*radius,q.y-p.y-uy*radius)<22))break;radius+=24;}
      const limit=Math.min(Math.abs(ux)>.001?(ux>0?right-p.x:p.x-left)/Math.abs(ux):1e6,Math.abs(uy)>.001?(uy>0?bottom-p.y:p.y-top)/Math.abs(uy):1e6);
      radius=Math.max(12,Math.min(radius,t.distance-24,limit-12));const x=p.x+ux*radius,y=p.y+uy*radius,lx=clamp(x+(ux>=0?17:-w-17),left,right-w),ly=clamp(y-h/2,top,bottom-h);
      placed.push({...t,angle,x,y,lx,ly,w,h,text,outside:t.x<left||t.x>right||t.y<top||t.y>bottom});
    }
    const resolved=[];for(const m of placed){const base=m.ly,collides=y=>placed.some(q=>m.lx<q.x+12&&m.lx+m.w>q.x-12&&y<q.y+12&&y+m.h>q.y-12)||resolved.some(q=>m.lx<q.lx+q.w+4&&m.lx+m.w+4>q.lx&&y<q.ly+q.h+4&&y+m.h+4>q.ly);for(let i=0;i<20&&collides(m.ly);i++)m.ly=clamp(base+(i%2?-1:1)*Math.ceil((i+1)/2)*28,top,bottom-m.h);resolved.push(m);}
    return placed;
  }

  function drawNavigation(cx,cy){
    ctx.save();ctx.font='12px system-ui';ctx.textAlign='left';ctx.textBaseline='middle';ctx.setLineDash([]);ctx.lineCap='round';ctx.lineJoin='round';
    const markers=navigationLayout(navigationTargets(),cx,cy,text=>ctx.measureText(text)?.width||text.length*8);
    for(const m of markers){ctx.strokeStyle=m.color;ctx.lineWidth=1;ctx.globalAlpha=m.outside?.7:.4;ctx.beginPath();ctx.moveTo(m.x,m.y);ctx.lineTo(m.lx+(m.lx>m.x?0:m.w),m.ly+m.h/2);ctx.stroke();ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.angle);ctx.globalAlpha=1;ctx.fillStyle='#142630';ctx.strokeStyle=m.color;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-5,-7);ctx.lineTo(-1,0);ctx.lineTo(-5,7);ctx.closePath();ctx.fill();ctx.stroke();if(m.outside){ctx.beginPath();ctx.moveTo(-10,-4);ctx.lineTo(-6,0);ctx.lineTo(-10,4);ctx.stroke();}ctx.restore();
    }
    for(const m of markers){ctx.globalAlpha=.9;ctx.fillStyle='#101f2a';ctx.beginPath();ctx.roundRect(m.lx,m.ly,m.w,m.h,6);ctx.fill();ctx.globalAlpha=m.outside?.85:.5;ctx.strokeStyle=m.color;ctx.lineWidth=.8;ctx.stroke();ctx.globalAlpha=1;primitives.drawShape(m.lx+8,m.ly+m.h/2,2.5,m.color,4);ctx.fillStyle=m.color;ctx.fillText(m.text,m.lx+15,m.ly+m.h/2,m.w-20);
    }
    ctx.restore();
  }

  return { drawNavigation };
}
