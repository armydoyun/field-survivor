import { W, H, GUARDIAN_REACH, GUARDIAN_STILL } from '../core/config.js';
import { enemyType } from '../data/enemies.js';
import { hazardGeometry } from '../math/geometry.js';
import { clamp } from '../core/utils.js';
import { advanceEnemyBullet } from '../combat/hostile-attacks.js';
import { wardRadius } from '../combat/rules.js';
import { guardianSpread, guardianMood } from '../combat/guardians.js';

export function createEnemyView({ sessionState, platform, primitives, enemyRuntime, cameraView }) {
  const { ctx } = platform;

  function drawDangerGlyph(x,y,color){ctx.save();ctx.setLineDash([]);ctx.globalAlpha=1;ctx.fillStyle='#2c2528';ctx.beginPath();ctx.moveTo(x,y-13);ctx.lineTo(x+13,y+10);ctx.lineTo(x-13,y+10);ctx.closePath();ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.stroke();ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x,y+2);ctx.stroke();ctx.fillStyle=color;ctx.fillRect(x-1,y+5,2,2);ctx.restore();}

  function drawEliteHazard(h){
    const live=sessionState.run.time>=h.fireAt,g=hazardGeometry(h,sessionState.run.time),color=live?'#ff8068':'#f3b46e';ctx.save();ctx.setLineDash([]);ctx.lineCap='butt';ctx.strokeStyle=color;
    if(h.shape==='ring'){const radius=live?g.radius:h.radius,start=h.angle+h.gap/2,end=h.angle+Math.PI*2-h.gap/2;ctx.globalAlpha=live?.24:.1;ctx.lineWidth=h.width;ctx.beginPath();ctx.arc(h.x,h.y,radius,start,end);ctx.stroke();ctx.globalAlpha=live?.95:.75;ctx.lineWidth=live?2.5:1.5;ctx.setLineDash(live?[]:[7,5]);ctx.beginPath();ctx.arc(h.x,h.y,radius-h.width/2,start,end);ctx.moveTo(h.x+Math.cos(start)*(radius+h.width/2),h.y+Math.sin(start)*(radius+h.width/2));ctx.arc(h.x,h.y,radius+h.width/2,start,end);ctx.stroke();ctx.setLineDash([]);if(!live){ctx.globalAlpha=.3;ctx.lineWidth=h.width;ctx.beginPath();ctx.arc(h.x,h.y,26,start,end);ctx.stroke();}ctx.globalAlpha=.6;ctx.lineWidth=1.3;ctx.beginPath();for(const a of [start,end]){ctx.moveTo(h.x+Math.cos(a)*(radius-h.width/2),h.y+Math.sin(a)*(radius-h.width/2));ctx.lineTo(h.x+Math.cos(a)*(radius+h.width/2),h.y+Math.sin(a)*(radius+h.width/2));}ctx.stroke();for(let i=0;i<5;i++){const a=start+(end-start)*(i+.5)/5;primitives.skillArrow(h.x+Math.cos(a)*radius,h.y+Math.sin(a)*radius,a,color,5,live?.7:.4);}}
    else{ctx.lineCap='round';const beam=(a,width,alpha,dashed=false)=>{ctx.lineWidth=width;ctx.globalAlpha=alpha;ctx.setLineDash(dashed?[7,5]:[]);ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(h.x+Math.cos(a)*h.length,h.y+Math.sin(a)*h.length);ctx.stroke();};beam(g.angle,h.width,live?.28:.1);beam(g.angle,live?2.5:1.5,live?.95:.8,!live);if(!live&&h.turn){beam(h.angle+h.turn,1,.35,true);ctx.globalAlpha=.3;ctx.beginPath();ctx.arc(h.x,h.y,h.length,h.angle+Math.min(0,h.turn),h.angle+Math.max(0,h.turn));ctx.stroke();primitives.skillArrow(h.x+Math.cos(h.angle+h.turn*.7)*h.length,h.y+Math.sin(h.angle+h.turn*.7)*h.length,h.angle+h.turn*.7+Math.sign(h.turn)*Math.PI/2,color,7,.7);}const nx=-Math.sin(g.angle)*h.width/2,ny=Math.cos(g.angle)*h.width/2;for(const sign of [-1,1]){ctx.lineWidth=1;ctx.globalAlpha=.6;ctx.setLineDash(live?[]:[5,6]);ctx.beginPath();ctx.moveTo(h.x+nx*sign,h.y+ny*sign);ctx.lineTo(h.x+Math.cos(g.angle)*h.length+nx*sign,h.y+Math.sin(g.angle)*h.length+ny*sign);ctx.stroke();}}
    ctx.setLineDash([]);const angle=h.shape==='ring'?h.angle+Math.PI:g.angle+(live?0:(h.turn||0)/2),distance=h.shape==='ring'?(live?g.radius:h.radius*.6):h.length*.55,x=h.x+Math.cos(angle)*distance,y=h.y+Math.sin(angle)*distance;drawDangerGlyph(x,y,color);if(!live&&Number.isFinite(h.fireAt)){ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillStyle=color;ctx.globalAlpha=.9;ctx.fillText(Math.max(0,h.fireAt-sessionState.run.time).toFixed(1),x,y+25);}ctx.restore();
  }

  function drawEliteTell(e){
    const a=e.eliteAttack;if(!a)return;ctx.save();ctx.strokeStyle='#f5c777';ctx.fillStyle='#f5c777';ctx.lineWidth=2;ctx.setLineDash([5,4]);
    if(a.kind==='leap'){ctx.beginPath();ctx.arc(a.x,a.y,42,0,2*Math.PI);ctx.stroke();ctx.globalAlpha=.45;ctx.beginPath();ctx.moveTo(a.sx,a.sy);ctx.quadraticCurveTo((a.sx+a.x)/2,(a.sy+a.y)/2-50,a.x,a.y);ctx.stroke();ctx.globalAlpha=1;drawDangerGlyph(a.x,a.y,'#f3b46e');primitives.skillCircle(a.x,a.y,48,'#f3b46e',true,1.5,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(a.elapsed/a.warn,0,1));}
    else if(a.kind==='boost'||a.kind==='brood'){ctx.beginPath();ctx.arc(e.x,e.y,e.radius+12,-Math.PI/2,-Math.PI/2+Math.min(1,a.elapsed/a.warn)*Math.PI*2);ctx.stroke();for(let i=0;i<(a.kind==='brood'?2:4);i++){const angle=i*Math.PI/2;primitives.drawShape(e.x+Math.cos(angle)*(e.radius+18),e.y+Math.sin(angle)*(e.radius+18),3,'#f5c777',a.kind==='brood'?5:3);}}
    ctx.restore();
  }

  function drawArcTell(e){const angle=Math.atan2(e.dy,e.dx);ctx.save();ctx.strokeStyle='#e0b9f8';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);for(const side of [-1,1]){const b={x:e.x,y:e.y,vx:Math.cos(angle+side*.75)*200*enemyRuntime.shotScaleFor(e),vy:Math.sin(angle+side*.75)*200*enemyRuntime.shotScaleFor(e),kind:'arc',turn:-side*1.1,age:0};ctx.beginPath();ctx.moveTo(b.x,b.y);for(let i=0;i<20;i++){advanceEnemyBullet(b,.05);ctx.lineTo(b.x,b.y);}ctx.stroke();}ctx.restore();}

  function drawHostileZone(h,arming=false){
    if(h.shape){drawEliteHazard(h);return;}
    const live=!arming&&sessionState.run.time>=h.fireAt,r=h.radius,color=live?'#f16b58':'#f3a65d';
    ctx.save();ctx.globalCompositeOperation='source-over';ctx.lineCap='butt';ctx.lineJoin='round';ctx.setLineDash([]);ctx.fillStyle=live?'#a83d39':'#d6753d';ctx.globalAlpha=live?.2:.09;ctx.beginPath();ctx.arc(h.x,h.y,r,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.clip();ctx.strokeStyle=color;ctx.globalAlpha=live?.38:.22;ctx.lineWidth=1.5;ctx.beginPath();for(let x=-r*2;x<=r*2;x+=14){ctx.moveTo(h.x+x,h.y-r);ctx.lineTo(h.x+x+r*2,h.y+r);}ctx.stroke();ctx.restore();
    ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.lineWidth=live?2.8:1.8;if(!live)ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(h.x,h.y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    drawDangerGlyph(h.x,h.y,color);if(!live&&!arming&&Number.isFinite(h.fireAt)){ctx.globalAlpha=.9;ctx.fillStyle=color;ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(Math.max(0,h.fireAt-sessionState.run.time).toFixed(1),h.x,h.y+25);}ctx.restore();
  }

  function drawHostileMarks(){for(const h of sessionState.run.hazards)drawHostileZone(h);}

  function drawEnemyTelegraphs(){
    ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.lineCap='butt';ctx.lineJoin='round';ctx.setLineDash([]);
    for(const e of sessionState.run.enemies.filter(e=>e.hp>0).sort((a,b)=>a.id-b.id)){
      if(e.kind===3&&!e.final)drawGuardian(e);if(e.elite)drawEliteTell(e);
      if(e.kind===10&&e.phase===1){drawHostileZone({x:e.markX,y:e.markY,radius:e.elite?46:48},true);if(e.elite)drawHostileZone({x:e.markX-e.dx*100,y:e.markY-e.dy*100,radius:46},true);}
      if(e.kind===4&&e.phase===1){ctx.strokeStyle='#d7b599';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+e.dx*(e.elite?174.25*enemyRuntime.shotScaleFor(e):320),e.y+e.dy*(e.elite?174.25*enemyRuntime.shotScaleFor(e):320));ctx.stroke();}
      if(e.kind===5&&e.phase===1){ctx.strokeStyle='#d49a8699';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+e.dx*180,e.y+e.dy*180);ctx.stroke();}
      if(e.kind===7&&e.elite&&e.phase===1)drawArcTell(e);
      if((e.kind===7&&!e.elite||e.kind===9)&&e.phase===1){ctx.strokeStyle=e.kind===7?'#c5b8f3':'#f1c4a5';ctx.lineWidth=2;ctx.beginPath();for(const offset of e.kind===9?[-.2,0,.2]:[0]){const a=Math.atan2(e.dy,e.dx)+offset;ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(a)*(e.kind===7?200:310),e.y+Math.sin(a)*(e.kind===7?200:310));}ctx.stroke();}
      if(e.kind===8&&!e.coreNode){ctx.strokeStyle='#87c6df';ctx.globalAlpha=.4;ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,wardRadius(e),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
    }
    drawCoreTelegraph();ctx.restore();
  }

  function drawCoreTelegraph(){const a=sessionState.run.journey.core?.attack;if(!a)return;if(a.kind==='sweep'){drawEliteHazard({...a,shape:'beam'});return;}const live=sessionState.run.time>=a.fireAt,color=live?'#ff7f69':'#f2b46e';ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle);ctx.strokeStyle=color;ctx.lineCap='butt';ctx.setLineDash([]);ctx.globalAlpha=live?.23:.09;ctx.lineWidth=46;ctx.beginPath();if(a.kind==='ring')ctx.arc(0,0,110,0,Math.PI*2);else{ctx.moveTo(-1800,0);ctx.lineTo(1800,0);ctx.moveTo(0,-1800);ctx.lineTo(0,1800);}ctx.stroke();ctx.globalAlpha=.85;ctx.lineWidth=live?2.5:1.5;ctx.setLineDash(live?[]:[7,6]);ctx.beginPath();if(a.kind==='ring'){ctx.arc(0,0,87,0,Math.PI*2);ctx.moveTo(133,0);ctx.arc(0,0,133,0,Math.PI*2);}else for(const sign of [-1,1]){ctx.moveTo(-1800,sign*23);ctx.lineTo(1800,sign*23);ctx.moveTo(sign*23,-1800);ctx.lineTo(sign*23,1800);}ctx.stroke();ctx.restore();drawDangerGlyph(a.x,a.y,color);if(!live){ctx.save();ctx.fillStyle=color;ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(Math.max(0,a.fireAt-sessionState.run.time).toFixed(1),a.x,a.y+25);ctx.restore();}}

  function drawGuardian(e){
    const a=e.guardianAttack;if(!a||![1,2].includes(e.phase))return;ctx.save();ctx.strokeStyle='#f1baa9';ctx.lineWidth=2;ctx.globalAlpha=.7;
    if(a.kind==='charge'){
      const length=e.phase===1?276:Math.max(0,e.aiTimer)*460,r=e.radius,color=e.phase===1&&e.aiTimer>.4?'#e7aa8a':'#ffd5a8';
      ctx.translate(e.x,e.y);ctx.rotate(a.angle);ctx.setLineDash([]);ctx.lineCap='butt';ctx.lineJoin='round';ctx.globalAlpha=.13;ctx.fillStyle='#d88b78';ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(length,-r);ctx.arc(length,0,r,-Math.PI/2,Math.PI/2);ctx.lineTo(0,r);ctx.closePath();ctx.fill();
      ctx.globalAlpha=.85;ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(length,-r);ctx.arc(length,0,r,-Math.PI/2,Math.PI/2);ctx.lineTo(0,r);ctx.stroke();
      ctx.lineWidth=1.3;ctx.beginPath();for(let x=45;x<length-12;x+=48){ctx.moveTo(x-6,-6);ctx.lineTo(x,0);ctx.lineTo(x-6,6);}ctx.stroke();
    }
    else if(a.kind==='fan'||a.kind==='sweep'){ctx.beginPath();for(const offset of a.kind==='fan'?guardianSpread(sessionState.profile,sessionState.run):[-.65,0,.65]){const angle=a.angle+offset;ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(angle)*360,e.y+Math.sin(angle)*360);}ctx.stroke();}
    else if(a.kind==='bombard'){for(let i=0;i<3;i++){const angle=i*Math.PI*2/3;ctx.beginPath();ctx.arc(e.x+Math.cos(angle)*55,e.y+Math.sin(angle)*55,7,0,Math.PI*2);ctx.stroke();}}
    else{ctx.beginPath();ctx.arc(e.x,e.y,e.radius+17,0,Math.PI*2);ctx.stroke();const count=guardianMood(sessionState.profile,sessionState.run)==='spare'?6:guardianMood(sessionState.profile,sessionState.run)==='end'?10:8;for(let i=0;i<count;i++){const angle=a.angle+i*Math.PI*2/count;primitives.drawShape(e.x+Math.cos(angle)*(e.radius+20),e.y+Math.sin(angle)*(e.radius+20),3,'#f4cab6');}}
    ctx.restore();
  }

  function drawEnemies(detail,cx,cy){
    for (const e of sessionState.run.enemies) {
      if (Math.abs(e.x-cx)>W/2+155 || Math.abs(e.y-cy)>H/2+155) continue;
      ctx.save();if(e.eliteAttack?.kind==='leap'){const a=e.eliteAttack,t=Math.max(0,Math.min(1,(a.elapsed-a.warn)/a.duration));ctx.globalAlpha=.25;primitives.drawShape(e.x,e.y,e.radius+4,'#101b24');ctx.globalAlpha=1;ctx.translate(0,cameraView.reducedMotion()?0:-Math.sin(t*Math.PI)*32);}
      const type = enemyType[e.kind], pushed = Math.hypot(e.pushX||0,e.pushY||0);
      if(detail && pushed>2){const length=Math.min(22,pushed*.4),nx=e.pushX/pushed,ny=e.pushY/pushed;ctx.globalAlpha=.18;primitives.drawShape(e.x-nx*length,e.y-ny*length,e.radius,type.color,type.sides);ctx.globalAlpha=.55;ctx.strokeStyle='#d3edeb';ctx.lineWidth=1.5;ctx.beginPath();for(const side of [-1,1]){const x=e.x-ny*side*e.radius*.6,y=e.y+nx*side*e.radius*.6;ctx.moveTo(x,y);ctx.lineTo(x-nx*length,y-ny*length);}ctx.stroke();ctx.globalAlpha=1;}
      if(e.kind===10)primitives.drawShape(e.x,e.y,e.radius+4,'#75804a',4);
      if(e.kind===3&&e.phase===4){ctx.strokeStyle='#a3e6d0';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,e.radius+17,0,2*Math.PI);ctx.stroke();ctx.fillStyle='#b4efdb';ctx.textAlign='center';ctx.font='bold 12px system-ui';ctx.fillText(e.final?'고리 개방':'외피 이완',e.x,e.y-e.radius-29);}
      if (e.kind === 3 && e.phase === 3) { ctx.strokeStyle = '#d8e3df'; ctx.lineWidth = 2; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 12, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        // 무기를 내린 감시자: 돌려보내는 반경, 멈춤 진행도, 남은 시간, 조작 안내
        if (e.named && !e.final) { const run = sessionState.run, p = run.player, near = Math.hypot(p.x - e.x, p.y - e.y) <= GUARDIAN_REACH, left = Math.max(0, (e.yieldUntil || run.time) - run.time);
          ctx.strokeStyle = near ? 'rgba(168,203,189,.55)' : 'rgba(216,227,223,.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, GUARDIAN_REACH, 0, Math.PI * 2); ctx.stroke();
          if (e.yieldStill > 0) { ctx.strokeStyle = '#a8cbbd'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, e.yieldStill / GUARDIAN_STILL)); ctx.stroke(); }
          ctx.textAlign = 'center'; ctx.font = 'bold 12px system-ui'; ctx.fillStyle = '#e6f1ec'; ctx.fillText(near ? '가만히 서 있기 · 돌려보냄   E · 분해' : '가까이 다가가기', e.x, e.y - e.radius - 30); ctx.font = '11px system-ui'; ctx.fillStyle = '#b9c9c3'; ctx.fillText(`${Math.ceil(left)}초 후 물러남`, e.x, e.y - e.radius - 15); } }
      if (e.elite) { ctx.strokeStyle = '#e5c77b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 6, 0, 2 * Math.PI); ctx.stroke();for(let i=0;i<4;i++){const a=i*Math.PI/2;primitives.drawShape(e.x+Math.cos(a)*(e.radius+9),e.y+Math.sin(a)*(e.radius+9),2.5,'#f6d88d',4);} }
      primitives.drawShape(e.x, e.y, e.radius, e.flash > 0 ? '#fff4d2' : e.final ? '#e4c5a1' : type.color, e.final ? 8 : type.sides);
      if (e.final) { ctx.strokeStyle = '#f2d7a9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 8 + Math.sin(sessionState.run.time * 4) * 3, 0, Math.PI * 2); ctx.stroke(); primitives.drawShape(e.x, e.y, 12, '#394250', 4); }
      if (e.kind === 4) primitives.drawShape(e.x, e.y, 4, '#254f53');
      if (e.kind === 7) { primitives.drawShape(e.x, e.y, 4, '#383557', 3); }
      if (e.kind === 8) { primitives.drawShape(e.x, e.y, 8, '#254e65', 6); primitives.drawShape(e.x, e.y, 3, '#bfe9f4', 4); }
      if (e.kind === 9) { primitives.drawShape(e.x, e.y, 5, '#63483f', 3); }
      if (e.kind === 5 && e.phase === 1) { ctx.strokeStyle = '#f3d7b7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2); ctx.stroke(); }
      if (sessionState.run.time < (e.slowUntil || 0)) {
        ctx.strokeStyle = '#a5d7f4'; ctx.globalAlpha = .5; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 3, -.75 * Math.PI, .25 * Math.PI); ctx.stroke(); ctx.globalAlpha = 1;
      }
      if (e.kind > 1 || e.elite) { ctx.fillStyle = '#2d3b46'; ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, e.radius * 2, 3); ctx.fillStyle = '#cc7975'; ctx.fillRect(e.x - e.radius, e.y - e.radius - 10, e.radius * 2 * Math.max(0, e.hp / e.maxHp), 3); }
      ctx.restore();
    }
  }

  return { drawEnemies, drawHostileMarks, drawEnemyTelegraphs };
}
