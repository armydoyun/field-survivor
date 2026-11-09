export function tickFields(c,code,interval){
  const {p,q,player,every,aim,add,group,circle,placement}=c;
  if(code==='F03'||code==='F16')every('main',interval,()=>{
    const list=aim(code==='F03'?480:360);if(!list.length)return false;const count=code==='F03'?3:2,g=group();
    for(let i=0;i<count;i++){const t=list[i%list.length],pos=placement(t);if(list.length<count){const a=i*Math.PI*2/count;pos.x+=Math.cos(a)*30;pos.y+=Math.sin(a)*30;const clamped=placement(pos);pos.x=clamped.x;pos.y=clamped.y;}
      add('mine',{...pos,sx:player.x+(i?60:-60),sy:player.y,life:code==='F03'?4:3,delay:code==='F03'?.08:.16,transport:code==='F16'?.10:0,radius:(code==='F03'?110:105)*p.size,sensor:(code==='F03'?70:65)*p.size,c:code==='F03'?1.5:1.15,bucket:g,chain:code==='F03'},18,'mines');}
  });
  if(code==='F04'||code==='F11')every('main',interval,()=>{
    if(code==='F11'&&!aim(240).length)return false;
    add('ring',{x:player.x,y:player.y,life:code==='F04'?.8:.6,half:code==='F04'?.4:.3,radius:(code==='F04'?220:240)*p.size,width:36*p.size,start:code==='F04'?0:30*p.size,out:code==='F04'?.6:.55,back:.45,center:code==='F04',links:code==='F11',linkCount:0},4,'rings');
  });
  if(code==='F10')every('main',interval,()=>{
    const t=aim(520)[0];if(!t)return false;const a=c.angleTo(t),g=group();
    for(let i=0;i<3;i++)add('rect',{x:player.x+Math.cos(a)*(50+100*i)*p.length,y:player.y+Math.sin(a)*(50+100*i)*p.length,angle:a,width:320*p.size,depth:80*p.size,c:[.9,.7,.6][i],delay:.06+i*.1,bucket:g,limit:2,life:.06+i*.1},9,'strips');
  });
  if(code==='F13')every('main',interval,()=>{
    const centers=[];for(const t of aim(520))if(centers.every(e=>Math.hypot(t.x-e.x,t.y-e.y)>=160))centers.push(t);
    if(!centers.length)return false;for(const t of centers.slice(0,3))add('zone',{x:t.x,y:t.y,radius:110*p.size,life:1.3,next:.06,first:true},9,'zones');
  });
  if(code==='F15')every('main',interval,()=>c.slash(330,160,70,1.05,'base-slash',.075,[0,Math.PI/3,-Math.PI/3]));
  if(code==='F07')every('main',interval,()=>circle(player.x,player.y,90*p.size,.22,group()));
  if(code==='F08')every('main',interval,()=>{
    const list=aim(480),t=list.find(e=>!q.recent.includes(e.id))||list[0];if(!t)return false;q.recent.push(t.id);q.recent=q.recent.slice(-2);
    add('blast',{x:t.x,y:t.y,sx:player.x,sy:player.y,delay:.14,life:.14,radius:100*p.size,c:1},6,'meteors');
  });
}
