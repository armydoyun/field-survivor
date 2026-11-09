import { runRandom } from '../../core/random.js';
import { targetable } from '../rules.js';
import { applySlow, pushEnemy } from '../control.js';
import { segmentEntry } from '../../math/geometry.js';
export const STEP=1/120;
export function createFusionContext(r,q,f,p,combat,view,inspector){
  let layer='base';const player=r.player,label=tag=>f.id+':'+tag;
  const alive=e=>view.mode==='playing'&&targetable(e,r);
  const targets=(range,x=player.x,y=player.y,exclude=[])=>r.enemies.filter(e=>alive(e)&&!exclude.includes(e.id)&&Math.hypot(e.x-x,e.y-y)<=range+e.radius).sort((a,b)=>((a.x-x)**2+(a.y-y)**2)-((b.x-x)**2+(b.y-y)**2)||a.id-b.id);
  const aim=range=>targets(range*p.reach+p.aim);
  function allow(e,tag,gap=0,limit=1,period=0){
    let old=q.hits.find(h=>h.id===e.id&&h.tag===tag);
    if(old){if(q.age-old.at+1e-9<gap)return false;if(period&&Math.floor((q.age+1e-9)/period)!==old.cycleIndex)old.count=0;if(old.count>=limit)return false;old.count++;old.at=q.age;old.cycleIndex=Math.floor((q.age+1e-9)/(period||1));}
    else q.hits.push({id:e.id,tag,at:q.age,count:1,cycleIndex:Math.floor((q.age+1e-9)/(period||1))});return true;
  }
  function hit(e,c,snapshot=p,control=false,x=player.x,y=player.y){
    if(!alive(e))return;
    const crit=runRandom(r)<snapshot.crit,damage=snapshot.damage*c*(crit?snapshot.critMult:1);
    if(snapshot.frost)applySlow(e,.06*snapshot.frost,1+.2*snapshot.frost,r.time);
    if(control&&snapshot.repulsion){r.fusionPushHits||=[];const last=r.fusionPushHits.find(h=>h.id===e.id);if(!last||r.time-last.at>=.8-1e-9){pushEnemy(e,x,y,4*snapshot.repulsion);if(last)last.at=r.time;else r.fusionPushHits.push({id:e.id,at:r.time});}}
    combat.damage(e,damage,crit);
  }
  function visual(type,data,life=.12){
    const v={type,age:0,life,layer,...data};const same=q.visuals.filter(v=>v.type===type),cap=type==='slash'?8:80;
    if(same.length>=cap)q.visuals.splice(q.visuals.indexOf(same[0]),1);q.visuals.push(v);
  }
  function add(type,data,cap=32,channel=type){
    const own=q.effects.filter(e=>e.channel===channel);if(own.length>=cap)q.effects.splice(q.effects.indexOf(own[0]),1);
    if(type==='bolt'){
      const count=r.shots.length+Object.values(r.fusionStates).reduce((n,s)=>n+(s.effects||[]).filter(e=>e.type==='bolt').length,0);
      if(count>=320){const old=q.effects.find(e=>e.type==='bolt'&&e.channel===channel);if(!old)return null;q.effects.splice(q.effects.indexOf(old),1);}
    }
    const e={type,channel,age:0,life:1,hit:[],group:'g'+(++q.sequence),p:{...p},...data};q.effects.push(e);return e;
  }
  function circle(x,y,radius,c,tag,snapshot=p,gap=0,limit=1,control=true){
    inspector?.circle(x,y,radius,label(tag));visual('circle',{x,y,radius},.14);
    for(const e of r.enemies)if(alive(e)&&Math.hypot(e.x-x,e.y-y)<=radius+e.radius&&allow(e,tag,gap,limit))hit(e,c,snapshot,control,x,y);
  }
  function line(x,y,x2,y2,width,c,tag,snapshot=p,gap=0,limit=1,control=false){
    inspector?.segment(x,y,x2,y2,width/2,label(tag));visual('line',{x,y,x2,y2,width},.10);
    for(const e of r.enemies)if(alive(e)&&Number.isFinite(segmentEntry(x,y,x2,y2,e.x,e.y,e.radius+width/2))&&allow(e,tag,gap,limit))hit(e,c,snapshot,control,x,y);
  }
  function rect(x,y,angle,width,depth,c,tag,snapshot=p,limit=1){
    const cos=Math.cos(angle),sin=Math.sin(angle),points=[[-depth/2,-width/2],[depth/2,-width/2],[depth/2,width/2],[-depth/2,width/2]].map(([a,b])=>({x:x+a*cos-b*sin,y:y+a*sin+b*cos}));
    inspector?.polygon(points,label(tag));visual('rect',{x,y,angle,width,depth},.16);
    for(const e of r.enemies){const dx=e.x-x,dy=e.y-y;if(alive(e)&&Math.abs(dx*cos+dy*sin)<=depth/2+e.radius&&Math.abs(-dx*sin+dy*cos)<=width/2+e.radius&&allow(e,tag,0,limit))hit(e,c,snapshot,true,x,y);}
  }
  function bolt(x,y,angle,c,{speed=1100,distance=600,radius=5,pierce=3,group,limit=99,extra=true,inherit=true,channel='base-bolts',cap=96}={}){
    const fire=(a,damage)=>add('bolt',{x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,radius:radius*p.size,life:distance*p.length/speed,c:damage,decay:inherit&&f.needs.some(([w])=>w==='pulse')?.9:1,pierce:pierce+(inherit?p.pierce:0),bucket:group,limit},cap,channel);
    fire(angle,c);if(extra)for(let i=0;i<p.multishot;i++)fire(angle+(i%2?-1:1)*Math.ceil((i+1)/2)*Math.PI/15,c*.35);
  }
  function lightning(from,target,c,snapshot=p){if(!alive(target))return;inspector?.circle(target.x,target.y,target.radius,label('lightning'));visual('line',{x:from.x,y:from.y,x2:target.x,y2:target.y,width:2},.08);hit(target,c,snapshot);}
  function slash(range,length,width,c,tag,gap,angles,links=false){
    const memory=q.slashes[tag]||={recent:[],index:0},list=aim(range),target=list.find(e=>!memory.recent.includes(e.id))||list[0];if(!target)return false;
    const angle=angles[memory.index%angles.length],x=target.x,y=target.y;memory.index++;memory.recent.push(target.id);memory.recent=memory.recent.slice(-2);
    const rx=length*p.size/2,ry=width*p.size/2,points=Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return {x:x+Math.cos(a)*rx*Math.cos(angle)-Math.sin(a)*ry*Math.sin(angle),y:y+Math.cos(a)*rx*Math.sin(angle)+Math.sin(a)*ry*Math.cos(angle)};});
    inspector?.polygon(points,label(tag));visual('slash',{x,y,angle,rx,ry},.10);
    for(const e of r.enemies){const dx=e.x-x,dy=e.y-y,a=dx*Math.cos(angle)+dy*Math.sin(angle),b=-dx*Math.sin(angle)+dy*Math.cos(angle);if(alive(e)&&(a/(rx+e.radius))**2+(b/(ry+e.radius))**2<=1&&allow(e,tag,gap,Infinity))hit(e,c,p,true,x,y);}
    if(links)for(const e of targets(150+p.hop,x,y,[target.id]).slice(0,2))lightning({x,y},e,.18);
    return true;
  }
  const every=(key,interval,fn,delay=0)=>{const at=q.clocks[key]??delay;if(q.age+1e-9<at)return false;const result=fn();q.clocks[key]=result===false?q.age:at+interval;return result!==false;};
  const group=()=> 'g'+(++q.sequence);
  const angleTo=t=>Math.atan2(t.y-player.y,t.x-player.x);
  const placement=(t,max=300)=>{const d=Math.hypot(t.x-player.x,t.y-player.y)||1,scale=Math.min(1,max/d);return {x:player.x+(t.x-player.x)*scale,y:player.y+(t.y-player.y)*scale};};
  function unit(index,x,y,speed=1000){let u=q.units[index];if(!u)u=q.units[index]={x:player.x,y:player.y,trailX:player.x,trailY:player.y};const dx=x-u.x,dy=y-u.y,d=Math.hypot(dx,dy),v=Math.min(d,speed*STEP);if(d>350){u.x=x;u.y=y;u.trailX=x;u.trailY=y;}else if(d){u.x+=dx/d*v;u.y+=dy/d*v;}return u;}
  return {r,q,f,p,player,inspector,label,visualLayer:value=>{layer=value;},running:()=>view.mode==='playing',alive,targets,aim,allow,hit,visual,add,circle,line,rect,bolt,lightning,slash,every,group,angleTo,placement,unit};
}
