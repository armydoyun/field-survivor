import { STEP } from './context.js';
export function tickMobile(c,code,interval){
  const {p,q,player,every,aim,group,circle,add,line,unit,lightning,targets,allow}=c;
  if(code==='F05'||code==='F14')every('main',interval,()=>{
    const list=aim(code==='F05'?600:560);if(!list.length)return false;const g=group();
    for(let i=0;i<(code==='F05'?4:3);i++){
      const a=code==='F05'?c.angleTo(list[0])+[-24,-8,8,24][i]*Math.PI/180:c.angleTo(list[i%list.length])+(list.length===1?(i-1)*.18:0),distance=500*p.length;
      add('lance',{x:player.x,y:player.y,sx:player.x,sy:player.y,vx:Math.cos(a)*(code==='F05'?1000:1100),vy:Math.sin(a)*(code==='F05'?1000:1100),radius:(code==='F05'?14:13)*p.size,delay:code==='F05'?0:i*.08,travel:0,distance,phase:'out',life:2,c:code==='F05'?.65:.55,back:code==='F05'?.45:.35,returnSpeed:code==='F05'?1100:1200,blast:code==='F14',bucket:g},code==='F05'?24:12,'lances');
    }
  });
  if(code==='F06'){
    for(let i=0;i<4;i++){const a=q.age+i*Math.PI/2;unit(i,player.x+Math.cos(a)*130,player.y+Math.sin(a)*130);}
    every('main',interval,()=>{const list=aim(220).slice(0,4);if(!list.length)return false;const g=group();
      for(let i=0;i<list.length;i++){const t=list[i];lightning(q.units[i],t,.3);const other=targets(130+p.hop,t.x,t.y,[t.id])[0];if(other&&allow(other,g))lightning(t,other,.18);}
    });
  }
  if(code==='F07'){
    const segments=Math.max(1,Math.ceil(4*STEP*150/8));
    for(let i=0;i<3;i++){
      const a=q.age*4+i*Math.PI*2/3,x=player.x+Math.cos(a)*150,y=player.y+Math.sin(a)*150,old=q.units[i];
      // Sample the swept blade orientation, including player translation. One shared ledger prevents sample damage multiplication.
      for(let j=0;j<=segments;j++){
        const t=j/segments,at=a-4*STEP*(1-t),cx=old?old.x+(x-old.x)*t:x,cy=old?old.y+(y-old.y)*t:y;
        const x1=cx-Math.cos(at)*50*p.length,y1=cy-Math.sin(at)*50*p.length,x2=cx+Math.cos(at)*50*p.length,y2=cy+Math.sin(at)*50*p.length;
        c.inspector?.segment(x1,y1,x2,y2,15*p.size,c.label('blade'));
        for(const e of c.r.enemies){const dx=x2-x1,dy=y2-y1,k=Math.max(0,Math.min(1,((e.x-x1)*dx+(e.y-y1)*dy)/(dx*dx+dy*dy||1)));if(c.alive(e)&&Math.hypot(e.x-x1-dx*k,e.y-y1-dy*k)<=e.radius+15*p.size&&allow(e,'blades',.24,5,1.2))c.hit(e,.55);}
      }
      q.units[i]={x,y,angle:a};
    }
  }
  if(code==='F08')for(let i=0;i<3;i++){
    const a=q.age*3+i*Math.PI*2/3,x=player.x+Math.cos(a)*105,y=player.y+Math.sin(a)*105;q.units[i]={x,y,angle:a};c.inspector?.circle(x,y,12*p.size,c.label('guard'));
    for(const e of c.r.enemies)if(c.alive(e)&&Math.hypot(e.x-x,e.y-y)<=e.radius+12*p.size&&allow(e,'guard',.4,Infinity))c.hit(e,.35);
  }
  if(code==='F12'){
    const devices=[unit(0,player.x-120,player.y),unit(1,player.x+120,player.y)];
    for(const u of devices)if(Math.hypot(u.x-u.trailX,u.y-u.trailY)>=60){const d=Math.hypot(u.x-u.trailX,u.y-u.trailY),k=Math.min(1,120/d);add('trail',{x:u.x-(u.x-u.trailX)*k,y:u.y-(u.y-u.trailY)*k,x2:u.x,y2:u.y,width:40*p.size,life:1},8,'trails');u.trailX=u.x;u.trailY=u.y;}
    every('main',interval,()=>{const primary=[],g=group();let fired=false;
      for(const u of devices){const list=targets(380*p.reach+p.aim,u.x,u.y),t=list.find(e=>!primary.includes(e.id))||list[0];if(!t)continue;fired=true;primary.push(t.id);lightning(u,t,.55);let from=t;const seen=[t.id];
        for(let i=0;i<2;i++){const next=targets(150+p.hop,from.x,from.y,seen)[0];if(!next)break;seen.push(next.id);if(allow(next,g))lightning(from,next,.3);from=next;}
      }return fired;
    });
  }
  if(code==='F16')for(let i=0;i<2;i++)unit(i,player.x+(i?65:-65),player.y+20);
}
