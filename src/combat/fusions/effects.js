import { segmentEntry } from '../../math/geometry.js';
export function tickEffects(c,dt){
  const {q,p,player,alive,allow,hit,visual,circle,rect,targets,lightning}=c;
  for(const e of [...q.effects]){
    if(!q.effects.includes(e))continue;
    c.visualLayer(e.channel.startsWith('upper')?'upper':'base');const oldAge=e.age;e.age+=dt;const snap=e.p;
    if(e.type==='bolt'){
      const x=e.x,y=e.y;e.x+=e.vx*dt;e.y+=e.vy*dt;
      c.inspector?.segment(x,y,e.x,e.y,e.radius,c.label('bolt'));
      const list=c.r.enemies.filter(t=>alive(t)&&!e.hit.includes(t.id)).map(t=>({t,at:segmentEntry(x,y,e.x,e.y,t.x,t.y,t.radius+e.radius)})).filter(v=>Number.isFinite(v.at)).sort((a,b)=>a.at-b.at||a.t.id-b.t.id);
      for(const {t}of list){e.hit.push(t.id);if(!e.bucket||allow(t,e.bucket,0,e.limit))hit(t,e.c*e.decay**(e.hit.length-1),snap);e.pierce--;if(e.pierce<=0||!alive(t)&&c.r.player.hp<=0)break;}
      if(e.pierce<=0)e.life=0;
    }
    if(e.type==='rect'&&e.age+1e-9>=e.delay&&!e.done){e.done=true;rect(e.x,e.y,e.angle,e.width,e.depth,e.c,e.bucket,snap,e.limit);}
    if(e.type==='blast'&&e.age+1e-9>=e.delay&&!e.done){e.done=true;circle(e.x,e.y,e.radius,e.c,e.group,snap);}
    if(e.type==='mine'&&e.age+1e-9>=e.delay){
      c.inspector?.circle(e.x,e.y,e.sensor,c.label('mine-sensor'),'sensor');
      const triggered=e.triggerAt!=null?q.age+1e-9>=e.triggerAt:targets(e.sensor,e.x,e.y).length>0;
      if(triggered&&!e.done){e.done=true;e.life=0;
        circle(e.x,e.y,e.radius,e.c,e.bucket,snap,0,2);
        if(e.chain)for(const other of q.effects)if(other!==e&&other.type==='mine'&&other.chain&&!other.done&&other.triggerAt==null&&Math.hypot(e.x-other.x,e.y-other.y)<=180){other.triggerAt=q.age+.1;other.bucket=e.bucket;visual('link',{x:e.x,y:e.y,x2:other.x,y2:other.y},.12);}
      }
    }
    if(e.type==='ring'){
      e.x=player.x;e.y=player.y;
      if(e.center&&oldAge<.06&&e.age+1e-9>=.06)circle(e.x,e.y,75*snap.size,.35,e.group+'center',snap);
      // Split a step at the turnaround: neither fast expansion nor return may skip a contact.
      for(const phase of [0,1]){
        const start=Math.max(oldAge,phase*e.half),end=Math.min(e.age,(phase+1)*e.half);if(end<start||end<phase*e.half||start>(phase+1)*e.half)continue;
        const radius=age=>e.start+(e.radius-e.start)*(phase?2-age/e.half:age/e.half),a=radius(start),b=radius(end),inner=Math.max(0,Math.min(a,b)-e.width/2),outer=Math.max(a,b)+e.width/2;
        c.inspector?.band(e.x,e.y,inner,outer,c.label('ring'));
        for(const t of c.r.enemies){const d=Math.hypot(t.x-e.x,t.y-e.y);if(alive(t)&&d+t.radius>=inner&&d-t.radius<=outer&&!e.hit.includes(t.id+':'+phase)){
          e.hit.push(t.id+':'+phase);hit(t,phase?e.back:e.out,snap,true,e.x,e.y);
          if(e.links&&e.linkCount<8)for(const next of targets(160+snap.hop,t.x,t.y,[t.id]).slice(0,Math.min(2,8-e.linkCount)))if(allow(next,e.group+'link',0,2)){e.linkCount++;lightning(t,next,.25,snap);}
        }}
      }
    }
    if(e.type==='zone')while(e.age+1e-9>=e.next&&e.next<e.life){
      if(e.first){circle(e.x,e.y,e.radius,.4,e.group+'first',snap);e.first=false;e.next=.26;}
      else{circle(e.x,e.y,e.radius,.2,'zone-pulse',snap,.2,Infinity);e.next+=.2;}
    }
    if(e.type==='trail')c.line(e.x,e.y,e.x2,e.y2,e.width,.2,'trail',snap,.25,Infinity);
    if(e.type==='lance'&&e.age+1e-9>=e.delay){
      const active=Math.min(dt,e.age-e.delay),x=e.x,y=e.y;
      if(e.phase==='out'){
        const d=Math.hypot(e.vx,e.vy)*active,scale=Math.min(d,e.distance-e.travel)/(d||1);e.x+=e.vx*active*scale;e.y+=e.vy*active*scale;e.travel+=d*scale;
      }else{const dx=player.x-e.x,dy=player.y-e.y,d=Math.hypot(dx,dy),move=Math.min(d,e.returnSpeed*active);e.x+=dx/(d||1)*move;e.y+=dy/(d||1)*move;if(d<=move+1)e.life=0;}
      c.inspector?.segment(x,y,e.x,e.y,e.radius,c.label('lance-'+e.phase));
      for(const t of c.r.enemies)if(alive(t)&&!e.hit.includes(t.id+':'+e.phase)&&Number.isFinite(segmentEntry(x,y,e.x,e.y,t.x,t.y,t.radius+e.radius))){e.hit.push(t.id+':'+e.phase);if(allow(t,e.bucket+e.phase,0,2))hit(t,e.phase==='out'?e.c:e.back,snap);}
      if(e.phase==='out'&&e.travel>=e.distance-1e-7){e.phase='back';if(e.blast)circle(e.x,e.y,110*snap.size,1.1,e.bucket+'blast',snap,0,2);}
    }
    if(!c.running())break;
  }
  q.effects=q.effects.filter(e=>e.age<e.life-1e-9);
  q.visuals=q.visuals.filter(v=>{v.age+=dt;return v.age<v.life;});
  q.hits=q.hits.filter(h=>q.age-h.at<6);
}
