import { createSkillDesign } from './skill-style.js';
import { beaconRange, specTiming, novaEdgeWidth, specRiftWidth, specBeaconRadius } from '../combat/weapon-parameters.js';
import { W, H } from '../core/config.js';
import { easeSkill } from '../math/geometry.js';
import { clamp } from '../core/utils.js';
import { nearestEnemyIn } from '../combat/targeting.js';
import { skillColors } from '../data/visuals.js';
import { hasBranch } from '../growth/build.js';
import { hasRelic, clockFrozen, anomalyActive } from '../world/effects.js';

import { targetable } from '../combat/rules.js';

export function createWeaponView({ sessionState, renderState, platform, primitives, statistics, cameraView, feedback }) {
  const { ctx } = platform,design=createSkillDesign(ctx);
  function strikeState(source){const hit=feedback?.skillAttackVisual?.(source),age=hit?sessionState.run.time-hit.at:Infinity;return {hit,live:age===0,fade:clamp(1-age/.12,0,1)};}
  function drawStrike(source,color){
    const {hit,live,fade}=strikeState(source);if(!hit||!fade||!['line','target'].includes(hit.kind))return;
    primitives.skillLine(hit.x1,hit.y1,hit.x2,hit.y2,color,live?2.2:1,live,live?(hit.width||0):0,live?1:fade*1.15);
    if(source.type==='chain')design.lightning(hit.x1,hit.y1,hit.x2,hit.y2,color,{detail:primitives.visualDetail(),fade:fade*.8,seed:source.index||0});
    if(live)primitives.skillArrow(hit.x2,hit.y2,Math.atan2(hit.y2-hit.y1,hit.x2-hit.x1),color,5,.85);
  }
  function drawBaseDevices(s,cx,cy){
    ctx.save();
    for(const b of sessionState.run.beacons){
      if(Math.abs(b.x-cx)>W/2+40||Math.abs(b.y-cy)>H/2+40)continue;
      renderState.opacity=Math.max(.35,easeSkill((11-b.life)/.15))*Math.max(.3,clamp(b.life/.15,0,1));
      const target=nearestEnemyIn(sessionState.run,beaconRange(s),b.x,b.y),color=skillColors.beacon[0];
      primitives.skillEmitter(b.x,b.y,target?Math.atan2(target.y-b.y,target.x-b.x):0,color,true); primitives.skillCircle(b.x,b.y,16,color,false);
      primitives.skillCircle(b.x,b.y,19,color,true,1,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(b.life/11,0,1));
    }
    for(const m of sessionState.run.mines){
      if(Math.abs(m.x-cx)>W/2+160||Math.abs(m.y-cy)>H/2+160)continue;
      renderState.opacity=Math.max(.35,easeSkill((12-m.life)/.12))*Math.max(.3,clamp(m.life/.15,0,1)); const color=skillColors.mine[0],sense=14+s.placement*4; design.mine(m.x,m.y,color,{detail:primitives.visualDetail(),fade:renderState.opacity,progress:m.life/12}); primitives.skillCircle(m.x,m.y,sense,color,false,1);
      for(let i=0;i<4;i++){const a=i*Math.PI/2;primitives.skillArrow(m.x+Math.cos(a)*sense,m.y+Math.sin(a)*sense,a+Math.PI,color,3,.4);}
    }
    renderState.opacity=1; ctx.restore();
  }
  function drawPlayerShots(detail,cx,cy){
    ctx.save();
    for(const shot of sessionState.run.shots){
      if(Math.abs(shot.x-cx)>W/2+65||Math.abs(shot.y-cy)>H/2+65)continue;
      const fade=Math.max(.3,clamp(shot.life/.08,0,1)),angle=Math.atan2(shot.vy,shot.vx),color=shot.kind==='beacon'?skillColors.beacon[0]:shot.kind==='lance'?skillColors.lance[0]:shot.kind==='burst'?skillColors.mine[0]:shot.kind==='mirror'?skillColors.rift[0]:skillColors.pulse[0];
      design.bolt(shot.x,shot.y,angle,shot.radius,color,{fade,detail,aux:shot.aux,lance:shot.kind==='lance',crit:shot.crit,cold:shot.cold});
      if(shot.kind==='mirror'){ctx.save();ctx.translate(shot.x,shot.y);ctx.rotate(angle+Math.PI/4);ctx.globalAlpha=fade*.7;ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(-shot.radius,-shot.radius,shot.radius*2,shot.radius*2);ctx.restore();}
    }
    renderState.opacity=1;ctx.restore();
  }
  function drawCombatWaves(detail,cx,cy){
    ctx.save();
    for(const wave of sessionState.run.waves){
      if(Math.abs(wave.x-cx)>W/2+wave.radius||Math.abs(wave.y-cy)>H/2+wave.radius)continue;
      const t=clamp(wave.life/(wave.max||.3),0,1),color=wave.color||'#9de8d2',area=['nova','mine','ember','artillery'].includes(wave.kind);
      if(area){
        primitives.skillDisk(wave.x,wave.y,wave.radius,color,t);
        if(detail){
          const count=wave.kind==='mine'?6:4,r=wave.radius*(1-.12*t);
          for(let i=0;i<count;i++){const a=i*Math.PI*2/count;primitives.skillArrow(wave.x+Math.cos(a)*r,wave.y+Math.sin(a)*r,a,color,wave.kind==='mine'?7:4,t*.6);}
        }
      }
      else if(wave.kind==='block'){
        ctx.save(); ctx.translate(wave.x,wave.y); ctx.strokeStyle=color; ctx.lineWidth=2; ctx.globalAlpha=(t)*renderState.opacity; ctx.beginPath();
        for(let i=0;i<7;i++){const a=i*Math.PI/3,x=Math.cos(a)*wave.radius*(1-t*.3),y=Math.sin(a)*wave.radius*(1-t*.3);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
        ctx.stroke(); ctx.restore();
      }
      else if(wave.kind==='upgrade'||wave.kind==='relic'){
        const r=wave.radius*(1-t*.35);
        for(let i=0;i<4;i++)primitives.skillCircle(wave.x,wave.y,r,color,true,1.5,i*Math.PI/2+.12,i*Math.PI/2+1.1);
        ctx.globalAlpha=(t)*renderState.opacity; primitives.drawShape(wave.x,wave.y,4+t*3,color,4);
      }
      else if(wave.kind==='muzzle'){ctx.globalAlpha=(t*.5)*renderState.opacity;primitives.drawShape(wave.x,wave.y,4+6*t,color,4);}
      else{
        ctx.globalAlpha=(t*.7)*renderState.opacity; ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.beginPath();
        ctx.arc(wave.x,wave.y,Math.max(1,wave.radius*(1-t*.65)),0,Math.PI*2); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawRiftScar(x1,y1,x2,y2,width,fade=1,color='#ceb5ff',detail=primitives.visualDetail(),active=true){
    const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);
    if(length<1||fade<=0)return;
    const w=Math.min(width,length*.3); ctx.save(); ctx.translate(x1,y1); ctx.rotate(Math.atan2(dy,dx)); ctx.setLineDash(active?[]:[4,6]); ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(length*.14,-w*.65); ctx.lineTo(length*.84,-w*.28); ctx.lineTo(length,0); ctx.lineTo(length*.84,w*.28);
    ctx.lineTo(length*.14,w*.65); ctx.closePath(); ctx.globalAlpha=.7*fade*renderState.opacity; ctx.fillStyle='#141726'; if(active)ctx.fill();
    ctx.globalAlpha=(active?.75:.3)*fade*renderState.opacity; ctx.strokeStyle=color; ctx.lineWidth=1.2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(length,0);
    ctx.strokeStyle=active?'#edf5ff':color; ctx.globalAlpha=(active?1:.25)*fade*renderState.opacity; ctx.lineWidth=active?(detail?2:1.5):1; ctx.stroke(); ctx.restore();
  }
  function drawRiftField(f,s,detail){
    const color=primitives.skillColor('rift'),ux=Math.cos(f.angle),uy=Math.sin(f.angle),stamp=strikeState(f);
    if(hasBranch('rift','fold',sessionState.run)){
      const preparing=f.phase==='prepare',w=f.width*(1-clamp((f.loaded||0)/specTiming.riftFold,0,1));
      if(f.phase==='open'){
        if(stamp.live)drawStrike(f,color);
        drawRiftScar(f.x,f.y,f.x+ux*f.length,f.y+uy*f.length,specRiftWidth(s),clamp(f.clock/specTiming.riftOpen,0,1),color,detail,stamp.live);return;
      }
      if(stamp.live&&stamp.hit.kind==='fold'){
        const {inner,outer}=stamp.hit;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(f.angle);ctx.fillStyle=color;ctx.globalAlpha=.12*renderState.opacity;
        ctx.fillRect(0,inner-5,f.length,outer-inner+10);ctx.fillRect(0,-outer-5,f.length,outer-inner+10);ctx.restore();
      }
      for(const sign of [-1,1]){const x=f.x-uy*w*sign,y=f.y+ux*w*sign;primitives.skillLine(x,y,x+ux*f.length,y+uy*f.length,color,preparing?1:2.2,!preparing&&stamp.live,0,preparing?.65:1);}
      primitives.skillLine(f.x,f.y,f.x+ux*f.length,f.y+uy*f.length,color,.8,false,0,.3);
    }else if(f.phase==='record'){
      const progress=clamp(1-f.clock/specTiming.riftAim,0,1);primitives.skillLine(f.x,f.y,f.x+ux*f.length,f.y+uy*f.length,color,1,false,0,.5+progress*.3);
      primitives.skillBrackets(f.x+ux*f.length,f.y+uy*f.length,6,color,progress);
    }else if(f.points.length>=2){
      const a=f.points[0],b=f.points[1];if(stamp.live)drawStrike(f,color);
      drawRiftScar(a.x,a.y,b.x,b.y,f.width,clamp(f.clock/specTiming.riftGlow,0,1),color,detail,stamp.live);
    }
  }
  function drawCombatArcs(detail,cx,cy){
    ctx.save();
    for(const arc of sessionState.run.arcs){
      if(Math.max(arc.x1,arc.x2)<cx-W/2-12||Math.min(arc.x1,arc.x2)>cx+W/2+12||Math.max(arc.y1,arc.y2)<cy-H/2-12||Math.min(arc.y1,arc.y2)>cy+H/2+12)continue;
      const dx=arc.x2-arc.x1,dy=arc.y2-arc.y1,fade=clamp(arc.life/(arc.max||.18),0,1),color=arc.kind==='rift'?'#d4b9ff':arc.kind==='reflect'?skillColors.rift[0]:skillColors.chain[0];
      if(arc.kind==='chain')design.lightning(arc.x1,arc.y1,arc.x2,arc.y2,skillColors.chain[0],{fade,detail,seed:arc.seed||2});
      else if(arc.kind==='rift')drawRiftScar(arc.x1,arc.y1,arc.x2,arc.y2,10,fade,'#ceb5ff',detail);
      else{
        primitives.skillLine(arc.x1,arc.y1,arc.x2,arc.y2,color,1.5,true,0,fade); primitives.skillArrow(arc.x1+dx*.7,arc.y1+dy*.7,Math.atan2(dy,dx),color,5,fade);
        if(arc.kind==='reflect')primitives.skillCircle(arc.x1,arc.y1,9,color,true,1);
      }
    }
    ctx.restore();
  }
  function drawEnemyBullets(cx,cy){
    ctx.save();
    for(const b of sessionState.run.bullets){
      if(Math.abs(b.x-cx)>W/2+25||Math.abs(b.y-cy)>H/2+25)continue;
      ctx.globalAlpha=(1)*renderState.opacity; const color=b.kind==='return'?'#ffc079':b.kind==='arc'?'#e2a5dc':b.boss?'#ffae9b':'#ff9380',a=Math.atan2(b.vy,b.vx);
      primitives.drawShape(b.x,b.y,b.radius+2,'#44282e'); primitives.drawShape(b.x,b.y,b.radius,color,b.kind==='arc'?3:b.boss?4:0);
      primitives.skillArrow(b.x+Math.cos(a)*(b.radius+3),b.y+Math.sin(a)*(b.radius+3),a,color,4,.9);
      if(b.kind==='return'){primitives.skillCircle(b.x,b.y,b.radius+5,color,true,1,a+.3,a+Math.PI*1.6);primitives.drawShape(b.x,b.y,2,'#5c3b32',4);}
      else if(b.kind==='arc'){ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=(.5)*renderState.opacity;ctx.beginPath();ctx.arc(b.x,b.y,b.radius+5,a-Math.PI*.8,a);ctx.stroke();}
    }
    ctx.restore();
  }
  function drawAuxiliaryFields(){
    const p=sessionState.run.player,local=hasRelic('clockwork',sessionState.run)&&sessionState.run.time<sessionState.run.relicFreezeUntil,global=clockFrozen(sessionState.run),color='#b4d4e8';
    ctx.save();
    if(local||global){
      if(local&&!global)primitives.skillCircle(p.x,p.y,225,color,false,1);
      const x=p.x-34,y=p.y-15; primitives.skillCircle(x,y,7,color,true,1.3); primitives.skillLine(x,y,x,y-4,color,1.3,true); primitives.skillLine(x,y,x+3,y,color,1.3,true);
      if(primitives.visualDetail())for(const e of sessionState.run.enemies)if(e.hp>0&&e.kind!==3&&!e.coreNode&&(global||Math.hypot(e.x-p.x,e.y-p.y)<=225)){ctx.globalAlpha=(.7)*renderState.opacity;ctx.fillStyle=color;ctx.fillRect(e.x-4,e.y-4,2,8);ctx.fillRect(e.x+2,e.y-4,2,8);}
    }
    if(anomalyActive('border','ward',sessionState.run)){
      const ready=sessionState.run.time>=sessionState.run.anomalyWardAt,color=ready?'#a7e4da':'#6d929f',x=p.x+34,y=p.y-15;
      if(ready)for(let i=0;i<4;i++)primitives.skillCircle(p.x,p.y,125,color,false,1.3,i*Math.PI/2+.2,i*Math.PI/2+1.05);
      ctx.strokeStyle=color; ctx.globalAlpha=(.7)*renderState.opacity; ctx.lineWidth=1.3; ctx.beginPath(); ctx.moveTo(x-5,y-5); ctx.lineTo(x+5,y-5); ctx.lineTo(x+4,y+2);
      ctx.lineTo(x,y+6); ctx.lineTo(x-4,y+2); ctx.closePath(); ctx.stroke();
      if(!ready)primitives.skillCircle(x,y,9,color,true,1,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-clamp((sessionState.run.anomalyWardAt-sessionState.run.time)/16,0,1)));
    }
    ctx.restore();
  }
  function drawSpecializations(){
    const a=sessionState.run.arsenal;if(!a)return;
    const s=statistics.stats(),p=sessionState.run.player,detail=primitives.visualDetail();ctx.save();
    for(const f of a.fields){
      renderState.opacity=Math.max(.65,easeSkill(f.age/.1))*Math.max(.55,clamp(f.life/.14,0,1));const color=primitives.skillColor(f.type);
      if(f.type==='nova'){
        const r=f.length||0,back=f.phase==='return';
        // A thin moving annulus, never a filled disk: the interior does not deal damage.
        ctx.save();ctx.fillStyle=color;ctx.globalAlpha=.065*renderState.opacity;ctx.beginPath();ctx.arc(f.x,f.y,r+novaEdgeWidth,0,Math.PI*2);ctx.arc(f.x,f.y,Math.max(0,r-novaEdgeWidth),0,Math.PI*2,true);ctx.fill();ctx.restore();
        primitives.skillCircle(f.x,f.y,r,color,true,f.phase==='hold'?3:2.5);
        if(detail){primitives.skillCircle(f.x,f.y,Math.max(0,r-novaEdgeWidth),color,false);primitives.skillCircle(f.x,f.y,r+novaEdgeWidth,color,false);}
        for(let i=0;i<(detail?8:4);i++){const angle=i*Math.PI*2/(detail?8:4);primitives.skillArrow(f.x+Math.cos(angle)*r,f.y+Math.sin(angle)*r,angle+(back?Math.PI:0),color,back?6:4,.65);}
        if(back&&detail)for(const id of f.marks.slice(0,12)){const e=sessionState.run.enemies.find(e=>e.id===id&&targetable(e,sessionState.run));if(e)primitives.skillBrackets(e.x,e.y,e.radius+4,color);}
        if(f.phase==='hold')primitives.skillCircle(f.x,f.y,r+novaEdgeWidth+4,color,true,1,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp((specTiming.novaExpand+specTiming.novaHold-f.age)/specTiming.novaHold,0,1));
      }else if(f.type==='chain'){
        const n=f.points.length,loop=f.phase==='loop',stamp=strikeState(f),live=loop&&stamp.live&&stamp.hit.kind==='line';
        for(let i=1;i<n;i++){
          const v=f.points[i-1],w=f.points[i];primitives.skillLine(v.x,v.y,w.x,w.y,color,live?2:1,live,live?5:0,live?1:.55);
          if(live)primitives.skillFlow(v,w,color);
        }
        if(loop&&n>2){const v=f.points[n-1],w=f.points[0];primitives.skillLine(v.x,v.y,w.x,w.y,color,live?2:1,live,live?5:0);if(live)primitives.skillFlow(v,w,color);}
        if(!live)drawStrike(f,color);
        for(let i=0;i<n;i++){const v=f.points[i];primitives.skillCircle(v.x,v.y,loop?5:3,color,live,1.2);}
      }else if(f.type==='lance'){
        const back=f.phase==='back',stamp=strikeState(f),angle=back?Math.atan2(p.y-f.y,p.x-f.x):Math.atan2(f.dy,f.dx);
        if(f.phase==='stay'){
          // Retained path is a guide; only the real periodic strike opens a bright band.
          primitives.skillLine(f.x1,f.y1,f.x,f.y,color,1,false,0,.65);drawStrike(f,color);
          primitives.skillCircle(f.x,f.y,12,color,false,1,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(f.clock/specTiming.lanceStay,0,1));
        }else{
          drawStrike(f,color);
          if(back){primitives.skillLine(f.x,f.y,p.x,p.y,color,1,false,0,.45);primitives.skillArrow(f.x,f.y,angle,color,7,.85);}
        }
        primitives.skillCraft(f.x,f.y,9,angle,color,f.phase!=='stay'&&stamp.live);
      }else if(f.type==='mine'){
        const pressure=hasBranch('mine','pressure',sessionState.run),jump=f.phase==='jump',t=clamp((f.loaded||0)/specTiming.mineJump,0,1),lift=jump&&!cameraView.reducedMotion()?Math.sin(t*Math.PI)*28:0,sense=14+s.placement*4;
        if(!jump)primitives.skillCircle(f.x,f.y,sense,color,false,1);
        if(f.phase==='arm')primitives.skillCircle(f.x,f.y,20,color,true,1.5,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(1-f.clock/specTiming.mineArm,0,1));
        if(f.phase==='pressed'){
          primitives.skillCircle(f.x,f.y,statistics.mineRadius(s),color,false,1);
          primitives.skillCircle(f.x,f.y,22,color,true,2,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(f.loaded/specTiming.minePressure,0,1));
          for(let i=0;i<4;i++)primitives.skillArrow(f.x+Math.cos(i*Math.PI/2)*sense,f.y+Math.sin(i*Math.PI/2)*sense,i*Math.PI/2+Math.PI,color,4,.5);
        }
        if(jump){
          primitives.skillCircle(f.tx,f.ty,statistics.mineRadius(s),color,false,1);primitives.skillBrackets(f.tx,f.ty,12,color,t);
          ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=.22*renderState.opacity;ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(f.sx,f.sy);ctx.lineTo(f.tx,f.ty);ctx.stroke();ctx.restore();
          primitives.skillCircle(f.x,f.y,5,color,false);primitives.skillLine(f.x,f.y,f.x,f.y-lift,color,1,false,0,.4);
        }
        design.mine(f.x,f.y-lift,color,{detail,fade:renderState.opacity,armed:f.phase!=='arm',progress:f.phase==='arm'?1-f.clock/specTiming.mineArm:1,chain:pressure});
      }else if(f.type==='rift')drawRiftField(f,s,detail);
    }
    renderState.opacity=1;const orbit=a.states.orbit;
    for(const [i,u]of(orbit?.units||[]).entries()){
      renderState.opacity=u.born==null?1:Math.max(.65,easeSkill((sessionState.run.time-u.born)/.15));
      const color=primitives.skillColor('orbit'),escort=hasBranch('orbit','escort',sessionState.run),stamp=strikeState(u),guard=u.guard&&sessionState.run.time>=(sessionState.run.orbitGuards[i]||0);
      if(u.phase==='back'&&escort){
        const phase=u.orbitPhase??sessionState.run.time*3+i*Math.PI*2/s.orbit,home={x:p.x+Math.cos(phase)*s.orbitRadius,y:p.y+Math.sin(phase)*s.orbitRadius};
        primitives.skillLine(u.x,u.y,home.x,home.y,color,1,false,0,.5);primitives.skillArrow(u.x,u.y,Math.atan2(home.y-u.y,home.x-u.x),color,4,.35);
      }
      drawStrike(u,color);primitives.skillCraft(u.x,u.y,8,u.heading??Math.atan2(u.y-p.y,u.x-p.x)+Math.PI/2,color,stamp.live);
      if(u.guard)primitives.skillCircle(u.x,u.y,12,color,guard,guard?2:1,-Math.PI*.7,Math.PI*.7);
      else if(!escort)primitives.skillArrow(u.x,u.y,Math.atan2(u.y-p.y,u.x-p.x)+Math.PI/2,color,5,.65);
    }
    renderState.opacity=1;const beacon=a.states.beacon;
    for(let i=0;i<(beacon?.units||[]).length;i++){
      const u=beacon.units[i];renderState.opacity=u.born==null?1:Math.max(.65,easeSkill((sessionState.run.time-u.born)/.15));
      const color=primitives.skillColor('beacon'),moving=['move','pack','deploy'].includes(u.phase),relay=hasBranch('beacon','relay',sessionState.run),active=i===(beacon.index||0);
      const target=relay?sessionState.run.enemies.find(e=>e.id===beacon.target&&targetable(e,sessionState.run)):nearestEnemyIn(sessionState.run,beaconRange(s),u.x,u.y),aimTarget=relay&&beacon.phase==='flight'?{x:beacon.tx,y:beacon.ty}:target,angle=aimTarget?Math.atan2(aimTarget.y-u.y,aimTarget.x-u.x):i*Math.PI;
      primitives.skillEmitter(u.x,u.y,angle,color,!moving&&(!relay||active),relay);
      if(moving&&u.phase==='move'){primitives.skillLine(u.x,u.y,u.tx,u.ty,color,1,false);primitives.skillBrackets(u.tx,u.ty,9,color);}
      if(u.phase==='deploy')primitives.skillCircle(u.x,u.y,15,color,false,1,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(1-u.clock/specTiming.beaconDeploy,0,1));
      if(relay){
        primitives.skillCircle(u.x,u.y,15,color,false,1);
        if(active&&['prepare','flight'].includes(beacon.phase)){
          const preparing=beacon.phase==='prepare',aim=preparing&&target?target:{x:beacon.tx,y:beacon.ty},radius=specBeaconRadius(s);
          primitives.skillLine(u.x,u.y,aim.x,aim.y,color,1,false);primitives.skillCircle(aim.x,aim.y,radius,color,false,1.5);
          primitives.skillBrackets(aim.x,aim.y,10,color,preparing?1-clamp(beacon.clock/specTiming.beaconAim,0,1):0);
          if(!preparing){const t=1-clamp(beacon.clock/specTiming.beaconFlight,0,1),x=u.x+(aim.x-u.x)*t,y=u.y+(aim.y-u.y)*t-(cameraView.reducedMotion()?0:Math.sin(t*Math.PI)*35);primitives.drawShape(x,y,3.5,color,4);}
        }
      }else{
        for(let n=0;n<4;n++){ctx.globalAlpha=(n<(u.left||0)?.75:.18)*renderState.opacity;primitives.drawShape(u.x-7+n*4.5,u.y+16,1.4,color,4);}
        const stamp=strikeState(u);if(stamp.fade&&stamp.hit.kind==='muzzle')primitives.skillArrow(u.x+Math.cos(stamp.hit.angle)*17,u.y+Math.sin(stamp.hit.angle)*17,stamp.hit.angle,color,5,stamp.fade*.8);
      }
    }
    renderState.opacity=1;const pulse=a.states.pulse;
    if(pulse){
      const color=primitives.skillColor('pulse'),stamp=strikeState(pulse);
      if(hasBranch('pulse','reservoir',sessionState.run)){
        const charge=pulse.phase==='release'?pulse.left||0:pulse.charge||0;primitives.skillCircle(p.x,p.y,29,color,false,1,-Math.PI*.84,-Math.PI*.16);
        for(let i=0;i<3;i++){
          const angle=-Math.PI/2+(i-1)*.42,x=p.x+Math.cos(angle)*29,y=p.y+Math.sin(angle)*29;primitives.skillCircle(x,y,4,color,i<Math.floor(charge),1.5);
          if(i<charge&&i>=Math.floor(charge))primitives.skillCircle(x,y,5.5,color,true,1,-Math.PI/2,-Math.PI/2+Math.PI*2*(charge-i));
          if(pulse.phase==='release'&&i<charge)primitives.drawShape(x,y,2.5,color,4);
        }
      }else{
        for(let i=0;i<3;i++){ctx.globalAlpha=(i<(pulse.left||0)&&pulse.phase==='burst'?.95:.2)*renderState.opacity;ctx.fillStyle=color;ctx.fillRect(p.x-10+i*8,p.y-28,5,3);}
        const target=sessionState.run.enemies.find(e=>e.id===pulse.target&&targetable(e,sessionState.run));
        if(target&&['aim','burst'].includes(pulse.phase))primitives.skillBrackets(target.x,target.y,target.radius+6,color,pulse.phase==='aim'?1-clamp(pulse.clock/specTiming.pulseAim,0,1):0);
      }
      if(stamp.fade&&stamp.hit.kind==='muzzle')primitives.skillArrow(stamp.hit.x+Math.cos(stamp.hit.angle)*18,stamp.hit.y+Math.sin(stamp.hit.angle)*18,stamp.hit.angle,color,7,stamp.fade);
    }
    renderState.opacity=1;ctx.restore();
  }
  return { drawBaseDevices, drawPlayerShots, drawCombatWaves, drawRiftScar, drawCombatArcs, drawEnemyBullets, drawAuxiliaryFields, drawSpecializations };
}
