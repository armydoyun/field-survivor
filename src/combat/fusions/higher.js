import { fusionInterval } from '../fusion-parameters.js';
export function tickHigher(c){
  const {f,p,q,player,every,aim,group,circle,add,unit,bolt,targets,lightning}=c,interval=fusionInterval(f,p);
  if(f.group==='hs_barrage'){
    const chosen=[];for(let i=0;i<2;i++){const u=unit(4+i,player.x+(i?150:-150),player.y);every('upper'+i,interval,()=>{const list=targets(650*p.reach+p.aim,u.x,u.y),t=list.find(e=>!chosen.includes(e.id)&&!q.baseTargets.includes(e.id))||list.find(e=>!chosen.includes(e.id))||list[0];if(!t)return false;chosen.push(t.id);bolt(u.x,u.y,Math.atan2(t.y-u.y,t.x-u.x),.3,{distance:700,radius:7,pierce:5,extra:false,inherit:false,cap:48,channel:'upper-bolts'});});}
  }
  if(f.group==='hs_storm'){
    const centers=[player,unit(4,player.x-180,player.y),unit(5,player.x+180,player.y)];
    every('upper',interval,()=>{const g=group();for(const u of centers.slice(1))circle(u.x,u.y,115*p.size,.35,g,p,0,2);});
    every('upper-lightning',.3,()=>{const list=c.r.enemies.filter(e=>c.alive(e)&&centers.some(u=>Math.hypot(e.x-u.x,e.y-u.y)<=300*p.reach+p.aim+e.radius)).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)||a.id-b.id);if(!list.length)return false;for(const t of list.slice(0,3)){const u=centers.reduce((a,b)=>Math.hypot(t.x-a.x,t.y-a.y)<Math.hypot(t.x-b.x,t.y-b.y)?a:b);lightning(u,t,.45);}});
  }
  if(f.group==='hs_fleet'){
    for(let i=0;i<2;i++){const a=q.age*2+i*Math.PI,u=unit(4+i,player.x+Math.cos(a)*110,player.y+Math.sin(a)*110);every('upper'+i,interval,()=>{const t=targets(600*p.reach+p.aim,u.x,u.y)[0];if(!t)return false;bolt(u.x,u.y,Math.atan2(t.y-u.y,t.x-u.x),.4,{speed:1000,distance:700,radius:8,pierce:4,extra:false,inherit:false,cap:48,channel:'upper-bolts'});});}
    every('upper-wave',.8,()=>circle(player.x,player.y,150*p.size,.5,group()));
  }
  if(f.group==='hs_crusher'){
    every('upper',interval,()=>circle(player.x,player.y,250*p.size,.32,group()));
    every('upper-cut',.5,()=>{const list=aim(420),angles=[];for(const t of list){const a=c.angleTo(t);if(angles.every(b=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))>=Math.PI/4))angles.push(a);if(angles.length===3)break;}if(!angles.length)return false;const g=group();for(const a of angles)c.rect(player.x+Math.cos(a)*280*p.length,player.y+Math.sin(a)*280*p.length,a,70*p.size,200*p.length,.6,g);});
  }
  if(f.group==='hs_frontline')every('upper',interval,()=>{const t=aim(600)[0];if(!t)return false;const a=c.angleTo(t),g=group();for(let i=0;i<2;i++)add('rect',{x:player.x+Math.cos(a)*(140+180*i)*p.length,y:player.y+Math.sin(a)*(140+180*i)*p.length,angle:a,width:380*p.size,depth:100*p.size,c:.75,delay:.06+i*.12,life:.06+i*.12,bucket:g,limit:2},8,'upper-strips');});
  if(f.group==='hs_thunder_slash')every('upper',interval,()=>c.slash(430,200,85,.45,'upper-slash',.09,[Math.PI/6,-Math.PI/6],true));
}
