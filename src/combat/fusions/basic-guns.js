export function tickGuns(c,code,interval){
  const {p,q,player,every,aim,bolt,group,line,rect,unit}=c;
  if(code==='F01'){
    every('main',interval,()=>{const t=aim(640)[0];if(!t)return false;const angle=c.angleTo(t);q.angle=angle;q.baseTargets=[t.id];
      bolt(player.x,player.y,angle,.55,{speed:1050,distance:680,radius:6,pierce:6});
      for(const side of [-1,1])bolt(player.x,player.y,angle+side*8*Math.PI/180,.24,{speed:1050,distance:680,radius:5,pierce:6,extra:false});
    });
    every('rift',.4,()=>{if(!aim(640).length)return false;const a=q.angle||0,g=group();for(const side of [-1,1]){const x=player.x-Math.sin(a)*14*side,y=player.y+Math.cos(a)*14*side;line(x,y,x+Math.cos(a)*600*p.length,y+Math.sin(a)*600*p.length,28*p.size,.2,g);}});
  }
  if(code==='F02'){
    const devices=[unit(0,player.x-80,player.y),unit(1,player.x+80,player.y)],chosen=[];
    for(let i=0;i<2;i++)every('gun'+i,interval,()=>{const u=devices[i],list=c.targets(520*p.reach+p.aim,u.x,u.y),t=list.find(e=>!chosen.includes(e.id)&&!(i===1&&q.age-(devices[0].lastFire??-10)<.08&&e.id===devices[0].lastTarget))||list[0];if(!t)return false;chosen.push(t.id);u.lastTarget=t.id;u.lastFire=q.age;q.baseTargets=devices.map(d=>d.lastTarget).filter(Number.isInteger);bolt(u.x,u.y,Math.atan2(t.y-u.y,t.x-u.x),.38);},i*.04);
  }
  if(code==='F09'){
    every('main',interval,()=>{const t=aim(600)[0];if(!t)return false;const a=c.angleTo(t),g=group();q.angle=a;q.baseTargets=[t.id];
      for(let i=0;i<4;i++){const side=(i-1.5)*100,x=player.x+Math.cos(a)*120-Math.sin(a)*side,y=player.y+Math.sin(a)*120+Math.cos(a)*side;unit(i,x,y);bolt(x,y,a,.22,{speed:800,distance:640,pierce:4,group:g,limit:2,cap:64});}});
    every('wall',.6,()=>{const t=aim(600)[0];if(!t)return false;const a=c.angleTo(t);rect(player.x+Math.cos(a)*120,player.y+Math.sin(a)*120,a,320*p.size,80*p.size,.45,group());});
  }
}
