import { runRandom } from '../core/random.js';
import { chainReach, beaconRange, lanceRadius, specTiming, novaEdgeWidth, specRules, specRiftWidth, specBeaconRadius, specBeaconRest, orbitPush } from './weapon-parameters.js';
import { createSpecField, recordAttackHit } from './attack-state.js';
import { hasBranch, specialized } from '../growth/build.js';
import { clamp } from '../core/utils.js';
import { targetable } from './rules.js';
import { applySlow, pushEnemy } from './control.js';
import { nearestEnemyIn, nearestEnemy } from './targeting.js';
import { segmentHit, segmentEntry, turnSkill, moveSkillPoint, easeSkill } from '../math/geometry.js';
import { branches } from '../data/specializations.js';

export function createSpecializations({ sessionState, view, statistics, feedback, combat, inspector }) {
  function tickNovaField(f,dt,s){
    const radius=f.radius,expandTime=specTiming.novaExpand,holdTime=specTiming.novaHold,returnTime=specTiming.novaReturn,returning=hasBranch('nova','reflux',sessionState.run),previousRadius=f.length||0; let currentRadius;
    if(f.age<expandTime){currentRadius=radius*f.age/expandTime;f.phase='expand';}
    else if(returning){currentRadius=radius*(1-clamp((f.age-expandTime)/returnTime,0,1));f.phase='return';if(f.age>=expandTime+returnTime)f.life=0;}
    else{currentRadius=radius;f.phase='hold';if(f.age>=expandTime+holdTime)f.life=0;}
    f.length=Math.max(0,currentRadius);
    inspector?.band(f.x,f.y,Math.max(0,Math.min(previousRadius,currentRadius)-novaEdgeWidth),Math.max(previousRadius,currentRadius)+novaEdgeWidth,'nova:'+f.phase);
    for(const e of sessionState.run.enemies){
      if(view.mode!=='playing')break;
      if(!targetable(e,sessionState.run))continue;
      const d=Math.hypot(e.x-f.x,e.y-f.y),cross=d+e.radius>=Math.min(previousRadius,currentRadius)-novaEdgeWidth&&d-e.radius<=Math.max(previousRadius,currentRadius)+novaEdgeWidth;
      if(!cross)continue;
      if(returning&&f.phase==='expand'){if(specHit(f,e,statistics.weaponDamage('nova',s)*specRules.nova.reflux))f.marks.push(e.id);}
      else if(returning){specHit(f,e,statistics.weaponDamage('nova',s)*(f.marks.includes(e.id)?specRules.nova.marked:specRules.nova.return),'backHit');}
      else if(specHit(f,e,statistics.weaponDamage('nova',s)*(f.phase==='expand'?specRules.nova.expand:specRules.nova.hold),f.phase==='expand'?'hit':'backHit')){applySlow(e,specRules.nova.slow,specRules.nova.slowTime,sessionState.run.time);pushEnemy(e,f.x,f.y,statistics.novaPush(s));}
    }
  }
  function tickChainField(f,dt,s){
    if(f.phase==='forward'&&f.clock<=0){
      const t=sessionState.run.enemies.find(e=>e.id===f.target&&targetable(e,sessionState.run));
      if(t){
        const previous=f.points.at(-1);feedback.markSkillAttack?.(f,{kind:'target',x1:previous.x,y1:previous.y,x2:t.x,y2:t.y});f.points.push({x:t.x,y:t.y}); f.seen.push(t.id); f.index++; f.clock=specTiming.chainHop; const reach=chainReach(s),next=nearestEnemyIn(sessionState.run,reach,t.x,t.y,f.seen);
        f.target=next?.id||0; f.delay=f.index>=statistics.chainTargets(s)||!next?1:0; feedback.ring(t.x,t.y,8,'#e8d2a3',.1); inspector?.circle(t.x,t.y,t.radius,'chain target');
        specHit(f,t,statistics.weaponDamage('chain',s,f.index-1)*specRules.chain.forward);
      }
      else f.delay=1;
      if(f.delay){
        if(hasBranch('chain','return',sessionState.run)){f.phase='reverse';f.index=f.points.length-1;f.clock=specTiming.chainTurn;}
        else{
          f.phase='loop'; f.clock=specTiming.chainLoop;
          if(f.points.length===2){const c=f.points[1];f.points=[{x:c.x-20,y:c.y},{x:c.x,y:c.y-20},{x:c.x+20,y:c.y},{x:c.x,y:c.y+20}];}else if(f.points.length>2)f.points.shift();
        }
      }
    }
    else if(f.phase==='reverse'&&f.clock<=0){
      if(f.index>0){const a=f.points[f.index],b=f.points[f.index-1];f.index--;f.clock=specTiming.chainHop;specLine(f,a.x,a.y,b.x,b.y,8,statistics.weaponDamage('chain',s,Math.max(0,f.index-1))*specRules.chain.reverse,'backHit',0,1);}
      else f.life=0;
    }
    else if(f.phase==='loop'){
      if(f.clock<=0)f.life=0;
      else for(let i=0;i<f.points.length&&view.mode==='playing';i++){const a=f.points[i],b=f.points[(i+1)%f.points.length];specLine(f,a.x,a.y,b.x,b.y,5,statistics.weaponDamage('chain',s)*specRules.chain.loop,'backHit',specRules.chain.gap,specRules.chain.cap);}
    }
  }
  function tickLanceField(f,dt,s){
    const p=sessionState.run.player; const ox=f.x,oy=f.y,w=lanceRadius(s);
    if(f.phase==='out'){
      f.x+=f.dx*690*dt; f.y+=f.dy*690*dt;
      const contacts=sessionState.run.enemies.filter(e=>targetable(e,sessionState.run)&&segmentHit(ox,oy,f.x,f.y,e.x,e.y,e.radius+w)).sort((a,b)=>segmentEntry(ox,oy,f.x,f.y,a.x,a.y,a.radius+w)-segmentEntry(ox,oy,f.x,f.y,b.x,b.y,b.radius+w));
      feedback.markSkillAttack?.(f,{kind:'line',x1:ox,y1:oy,x2:f.x,y2:f.y,width:w});inspector?.segment(ox,oy,f.x,f.y,w,'lance:out');
      for(const e of contacts){if(view.mode!=='playing'||f.count>=f.pierce)break;if(!f.hit.some(h=>h.id===e.id)){f.count++;specHit(f,e,statistics.weaponDamage('lance',s)*specRules.lance.travel);}}
      if(f.age>=510/690||f.count>=f.pierce){if(hasBranch('lance','return',sessionState.run)){f.phase='back';f.count=0;}else{f.phase='stay';f.clock=specTiming.lanceStay;f.delay=0;}}
    }
    else if(f.phase==='back'){
      const d=Math.hypot(p.x-f.x,p.y-f.y)||1,step=Math.min(d,850*dt); f.x+=(p.x-f.x)/d*step; f.y+=(p.y-f.y)/d*step; feedback.markSkillAttack?.(f,{kind:'line',x1:ox,y1:oy,x2:f.x,y2:f.y,width:w});inspector?.segment(ox,oy,f.x,f.y,w,'lance:back');
      for(const e of sessionState.run.enemies){
        if(f.count>=f.pierce||view.mode!=='playing')break;
        if(targetable(e,sessionState.run)&&!f.backHit.some(h=>h.id===e.id)&&segmentHit(ox,oy,f.x,f.y,e.x,e.y,e.radius+w)){f.count++;specHit(f,e,statistics.weaponDamage('lance',s)*specRules.lance.travel,'backHit');}
      }
      if(d<18)f.life=0;
    }
    else{if(f.clock<=0)f.life=0;f.delay=(f.delay||0)-dt;if(f.delay<=0){f.delay=specTiming.lancePulse;specLine(f,f.x1,f.y1,f.x,f.y,w,statistics.weaponDamage('lance',s)*specRules.lance.stay,'backHit',specRules.lance.gap,specRules.lance.cap);}}
  }
  function tickMineField(f,dt,s){
    const radius=statistics.mineRadius(s),sense=14+s.placement*4;
    if(f.phase==='arm'&&f.clock<=0)f.phase='wait';
    if(f.phase==='wait'||f.phase==='pressed'){
      if(hasBranch('mine','pressure',sessionState.run)){
        inspector?.circle(f.x,f.y,sense,'mine:pressure','sensor');const inside=sessionState.run.enemies.some(e=>targetable(e,sessionState.run)&&Math.hypot(e.x-f.x,e.y-f.y)<=e.radius+sense);
        if(inside){f.occupied=true;f.phase='pressed';f.loaded+=dt;}
        if(f.occupied&&(!inside||f.loaded>=specTiming.minePressure))f.phase='open';
      }
      else{
        const t=nearestEnemyIn(sessionState.run,300,f.x,f.y);
        if(t){
          const motion=sessionState.run.arsenal.tracks.find(v=>v.id===t.id),vx=motion?clamp((t.x-motion.x)/dt,-350,350):0,vy=motion?clamp((t.y-motion.y)/dt,-350,350):0; f.sx=f.x;
          f.sy=f.y; f.tx=t.x+vx*.35; f.ty=t.y+vy*.35; f.phase='jump'; f.loaded=0;
        }
      }
    }
    else if(f.phase==='jump'){f.loaded+=dt;const t=clamp(f.loaded/specTiming.mineJump,0,1);f.x=f.sx+(f.tx-f.sx)*t;f.y=f.sy+(f.ty-f.sy)*t;if(t>=1)f.phase='open';}
    if(f.phase==='open'){
      f.life=0; inspector?.circle(f.x,f.y,radius,'mine:open'); feedback.ring(f.x,f.y,radius,'#e4ad8c',.2,'mine');
      for(const e of sessionState.run.enemies)if(view.mode==='playing'&&targetable(e,sessionState.run)&&Math.hypot(e.x-f.x,e.y-f.y)<=radius+e.radius)specHit(f,e,statistics.weaponDamage('mine',s));
    }
  }
  function tickRiftField(f,dt,s){
    const p=sessionState.run.player;
    if(hasBranch('rift','fold',sessionState.run)){
      const ux=Math.cos(f.angle),uy=Math.sin(f.angle),nx=-uy,ny=ux;
      if(f.phase==='prepare'&&f.clock<=0){f.phase='fold';f.loaded=0;}
      if(f.phase==='fold'){
        const old=f.loaded||0; f.loaded=Math.min(specTiming.riftFold,old+dt); const a1=f.width*(1-clamp(old/specTiming.riftFold,0,1)),a2=f.width*(1-f.loaded/specTiming.riftFold);feedback.markSkillAttack?.(f,{kind:'fold',outer:a1,inner:a2});
        for(const side of [-1,1]){
          const bucket=side<0?'hit':'backHit'; inspector?.rect(f.x,f.y,0,side<0?-a1-5:a2-5,f.angle,f.length,a1-a2+10,'rift:fold');
          for(const e of sessionState.run.enemies){
            if(view.mode!=='playing')break;
            const dx=e.x-f.x,dy=e.y-f.y,u=dx*ux+dy*uy,v=(dx*nx+dy*ny)*side;
            if(targetable(e,sessionState.run)&&u>=-e.radius&&u<=f.length+e.radius&&v>=a2-e.radius-5&&v<=a1+e.radius+5)specHit(f,e,statistics.weaponDamage('rift',s)*specRules.rift.side,bucket);
          }
        }
        if(f.loaded>=specTiming.riftFold){
          f.phase='open'; f.clock=specTiming.riftOpen; specLine(f,f.x,f.y,f.x+ux*f.length,f.y+uy*f.length,specRiftWidth(s),statistics.weaponDamage('rift',s)*specRules.rift.center,'marks');
          feedback.addSkillEcho('riftCut',{x:f.x,y:f.y,x2:f.x+ux*f.length,y2:f.y+uy*f.length,width:specRiftWidth(s),color:'#d5bdff'},.3);
        }
      }
      else if(f.phase==='open'&&f.clock<=0)f.life=0;
    }
    else if(f.phase==='record'){
      f.x=p.x; f.y=p.y; let target=sessionState.run.enemies.find(e=>e.id===f.target&&targetable(e,sessionState.run)&&Math.hypot(e.x-f.x,e.y-f.y)<=f.length);
      target||=nearestEnemyIn(sessionState.run,f.length,f.x,f.y);
      if(target){f.target=target.id;f.angle=turnSkill(f.angle,Math.atan2(target.y-f.y,target.x-f.x),18*dt);}
      if(f.clock<=0){
        const ux=Math.cos(f.angle),uy=Math.sin(f.angle); f.points=[{x:f.x,y:f.y},{x:f.x+ux*f.length,y:f.y+uy*f.length}]; f.index=Math.max(0,f.index||0)+1;
        specLine(f,f.x,f.y,f.points[1].x,f.points[1].y,f.width,statistics.weaponDamage('rift',s)*(f.index===1?specRules.rift.first:specRules.rift.follow),'hit',0,specRules.rift.cuts); f.phase='open'; f.clock=specTiming.riftGlow;
        feedback.addSkillEcho('riftCut',{x:f.x,y:f.y,x2:f.points[1].x,y2:f.points[1].y,width:f.width,color:'#addfff'},.28);
      }
    }
    else if(f.phase==='open'&&f.clock<=0){if(f.index>=specRules.rift.cuts)f.life=0;else{f.phase='record';f.clock=specTiming.riftAim;}}
  }
  const PULSE_BURST_GAP=specTiming.pulseBurst; const legacyWeaponStats=s=>({...s,...Object.fromEntries(branches.filter(b=>specialized(b.id,sessionState.run)).map(b=>[b.id,0]))});
  const specField=(owner,data)=>createSpecField(sessionState.run,owner,data);
  function specHit(f,e,amount,bucket='hit',gap=0,limit=1){
    if(view.mode!=='playing'||!targetable(e,sessionState.run))return false;
    const list=f[bucket]||(f[bucket]=[]); const accepted=recordAttackHit(list,e.id,sessionState.run.time,gap,limit);
    inspector?.hitWindow(f.owner,e.id,bucket,gap,limit,list,accepted);if(!accepted)return false;
    combat.damage(e,amount);
    if(f.owner==='orbit')pushEnemy(e,sessionState.run.player.x,sessionState.run.player.y,orbitPush(statistics.stats()));
    return true;
  }
  function specLine(f,x1,y1,x2,y2,width,amount,bucket='hit',gap=0,limit=1){
    feedback.markSkillAttack?.(f,{kind:'line',x1,y1,x2,y2,width});inspector?.segment(x1,y1,x2,y2,width,f.owner+':'+bucket);
    for(const e of sessionState.run.enemies){if(view.mode!=='playing')break;if(targetable(e,sessionState.run)&&segmentHit(x1,y1,x2,y2,e.x,e.y,e.radius+width))specHit(f,e,amount,bucket,gap,limit);}
  }
  function pulseVolley(target,s,q){
    if(!target||!targetable(target,sessionState.run))return false;
    const p=sessionState.run.player,a=Math.atan2(target.y-p.y,target.x-p.x);if(sessionState.run.shots.length<250)feedback.markSkillAttack?.(q,{kind:'muzzle',x:p.x,y:p.y,angle:a});
    for(let i=0;i<s.shots&&sessionState.run.shots.length<250;i++){
      const t=a+(i?(i%2?1:-1)*Math.ceil(i/2)*.14:0),crit=runRandom(sessionState.run)<statistics.pulseCritChance(s);
      sessionState.run.shots.push({kind:'pulse',x:p.x,y:p.y,vx:Math.cos(t)*530,vy:Math.sin(t)*530,damage:statistics.weaponDamage('pulse',s)*(i?specRules.pulse.side:1)*(crit?s.critMult:1),crit,aux:i>0,radius:s.radius,cold:s.frost>0,life:1.35,pierce:s.pierce,hit:[]});
    }
    return true;
  }
  function specPulse(dt,s,q){
    if(hasBranch('pulse','tracking',sessionState.run)){
      if(q.phase==='burst'){
        const target=sessionState.run.enemies.find(e=>e.id===q.target&&targetable(e,sessionState.run));
        if(!target){const next=nearestEnemy(sessionState.run);if(!next){q.phase='wait';q.clock=s.interval;return;}q.target=next.id;q.clock=specTiming.pulseAim;q.phase='aim';return;}
        if(q.clock<=0){q.clock=PULSE_BURST_GAP;q.left--;if(q.left<=0){q.phase='wait';q.clock=Math.max(specRules.pulse.minRest,s.interval*specRules.pulse.volleys-PULSE_BURST_GAP*(specRules.pulse.volleys-1));}pulseVolley(target,s,q);}
      }
      else if(q.phase==='aim'){if(q.clock<=0)q.phase='burst';}
      else if(q.clock<=0){const t=nearestEnemy(sessionState.run);if(t){q.target=t.id;q.left=specRules.pulse.volleys;q.phase='burst';q.clock=0;}else q.clock=.12;}
    }
    else{
      if(q.phase==='release'){
        if(q.clock<=0){
          const t=sessionState.run.enemies.find(e=>e.id===q.target&&targetable(e,sessionState.run))||nearestEnemy(sessionState.run); q.left--; q.clock=specTiming.pulseRelease;
          if(q.left<=0){q.phase='charge';q.charge=0;}
          if(t)pulseVolley(t,s,q);
        }
      }
      else{
        q.phase='charge'; q.charge=Math.min(specRules.pulse.volleys,(q.charge||0)+dt/s.interval);
        if(q.charge>=specRules.pulse.volleys){const t=nearestEnemy(sessionState.run);if(t){q.phase='release';q.left=specRules.pulse.volleys;q.target=t.id;q.clock=0;}}
      }
    }
  }
  function specOrbit(dt,s,q){
    const p=sessionState.run.player; q.units||=[];
    if(!q.units.length){const t=nearestEnemy(sessionState.run);if(t)q.angle=Math.atan2(t.y-p.y,t.x-p.x);q.aimAngle=q.angle||0;}
    q.cycle=(q.cycle||0)+dt; const period=Math.PI*2/3;
    if(q.cycle>=period){q.cycle%=period;const t=nearestEnemy(sessionState.run);if(t)q.aimAngle=Math.atan2(t.y-p.y,t.x-p.x);}
    q.angle=turnSkill(q.angle||0,q.aimAngle??q.angle??0,specRules.orbit.turn*dt);
    while(q.units.length<s.orbit){
      const a=sessionState.run.time*3+q.units.length*Math.PI*2/s.orbit,v=q.angle||0,x=Math.cos(a)*(hasBranch('orbit','escort',sessionState.run)?s.orbitRadius:specRules.orbit.major),y=Math.sin(a)*(hasBranch('orbit','escort',sessionState.run)?s.orbitRadius:specRules.orbit.minor);
      q.units.push({owner:'orbit',phase:'orbit',x:p.x+Math.cos(v)*x-Math.sin(v)*y,y:p.y+Math.sin(v)*x+Math.cos(v)*y,orbitPhase:a-3*dt,born:sessionState.run.time,clock:.3+q.units.length*.17,hit:[]});
    }
    q.units.length=s.orbit;
    for(let i=0;i<q.units.length&&view.mode==='playing';i++){
      const u=q.units[i],ox=u.x,oy=u.y,want=sessionState.run.time*3+i*Math.PI*2/s.orbit; u.orbitPhase=u.orbitPhase==null?want:turnSkill(u.orbitPhase+3*dt,want,2*dt);
      u.orbitPhase=Math.atan2(Math.sin(u.orbitPhase),Math.cos(u.orbitPhase)); const a=u.orbitPhase; u.clock-=dt;
      if(hasBranch('orbit','escort',sessionState.run)){
        const home={x:p.x+Math.cos(a)*s.orbitRadius,y:p.y+Math.sin(a)*s.orbitRadius};
        if(u.phase==='orbit'){
          moveSkillPoint(u,home,Math.max(900,s.speed+300)*dt); u.guard=true;
          if(u.clock<=0){const t=nearestEnemyIn(sessionState.run,260,u.x,u.y);if(t){const d=Math.hypot(t.x-u.x,t.y-u.y)||1;u.dx=(t.x-u.x)/d;u.dy=(t.y-u.y)/d;u.phase='out';u.age=0;u.hit=[];u.guard=false;}}
        }
        else{
          u.age=(u.age||0)+dt; u.guard=false;
          if(u.phase==='out'){u.x+=u.dx*500*dt;u.y+=u.dy*500*dt;if(u.age>=specTiming.orbitOut){u.phase='back';u.age=0;}}
          else{moveSkillPoint(u,home,Math.max(650,s.speed+s.orbitRadius*3+120)*dt);if(Math.hypot(home.x-u.x,home.y-u.y)<.01){u.phase='orbit';u.clock=.8;u.hit=[];u.guard=true;}}
          if(u.phase==='out')specLine(u,ox,oy,u.x,u.y,8,statistics.weaponDamage('orbit',s)*specRules.orbit.escort);
        }
      }
      else{
        const v=q.angle||0,x=Math.cos(a)*specRules.orbit.major,y=Math.sin(a)*specRules.orbit.minor;
        moveSkillPoint(u,{x:p.x+Math.cos(v)*x-Math.sin(v)*y,y:p.y+Math.sin(v)*x+Math.cos(v)*y},Math.max(1000,s.speed+750)*dt); u.guard=Math.hypot(u.x-p.x,u.y-p.y)<specRules.orbit.guardRadius;
        u.phase=u.guard?'orbit':'out';
        if(!u.guard)specLine(u,ox,oy,u.x,u.y,8,statistics.weaponDamage('orbit',s)*specRules.orbit.eccentric,'hit',specRules.orbit.gap,specRules.orbit.cap);
      }
      if(Math.hypot(u.x-ox,u.y-oy)>.01)u.heading=turnSkill(u.heading??Math.atan2(u.y-oy,u.x-ox),Math.atan2(u.y-oy,u.x-ox),dt*10);
    }
  }
  function specBeaconShot(b,t,s){
    if(sessionState.run.shots.length>=250)return;
    const a=Math.atan2(t.y-b.y,t.x-b.x);feedback.markSkillAttack?.(b,{kind:'muzzle',x:b.x,y:b.y,angle:a});
    sessionState.run.shots.push({kind:'beacon',x:b.x,y:b.y,vx:Math.cos(a)*570,vy:Math.sin(a)*570,damage:statistics.weaponDamage('beacon',s)*specRules.beacon.shot,crit:false,radius:4,life:1.15,pierce:1,hit:[],cold:s.frost>0});
  }
  function specBeacon(dt,s,q){
    const p=sessionState.run.player;
    if(!q.units?.length)q.units=Array.from({length:specRules.beacon.units},(_,i)=>({x:p.x+(i?42:-42),y:p.y,phase:'shoot',clock:i*.2,left:specRules.beacon.shots,born:sessionState.run.time}));
    if(hasBranch('beacon','relay',sessionState.run)){
      q.life=(q.life??specTiming.beaconLife)-(q.phase==='move'?0:dt);
      if(q.life<=0){
        for(const [i,b]of q.units.entries())Object.assign(b,{sx:b.x,sy:b.y,tx:p.x+(i?42:-42),ty:p.y,phase:'move'});
        q.life=specTiming.beaconLife; q.phase='move'; q.deployTime=Math.max(specRules.beacon.relayMove,...q.units.map(b=>Math.hypot(b.tx-b.sx,b.ty-b.sy)*1.5/specRules.beacon.moveSpeed)); q.clock=q.deployTime;
      }
      if(q.phase==='move'){
        const t=easeSkill(1-q.clock/(q.deployTime||specRules.beacon.relayMove));
        for(const b of q.units){b.x=b.sx+(b.tx-b.sx)*t;b.y=b.sy+(b.ty-b.sy)*t;if(q.clock<=0)b.phase='shoot';}
        if(q.clock<=0)q.phase='observe';
        return;
      }
      if(q.clock>0)return;
      const index=q.index||0,b=q.units[index];
      if(q.phase==='flight'){
        q.phase='observe'; q.clock=specBeaconRest(s); q.index=1-index; inspector?.circle(q.tx,q.ty,specBeaconRadius(s),'beacon:impact');
        feedback.ring(q.tx,q.ty,specBeaconRadius(s),'#a2e4ff',.2,'artillery');
        for(const e of sessionState.run.enemies)if(view.mode==='playing'&&targetable(e,sessionState.run)&&Math.hypot(e.x-q.tx,e.y-q.ty)<=specBeaconRadius(s)+e.radius)combat.damage(e,statistics.weaponDamage('beacon',s)*specRules.beacon.impact);
      }
      else if(q.phase==='prepare'){const t=sessionState.run.enemies.find(e=>e.id===q.target&&targetable(e,sessionState.run));if(t){q.tx=t.x;q.ty=t.y;}q.phase='flight';q.clock=specTiming.beaconFlight;}
      else{const t=nearestEnemyIn(sessionState.run,beaconRange(s),b.x,b.y);if(t){q.target=t.id;q.tx=t.x;q.ty=t.y;q.phase='prepare';q.clock=specTiming.beaconAim;}else q.clock=.15;}
    }
    else for(const [i,b]of q.units.entries()){
      b.clock-=dt;
      if(b.clock>0)continue;
      if(b.phase==='shoot'){
        const t=nearestEnemyIn(sessionState.run,beaconRange(s),b.x,b.y);
        if(!t){b.clock=.15;continue;}
        b.clock=statistics.beaconShotInterval(s); b.left--;
        if(b.left<=0){b.phase='pack';b.clock=specTiming.beaconPack;}
        specBeaconShot(b,t,s);
      }
      else if(b.phase==='pack'){
        const t=nearestEnemyIn(sessionState.run,650),a=t?Math.atan2(t.y-p.y,t.x-p.x):sessionState.run.time; b.sx=b.x; b.sy=b.y;
        for(let offset=48;offset<=240;offset+=48){
          const side=i%2?1:-1; b.tx=p.x+Math.cos(a)*85-Math.sin(a)*offset*side; b.ty=p.y+Math.sin(a)*85+Math.cos(a)*offset*side;
          if(!q.units.some(other=>other!==b&&Math.hypot(b.tx-(other.phase==='move'?other.tx:other.x),b.ty-(other.phase==='move'?other.ty:other.y))<64))break;
        }
        b.phase='move'; b.age=0; b.moveTime=Math.max(specRules.beacon.roverMove,Math.hypot(b.tx-b.sx,b.ty-b.sy)*1.5/specRules.beacon.moveSpeed); b.clock=b.moveTime;
      }
      else if(b.phase==='move'){b.phase='deploy';b.clock=specTiming.beaconDeploy;b.x=b.tx;b.y=b.ty;}
      else{b.phase='shoot';b.left=specRules.beacon.shots;b.clock=0;}
    }
    if(hasBranch('beacon','rover',sessionState.run))for(const b of q.units)if(b.phase==='move'){b.age=(b.age||0)+dt;const t=easeSkill(b.age/(b.moveTime||specRules.beacon.roverMove));b.x=b.sx+(b.tx-b.sx)*t;b.y=b.sy+(b.ty-b.sy)*t;}
  }
  function startSpecWeapon(id,s,q){
    const p=sessionState.run.player,t=nearestEnemyIn(sessionState.run,id==='rift'?statistics.riftLength(s):490);
    if(!t&&id!=='mine'){q.clock=.12;return;}
    if(id==='nova'){q.clock=statistics.novaInterval(s.nova);specField(id,{phase:'expand',radius:statistics.novaRadius(s),life:1.6});}
    if(id==='chain'){q.clock=statistics.chainReload(s);specField(id,{phase:'forward',target:t.id,points:[{x:p.x,y:p.y}],clock:0,index:0,life:4});}
    if(id==='lance'){
      q.clock=statistics.lanceInterval(s); const a=Math.atan2(t.y-p.y,t.x-p.x);
      specField(id,{phase:'out',x1:p.x,y1:p.y,dx:Math.cos(a),dy:Math.sin(a),clock:0,pierce:statistics.lanceTargets(s),count:0,life:4});
    }
    if(id==='mine'){
      q.clock=statistics.mineInterval(s);
      if(sessionState.run.arsenal.fields.filter(f=>f.type==='mine').length>=specRules.mine.cap)return;
      const target=s.placement?nearestEnemyIn(sessionState.run,300):null,d=target?Math.hypot(target.x-p.x,target.y-p.y)||1:1,offset=Math.min(d*.7,50+s.placement*20);
      specField(id,{phase:'arm',x:target?p.x+(target.x-p.x)/d*offset:p.x,y:target?p.y+(target.y-p.y)/d*offset:p.y,clock:specTiming.mineArm,life:specRules.mine.life,occupied:false,loaded:0});
    }
    if(id==='rift'){
      q.clock=statistics.riftInterval(s); const a=Math.atan2(t.y-p.y,t.x-p.x);
      specField(id,{phase:hasBranch(id,'fold',sessionState.run)?'prepare':'record',target:t.id,angle:a,length:statistics.riftLength(s),width:specRiftWidth(s,hasBranch(id,'fold',sessionState.run)),clock:specTiming.riftAim,life:4,points:[],index:0});
    }
  }
  function tickSpecField(f,dt,s){
    f.age+=dt; f.life-=dt; f.clock=(f.clock||0)-dt;
    if(f.type==='nova')tickNovaField(f,dt,s);
    else if(f.type==='chain')tickChainField(f,dt,s);
    else if(f.type==='lance')tickLanceField(f,dt,s);else if(f.type==='mine')tickMineField(f,dt,s);else if(f.type==='rift')tickRiftField(f,dt,s);
  }
  function specializationTick(dt,s){
    if(dt<=0||view.mode!=='playing')return;
    const a=sessionState.run.arsenal;
    for(const b of branches){
      if(!specialized(b.id,sessionState.run))continue;
      const q=a.states[b.id]||(a.states[b.id]={clock:0,phase:'wait'}); q.clock=Math.max(0,q.clock-dt);
      if(b.id==='pulse')specPulse(dt,s,q);
      else if(b.id==='orbit')specOrbit(dt,s,q);else if(b.id==='beacon')specBeacon(dt,s,q);else if(q.clock<=0&&!(b.id==='lance'&&a.fields.some(f=>f.type==='lance')))startSpecWeapon(b.id,s,q);
      if(view.mode!=='playing')return;
    }
    for(const f of [...a.fields]){tickSpecField(f,dt,s);if(f.life<=0)feedback.retireSkillField(f);if(view.mode!=='playing')break;}
    a.fields=a.fields.filter(f=>f.life>0);
    a.tracks=hasBranch('mine','leap',sessionState.run)?sessionState.run.enemies.filter(e=>e.hp>0).slice(0,180).map(e=>({id:e.id,x:e.x,y:e.y})):[];
  }
  return { legacyWeaponStats, specializationTick };
}
