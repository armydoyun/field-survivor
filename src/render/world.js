import { episodeTitle } from '../world/effects.js';
import { W, H } from '../core/config.js';
import { clamp } from '../core/utils.js';

export function createWorldView({ sessionState, platform, cameraView, primitives }) {
  const { ctx } = platform;

  function drawJourney(){
    const j=sessionState.run.journey,a=j.active;ctx.save();
    if(a){ctx.strokeStyle='#94decb';ctx.lineWidth=2;ctx.beginPath();ctx.arc(a.x,a.y,a.kind==='relay'?88:a.kind==='gates'?54:35,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d0f4e9';ctx.font='bold 12px system-ui';ctx.textAlign='center';
      const goal=a.kind==='hunt'?'지정 표적 처치':a.kind==='gates'?`좌표 ${a.gate+1}/3 · ${a.charge.toFixed(1)}/3초`:`원 안에서 ${a.charge.toFixed(1)}/14초`;
      const text=`${episodeTitle(a.kind)} · ${Math.ceil(a.until-sessionState.run.time)}초 · ${goal} · +${120+a.slot*80}G / 기본 EXP ${180+a.slot*100}`;
      // Objective remains readable even when its world marker is off-screen.
      ctx.fillText(text,cameraView.camera.x,cameraView.camera.y-H/2+25);
    }
    if(a&&a.kind!=='hunt'){const r=a.kind==='relay'?88:54,goal=a.kind==='relay'?14:3;primitives.skillCircle(a.x,a.y,r+5,'#a2e8d1',true,2,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(a.charge/goal,0,1));primitives.skillBrackets(a.x,a.y,15,'#a2e8d1');}
    const c=j.core;
    if(c?.phase===0){const core=sessionState.run.enemies.find(e=>e.final);if(core){ctx.strokeStyle='#a5c3c6';ctx.lineWidth=1;for(const n of sessionState.run.enemies.filter(e=>e.coreNode&&e.hp>0)){ctx.beginPath();ctx.moveTo(core.x,core.y);ctx.lineTo(n.x,n.y);ctx.stroke();}}}
    if(sessionState.run.finalStep===2){ctx.fillStyle='#eed9ad';ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.fillText(c?.phase===0?`중심핵 · 연결점 ${sessionState.run.enemies.filter(e=>e.coreNode&&e.hp>0).length}`:'중심핵 · 열린 고리',cameraView.camera.x,cameraView.camera.y-H/2+25);}
    ctx.restore();
  }

  function drawGem(gem){
    const amount=gem.xp*gem.count,tier=amount>=100?4:amount>=40?3:amount>=16?2:amount>=8?1:0;
    const color=['#6cc8b0','#85daba','#a5e8c4','#c2f1d1','#e1fbdc'][tier],r=[2.7,3.1,3.65,4.25,5][tier],x=gem.x,y=gem.y;
    ctx.fillStyle='#19352f';ctx.beginPath();ctx.moveTo(x,y-r-1.3);ctx.lineTo(x+r*.87+1.2,y);ctx.lineTo(x,y+r+1.3);ctx.lineTo(x-r*.87-1.2,y);ctx.closePath();ctx.fill();
    ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.87,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.87,y);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f0fff4';ctx.fillRect(x-.7,y-r*.43,1.4,Math.max(1.4,r*.55));
    if(tier>=3){ctx.strokeStyle='#dcfff0';ctx.lineWidth=.9;ctx.strokeRect(x-r*.55,y-r*.55,r*1.1,r*1.1);}
  }

  function drawMarkers(){
    const p=sessionState.run.player;
    const npc = sessionState.run.npc;
    if (npc.spawned && npc.state !== 'taken') {
      const near = Math.hypot(sessionState.run.player.x - npc.x, sessionState.run.player.y - npc.y) < 75;
      ctx.strokeStyle = npc.state === 'heard' ? '#96bfae' : '#e4c997'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(npc.x, npc.y, 19 + Math.sin(sessionState.run.time * 2) * 2, 0, Math.PI * 2); ctx.stroke();
      primitives.drawShape(npc.x, npc.y, 9, '#22323b', 4); primitives.drawShape(npc.x, npc.y, 4.5, npc.state === 'heard' ? '#8dd6b8' : '#ffe1a8', 4);
      ctx.textAlign = 'center'; ctx.font = 'bold 12px system-ui'; ctx.fillStyle = '#f7e5c4';
      if (near && npc.state === 'waiting') ctx.fillText('E · 대화', npc.x, npc.y - 29);
      if (near && npc.state === 'heard' && !npc.silenced && npc.still > 1) {
        ctx.fillStyle = '#c7eadc'; ctx.fillText('···', npc.x, npc.y - 29);
      }
    }
    if (sessionState.run.site) {
      const site = sessionState.run.site, near = Math.hypot(p.x - site.x, p.y - site.y) <= 74, pulse = Math.sin(sessionState.run.time * 2.8) * 3;
      ctx.strokeStyle = '#d3b98b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(site.x, site.y, 22 + pulse, 0, Math.PI * 2); ctx.stroke();
      primitives.drawShape(site.x, site.y, 12, '#f0d3a1', 4); primitives.drawShape(site.x, site.y, 5, '#433c39', 4);
      ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#f6ddb4';
      ctx.fillText(near ? 'E · 조사' : '◇ FIELD SITE', site.x, site.y - 34);
    }
    if (sessionState.run.objective) {
      const o = sessionState.run.objective, near = Math.hypot(p.x - o.x, p.y - o.y) <= 75, phase = o.phase, relay = o.id === 'relay', radius = relay && phase ? 115 : 26;
      ctx.strokeStyle = o.id === 'relay' ? '#9cdccf' : o.id === 'courier' ? '#b7c7f4' : '#ecc3a4'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(o.x,o.y,radius,0,Math.PI*2); ctx.stroke();
      if (relay && phase) { ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(o.x, o.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, o.progress / 16)); ctx.stroke(); }
      primitives.drawShape(o.x, o.y, 13, '#233941', 4); primitives.drawShape(o.x, o.y, 6, ctx.strokeStyle, 4);
      ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#d8eeed';
      ctx.fillText(near && (!phase || o.id === 'courier') ? 'E · ' + (phase ? '신호 회수' : '임무 시작') : phase && relay ? `동기화 ${Math.floor(o.progress)}/16` : phase && o.id === 'hunter' ? '목표 추적 중' : '◆ FIELD OBJECTIVE', o.x, o.y - radius - 15);
    }
    if (sessionState.run.objective?.id === 'hunter' && sessionState.run.objective.phase) {
      const target = sessionState.run.enemies.find(e => e.id === sessionState.run.objective.targetId && e.hp > 0);
      if (target) { ctx.strokeStyle = '#f4c19c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(target.x, target.y, target.radius + 10 + 3 * Math.sin(sessionState.run.time * 4), 0, 2 * Math.PI); ctx.stroke(); ctx.fillStyle = '#fbe0c0'; ctx.textAlign = 'center'; ctx.font = 'bold 12px system-ui'; ctx.fillText('표적', target.x, target.y - target.radius - 18); }
    }
  }

  function drawCollectibles(s,detail,cx,cy){
    const p=sessionState.run.player;
    {let trails=0;for(const gem of sessionState.run.gems)if(Math.abs(gem.x-cx)<W/2+10&&Math.abs(gem.y-cy)<H/2+10){drawGem(gem);const d=Math.hypot(gem.x-p.x,gem.y-p.y);if(detail&&trails<18&&d<s.magnet&&d>20){const t=Math.min(12,d*.15);primitives.skillLine(gem.x,gem.y,gem.x+(p.x-gem.x)/d*t,gem.y+(p.y-gem.y)/d*t,'#8ed5b6',1,false,0,.6);trails++;}}}
    for(const q of sessionState.run.pickups)if(Math.abs(q.x-cx)<W/2+40&&Math.abs(q.y-cy)<H/2+40){const color=q.type==='magnet'?'#9adfcf':q.type==='heal'?'#a8e5b5':'#f5d89b';primitives.skillCircle(q.x,q.y,17,color,true,1.5);ctx.save();ctx.fillStyle='#203b40';ctx.beginPath();ctx.arc(q.x,q.y,12,0,Math.PI*2);ctx.fill();if(q.type==='heal'){ctx.fillStyle=color;ctx.fillRect(q.x-6,q.y-2,12,4);ctx.fillRect(q.x-2,q.y-6,4,12);}else if(q.type==='magnet'){for(let i=0;i<4;i++){const a=i*Math.PI/2;primitives.skillArrow(q.x+Math.cos(a)*6,q.y+Math.sin(a)*6,a+Math.PI,color,4);}primitives.drawShape(q.x,q.y,2,color,4);}else{ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.beginPath();for(let i=0;i<7;i++){const a=i*Math.PI/3,x=q.x+Math.cos(a)*8,y=q.y+Math.sin(a)*8;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();}ctx.globalAlpha=.85;ctx.fillStyle=color;ctx.font='10px system-ui';ctx.textAlign='center';ctx.fillText(q.type==='magnet'?'경험치 회수':q.type==='heal'?'체력 회복':'무적 5초',q.x,q.y-26);ctx.restore();}
  }

  return { drawMarkers, drawCollectibles, drawJourney };
}
