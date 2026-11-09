import { skillColors } from '../data/visuals.js';
import { specialized } from '../growth/build.js';
import { hasRelic } from '../world/effects.js';
import { recoveryScale } from '../combat/recovery.js';
import { clamp } from '../core/utils.js';

export function createPlayerView({ sessionState, renderState, platform, primitives, cameraView }) {
  const {ctx,keys}=platform;
  function drawStatus(s){const p=sessionState.run.player;ctx.save();if(sessionState.run.time<sessionState.run.invulnUntil){const r=24;ctx.strokeStyle='#f4d793';ctx.lineWidth=2;ctx.globalAlpha=(.8)*renderState.opacity;ctx.beginPath();for(let i=0;i<7;i++){const a=i*Math.PI/3,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();primitives.skillCircle(p.x,p.y,r+4,'#f4d793',true,1,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp((sessionState.run.invulnUntil-sessionState.run.time)/5,0,1));}if(p.hurt>0){primitives.skillCircle(p.x,p.y,21,'#ffa08c',true,2);if(s.armor>0)primitives.skillBrackets(p.x,p.y,25,'#b2d5e5');}if(s.regen>0&&p.hp<s.maxHp){const x=p.x-25,y=p.y+9,factor=recoveryScale(sessionState.run);ctx.globalAlpha=(factor<1?.35:.8)*renderState.opacity;ctx.fillStyle='#a3e4b7';ctx.fillRect(x-3,y-1,6,2);ctx.fillRect(x-1,y-3,2,6);primitives.skillCircle(x,y,6,'#a3e4b7',true,1,-Math.PI/2,-Math.PI/2+Math.PI*2*factor);}ctx.globalAlpha=(1)*renderState.opacity;primitives.drawShape(p.x,p.y,12,p.hurt>0?'#ffc1ac':'#e9f9f4');ctx.strokeStyle='#426771';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(p.x,p.y,16,0,Math.PI*2);ctx.stroke();primitives.skillCircle(p.x,p.y,16,p.hp<s.maxHp*.3?'#f2b291':'#9ae4d4',true,2.5,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(p.hp/s.maxHp,0,1));ctx.restore();}

  function drawOrbitAndMotion(s,detail){
    const p=sessionState.run.player;
    for (let i = 0; i < (specialized('orbit',sessionState.run)?0:s.orbit); i++) {
      const a = sessionState.run.time * 3 + i * Math.PI * 2 / s.orbit, ready = sessionState.run.time >= (sessionState.run.orbitGuards[i] || 0);
      const x = p.x + Math.cos(a) * s.orbitRadius, y = p.y + Math.sin(a) * s.orbitRadius;
      ctx.strokeStyle = ready ? skillColors.orbit[0] : '#6e7c89'; ctx.lineWidth = 2; ctx.globalAlpha = .2;
      ctx.beginPath(); ctx.arc(p.x, p.y, s.orbitRadius, a - .55, a - .06); ctx.stroke(); ctx.globalAlpha = 1;
      primitives.skillCraft(x,y,8,a+Math.PI/2,ready?skillColors.orbit[0]:'#657680',true);if(ready)primitives.skillCircle(x,y,12,skillColors.orbit[0],true,1.5,a-.9,a+.9);
      if(ready){primitives.drawShape(x,y,3,'#fff5ff',4);if(detail){ctx.globalAlpha=.6;ctx.strokeStyle=skillColors.orbit[0];ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,11,a-.9,a+.9);ctx.stroke();ctx.globalAlpha=1;}}
    }

    if (sessionState.run.momentumTime > 0 && ((sessionState.run.up.momentum || 0) > 0)) {
      const dx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const dy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      const length = Math.hypot(dx, dy);
      if (length) { const ux = dx / length, uy = dy / length;
        ctx.strokeStyle = '#a1d3d3'; ctx.lineWidth = 1.4; ctx.globalAlpha = .27;
        ctx.beginPath(); for (const side of [-1, 1]) { const x = p.x - ux * 13 + -uy * side * 5, y = p.y - uy * 13 + ux * side * 5; ctx.moveTo(x, y); ctx.lineTo(x - ux * 9, y - uy * 9); } ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    if (hasRelic('capacitor',sessionState.run) && p.hp <= s.maxHp * .4) {
      ctx.strokeStyle = '#efc1a2'; ctx.lineWidth = 1.5; ctx.globalAlpha=cameraView.reducedMotion()?.5:.5+.08*Math.sin(sessionState.run.time*2);
      ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  return { drawStatus, drawOrbitAndMotion };
}
