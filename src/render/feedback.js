import { createVisualRandom } from '../core/random.js';
import { W, H } from '../core/config.js';
import { upgradeFamilies } from '../data/upgrades.js';
import { hasBranch } from '../growth/build.js';
import { clamp } from '../core/utils.js';
import { enemyType } from '../data/enemies.js';

export function createFeedback({ sessionState, platform, primitives, weaponView, cameraView, sfx = null }) {
  const { ctx } = platform, random = createVisualRandom(sessionState), sound = id => sfx?.play(id);

  function ring(x, y, radius, color, life = 0.3, kind = 'ring', r = sessionState.run) {
    if (r.waves.length < 90) r.waves.push({ x, y, radius, color, life, max: life, kind });
  }

  function impact(x, y, color, crit = false) {
    if (sessionState.run.fx.length > 270) return;
    for (let i = 0, count = crit ? 8 : 4; i < count; i++) {
      const a = (i * 2.39996 + x * .071 + y * .037 + sessionState.run.time * 4.9) % (Math.PI * 2), speed = crit ? 175 : 125, life = crit ? .3 : .2;
      sessionState.run.fx.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, max: life, color, streak: true });
    }
  }

  function burst(x, y, color, count = 5, kind = 'spark') {
    for (let i = 0; i < count && sessionState.run.fx.length < 360; i++) { const a = random() * Math.PI * 2, speed = 25 + random() * 90, life = 0.18 + random() * 0.24; sessionState.run.fx.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, max: life, color, kind }); }
  }

  function popup(x, y, value, color = '#f2eee5') { if (sessionState.run.popups.length < 100) sessionState.run.popups.push({ x, y, value: String(value), color, life: 0.6 }); }

  const skillEchoes={owner:null,items:[]};
  let attackOwner=null,skillAttacks=new WeakMap();
  let hitOwner=null,damageLabels=new WeakMap();
  // Presentation-only stamps: no damage, RNG, save fields or wall-clock timers.
  function markSkillAttack(source,data){if(attackOwner!==sessionState.run){attackOwner=sessionState.run;skillAttacks=new WeakMap();}skillAttacks.set(source,{...data,at:sessionState.run.time});}
  const skillAttackVisual=source=>attackOwner===sessionState.run?skillAttacks.get(source):undefined;
  function addSkillEcho(kind,data,duration=.16){if(skillEchoes.owner!==sessionState.run){skillEchoes.owner=sessionState.run;skillEchoes.items=[];}if(skillEchoes.items.length>=64)skillEchoes.items.shift();skillEchoes.items.push({kind,...data,life:duration,max:duration});}

  function tickSkillEchoes(dt){if(skillEchoes.owner!==sessionState.run){skillEchoes.owner=sessionState.run;skillEchoes.items=[];}for(let i=skillEchoes.items.length-1;i>=0;i--)if((skillEchoes.items[i].life-=dt)<=0)skillEchoes.items.splice(i,1);}

  function retireSkillField(f){const color=primitives.skillColor(f.type),line=(a,b)=>addSkillEcho('line',{x:a.x,y:a.y,x2:b.x,y2:b.y,color,passive:true});if(f.type==='nova')addSkillEcho('circle',{x:f.x,y:f.y,radius:f.length||0,color,passive:true});else if(f.type==='chain'||f.type==='rift'&&hasBranch('rift','trail',sessionState.run)){for(let i=1;i<f.points.length;i++)line(f.points[i-1],f.points[i]);if(f.type==='chain'&&f.phase==='loop'&&f.points.length>2)line(f.points.at(-1),f.points[0]);}else if(f.type==='lance'){const hit=skillAttackVisual(f),angle=hit?.kind==='line'?Math.atan2(hit.y2-hit.y1,hit.x2-hit.x1):Math.atan2(f.dy,f.dx);addSkillEcho('craft',{x:f.x,y:f.y,size:9,angle,color,passive:true});if(f.phase==='stay')line({x:f.x1,y:f.y1},f);}else if(f.type==='rift')line(f,{x:f.x+Math.cos(f.angle)*f.length,y:f.y+Math.sin(f.angle)*f.length});else if(f.type==='mine')addSkillEcho('circle',{x:f.x,y:f.y,radius:6,color,passive:true});}

  function drawSkillEchoes(){if(skillEchoes.owner!==sessionState.run)return;ctx.save();ctx.setLineDash([]);ctx.lineCap='round';for(const e of skillEchoes.items){const fade=clamp(e.life/e.max,0,1);if(e.kind==='riftCut'){weaponView.drawRiftScar(e.x,e.y,e.x2,e.y2,e.width,fade*.6,e.color,false,false);continue;}ctx.setLineDash(e.passive?[3,6]:[]);ctx.globalAlpha=(e.passive?.22:.35)*fade;ctx.strokeStyle=e.color;ctx.lineWidth=1;ctx.beginPath();if(e.kind==='line'){ctx.moveTo(e.x,e.y);ctx.lineTo(e.x2,e.y2);}else if(e.kind==='box')ctx.rect(e.x-e.size/2,e.y-e.size/2,e.size,e.size);else if(e.kind==='polygon'){for(const [i,p]of e.points.entries())if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);ctx.closePath();}else if(e.kind==='circle')ctx.arc(e.x,e.y,Math.max(0,e.radius),0,Math.PI*2);else{const r=e.size*fade,c=Math.cos(e.angle),v=Math.sin(e.angle);ctx.moveTo(e.x+c*r,e.y+v*r);ctx.lineTo(e.x-c*r*.6-v*r*.6,e.y-v*r*.6+c*r*.6);ctx.lineTo(e.x-c*r*.6+v*r*.6,e.y-v*r*.6-c*r*.6);ctx.closePath();}ctx.stroke();}ctx.restore();}

  function tickWeaponEffects(r,dt){for (const field of ['waves', 'arcs']) for (let i = r[field].length - 1; i >= 0; i--) { r[field][i].life -= dt; if (r[field][i].life <= 0) r[field].splice(i, 1); }}

  function tickCombatFeedback(r,dt){for (let i = r.fx.length - 1; i >= 0; i--) { const e = r.fx[i]; e.x += e.vx * dt; e.y += e.vy * dt; e.life -= dt; if (e.life <= 0) r.fx.splice(i, 1); }
    for (let i = r.popups.length - 1; i >= 0; i--) { const e = r.popups[i]; e.y -= 22 * dt; e.life -= dt; if (e.life <= 0) r.popups.splice(i, 1); }}

  function showPlayerHit(hit){
    const p=sessionState.run.player;cameraView.cameraKick(.9);sound('hurt');if(hit.stopped)popup(p.x,p.y-44,'TIME STOP','#c4c9f1');popup(p.x,p.y-22,`-${hit.dealt}`,'#ffaaa4');burst(p.x,p.y,'#ed938c',10);
  }

  function showEnemyHit(enemy,amount,crit){
    const r=sessionState.run;if(hitOwner!==r){hitOwner=r;damageLabels=new WeakMap();}sound(crit?'crit':'hit');
    const old=damageLabels.get(enemy),color=crit?'#ffe1a0':'#dce7e8';
    if(old&&r.time-old.at<.09&&r.popups.includes(old.label)){old.amount+=amount;old.label.value=String(Math.round(old.amount));if(crit){old.label.color=color;old.label.crit=true;}}
    else if(r.popups.length<(primitives.visualDetail()?60:28)){const label={x:enemy.x,y:enemy.y-enemy.radius-8,value:String(Math.round(amount)),color,life:.55,crit,hit:true};r.popups.push(label);damageLabels.set(enemy,{at:r.time,amount,label});}
    if(crit&&primitives.visualDetail()){ring(enemy.x,enemy.y,enemy.radius+10,'#ffe1a0',.16,'pop');burst(enemy.x,enemy.y,'#ffe1a0',4);}
    else if(primitives.visualDetail()&&r.waves.length<60)ring(enemy.x,enemy.y,enemy.radius+4,'#eef7f2',.1,'pop');if(r.fx.length<220&&primitives.visualDetail())impact(enemy.x,enemy.y,crit?'#ffe1a0':'#e5f0e7',crit);
  }

  function showEnemyDeath(enemy){sound('kill');const color=enemyType[enemy.kind].color,boss=enemy.kind===3;burst(enemy.x,enemy.y,color,boss?36:14,'debris');burst(enemy.x,enemy.y,'#f4fbf6',boss?10:4);ring(enemy.x,enemy.y,enemy.radius+(boss?40:16),color,boss?.4:.24,'pop');}

  function showUpgrade(id){sound('level');const family=upgradeFamilies[id],color=family==='생존'?'#a2e7bb':family==='제어'?'#a5d7f4':family==='탐사'?'#9fe6dd':family==='무기'?'#cdb6ec':'#f3d4a1';sessionState.run.waves=sessionState.run.waves.filter(w=>w.kind!=='upgrade');ring(sessionState.run.player.x,sessionState.run.player.y,36,color,.28,'upgrade');}

  function drawFeedback(detail,cx,cy){
    for (const fx of sessionState.run.fx) {
      if (Math.abs(fx.x-cx)>W/2+15 || Math.abs(fx.y-cy)>H/2+15) continue;
      const fade = Math.max(0, Math.min(1, fx.life / fx.max)); ctx.globalAlpha = fade;
      if (fx.streak) { const len = Math.hypot(fx.vx, fx.vy) || 1; ctx.strokeStyle = fx.color; ctx.lineWidth = fade > .45 ? 2.2 : 1.3;
        ctx.beginPath(); ctx.moveTo(fx.x, fx.y); ctx.lineTo(fx.x - fx.vx / len * 12 * fade, fx.y - fx.vy / len * 12 * fade); ctx.stroke();
      } else if(fx.kind==='debris'&&detail){ctx.save();ctx.translate(fx.x,fx.y);ctx.rotate(cameraView.reducedMotion()?0:Math.atan2(fx.vy,fx.vx)+(1-fade)*1.4);ctx.fillStyle=fx.color;ctx.globalAlpha=fade*.8;ctx.beginPath();ctx.moveTo(-3-fade*3,-1.5);ctx.lineTo(3+fade*3,0);ctx.lineTo(-1.5,3+fade*1.5);ctx.closePath();ctx.fill();ctx.restore();}else {ctx.fillStyle=fx.color;const size=1+fade*2;ctx.fillRect(fx.x-size/2,fx.y-size/2,size,size);if(detail&&fade>.6){ctx.strokeStyle=fx.color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(fx.x-3,fx.y);ctx.lineTo(fx.x+3,fx.y);ctx.moveTo(fx.x,fx.y-3);ctx.lineTo(fx.x,fx.y+3);ctx.stroke();}}
    }
    ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b161e';
    for (const text of sessionState.run.popups) { if (Math.abs(text.x-cx)>W/2+80 || Math.abs(text.y-cy)>H/2+20) continue; const pop = text.hit ? Math.max(0, text.life - .4) * 4 : 0;
      ctx.font = `bold ${Math.round((text.crit ? 17 : text.hit ? 13 : 12) * (1 + pop * .25))}px system-ui`; ctx.globalAlpha = Math.min(1, text.life * 2.5); ctx.lineWidth = 3; ctx.strokeText(text.value, text.x, text.y); ctx.fillStyle = text.color; ctx.fillText(text.value, text.x, text.y); }
  }

  return { sound, markSkillAttack, skillAttackVisual, drawFeedback, showUpgrade, ring, impact, burst, popup, addSkillEcho, tickSkillEchoes, retireSkillField, drawSkillEchoes, tickWeaponEffects, tickCombatFeedback, showPlayerHit, showEnemyHit, showEnemyDeath };
}
