import { canControlLiveCombat } from '../core/view-policy.js';
import { W, H } from '../core/config.js';
import { hazardGeometry } from '../math/geometry.js';

export function readDebugOptions(search = '') {
  const enabled=/(?:^\?|&)debug=1(?:&|$)/.test(search),match=search.match(/(?:^\?|&)seed=([0-9]+)(?:&|$)/),seed=match?Number(match[1]):NaN;
  return {enabled,seed:enabled && Number.isInteger(seed) && seed>=0 && seed<=0xffffffff ? seed : undefined};
}

// Opt in with ?debug=1. Records executed tests, never infers damage from visual effects.
export function createCombatInspector({ sessionState, view, platform, cameraView, now = () => performance.now(), enabled = false }) {
  let visible = enabled, held = false, pending = false, owner = null, shapes = [], windows = [], dropped = 0, samples = [], frameAt = null;
  let last = { update:0, render:0, frame:0 }, stepTime = 0;
  const active = () => visible && !!sessionState.run;
  function sync() { if (owner !== sessionState.run) { owner = sessionState.run; shapes = []; windows = []; samples = []; dropped = 0; held = pending = false; frameAt = null; } }
  function beginStep() { sync(); if (!active()) return; shapes = []; windows = []; dropped = 0; stepTime = sessionState.run.time; }
  function record(kind, values, label, role = 'attack') {
    if (!active()) return;
    if (shapes.length >= 512) { dropped++; return; }
    stepTime = sessionState.run.time;
    shapes.push({ kind, values, label, role });
  }
  const circle = (x,y,r,label,role) => { if (active()) record('circle',[x,y,r],label,role); };
  const segment = (x,y,x2,y2,width,label,role) => { if (active()) record('segment',[x,y,x2,y2,width],label,role); };
  const band = (x,y,inner,outer,label,role) => { if (active()) record('band',[x,y,inner,outer],label,role); };
  const box = (x,y,half,angle,label,role) => { if (active()) record('box',[x,y,half,angle],label,role); };
  function polygon(points,label) { if (active()) record('polygon',points.map(p=>[p.x,p.y]),label); }
  function hit(enemy,amount) { if (active()) record('circle',[enemy.x,enemy.y,enemy.radius],`HIT ${enemy.id} ${Math.round(amount)}`,'hit'); }
  function hitWindow(owner,id,bucket,gap,limit,list,accepted) {
    if (!active() || windows.length >= 128) return;
    const entry=list.find(h=>h.id===id&&(h.tag===undefined||h.tag===bucket));
    windows.push({owner,id,bucket,gap,limit,count:entry?.count||0,remaining:entry?Math.max(0,gap-sessionState.run.time+entry.at):0,accepted});
  }
  function hazard(h,time) {
    if (!active()) return;
    const {radius,angle}=hazardGeometry(h,time);
    if(h.shape==='beam')segment(h.x,h.y,h.x+Math.cos(angle)*h.length,h.y+Math.sin(angle)*h.length,h.width/2,'hazard','hostile');
    else if(h.shape==='ring')record('arc',[h.x,h.y,radius,h.width/2,h.angle,h.gap],'hazard','hostile');
    else circle(h.x,h.y,h.radius,'hazard','hostile');
  }
  function keydown(event) {
    if (!enabled || !['F6','F7','F8'].includes(event.code) || view.panic || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return false;
    if (event.target?.isContentEditable || event.target?.closest?.('input,textarea,select')) return false;
    event.preventDefault(); if (event.repeat) return true; sync();
    if (event.code === 'F6') { visible = !visible; shapes = []; windows = []; samples = []; frameAt = null; }
    else if (canControlLiveCombat(view)) {
      platform.keys.clear(); if (event.code === 'F7') { held = !held; pending = false; } else if (held) pending = true;
    }
    return true;
  }
  function shouldUpdate(allowed) {
    sync(); if (!allowed) { pending = false; return false; }
    if (!held) return true;
    const step = pending; pending = false; return step;
  }
  function setHeld(value){sync();if(!sessionState.run||!canControlLiveCombat(view))return false;held=!!value;pending=false;platform.keys.clear();return true;}
  function requestStep(){if(!setHeld(true))return false;pending=true;return true;}
  function measureFrame(updateMs,renderMs) {
    if (!active()) return;
    const time = now(); last = { update:updateMs, render:renderMs, frame:frameAt == null ? 0 : time-frameAt }; frameAt = time;
    samples.push(last); if (samples.length > 180) samples.shift();
  }
  function report() {
    const mean = key => samples.length ? samples.reduce((n,s)=>n+s[key],0)/samples.length : 0;
    const sorted = samples.map(s=>s.frame).filter(x=>x>0).sort((a,b)=>a-b), r=sessionState.run;
    return { last:{...last}, mean:{update:mean('update'),render:mean('render')}, frameP95:sorted[Math.max(0,Math.ceil(sorted.length*.95)-1)]||0, samples:samples.length, dropped,
      counts:r ? {enemies:r.enemies.length,shots:r.shots.length,bullets:r.bullets.length,fields:r.arsenal.fields.length,fx:r.fx.length,gems:r.gems.length} : {},
      seed:r?.rng?.seed ?? null, randomState:r?.rng?.state ?? null, held, stepTime, windows:windows.map(w=>({...w})) };
  }
  function drawShape(ctx,shape) {
    const v=shape.values; ctx.strokeStyle=shape.role==='hit'?'#ff8cf0':shape.role==='hostile'?'#ff7777':shape.role==='sensor'?'#ffd577':'#7dffab';
    ctx.lineWidth=1; ctx.setLineDash(shape.role==='sensor'?[4,4]:[]); ctx.beginPath();
    if (shape.kind==='circle') ctx.arc(v[0],v[1],Math.max(0,v[2]),0,Math.PI*2);
    else if (shape.kind==='band') { for (const r of [v[2],v[3]]) { ctx.moveTo(v[0]+Math.max(0,r),v[1]); ctx.arc(v[0],v[1],Math.max(0,r),0,Math.PI*2); } }
    else if (shape.kind==='arc') { const [x,y,r,w,a,g]=v,start=a+g/2,end=a+Math.PI*2-g/2;for(const radius of [Math.max(0,r-w),r+w]){ctx.moveTo(x+Math.cos(start)*radius,y+Math.sin(start)*radius);ctx.arc(x,y,radius,start,end);} }
    else if (shape.kind==='segment') {
      const [x,y,x2,y2,r]=v,a=Math.atan2(y2-y,x2-x),nx=-Math.sin(a)*r,ny=Math.cos(a)*r;
      ctx.moveTo(x+nx,y+ny);ctx.lineTo(x2+nx,y2+ny);ctx.arc(x2,y2,r,a+Math.PI/2,a-Math.PI/2,true);ctx.lineTo(x-nx,y-ny);ctx.arc(x,y,r,a-Math.PI/2,a+Math.PI/2,true);ctx.closePath();
    } else if (shape.kind==='box') {
      ctx.save();ctx.translate(v[0],v[1]);ctx.rotate(v[3]||0);ctx.rect(-v[2],-v[2],v[2]*2,v[2]*2);ctx.restore();
    } else if (shape.kind==='polygon' && v.length) { ctx.moveTo(...v[0]);for(const point of v.slice(1))ctx.lineTo(...point);ctx.closePath(); }
    else if (shape.kind==='rect') { ctx.save();ctx.translate(v[0],v[1]);ctx.rotate(v[4]);ctx.rect(v[2],v[3],v[5],v[6]);ctx.restore(); }
    ctx.stroke();
  }
  function draw() {
    if (!active() || !canControlLiveCombat(view)) return;
    const {ctx}=platform,camera=cameraView.camera,r=sessionState.run;ctx.save();
    ctx.translate(W/2-camera.x+camera.shakeX,H/2-camera.y+camera.shakeY);ctx.globalAlpha=.8;
    for(const shape of shapes)drawShape(ctx,shape);
    ctx.restore();ctx.save();ctx.globalAlpha=.94;ctx.fillStyle='#07121c';ctx.fillRect(8,8,Math.min(W-16,680),198);ctx.globalAlpha=1;ctx.fillStyle='#dbf3ed';ctx.font='12px monospace';ctx.textAlign='left';
    const info=report(),n=x=>Number(x).toFixed(2),states=[...r.arsenal.fields.map(f=>`${f.owner}:${f.phase} age=${n(f.age)} life=${n(f.life)} entries=${(f.hit?.length||0)+(f.backHit?.length||0)}`),...Object.entries(r.fusionStates).map(([id,q])=>`${id}:${q.phase} age=${n(q.age)} clock=${n(q.clock)} entries=${q.hits.length}`)];
    const lines=[`DEBUG ${held?'HOLD':'LIVE'} | F6 표시 F7 정지 F8 1/60초 진행`,
      `판정 @${n(stepTime)}s | 초록 공격 · 노랑 감지 · 빨강 적 공격 · 분홍 명중`,
      `새 판 seed=${info.seed??'legacy'} state=${info.randomState??'-'} | shapes=${shapes.length} 생략=${dropped}`,
      `평균 update ${n(info.mean.update)}ms render ${n(info.mean.render)}ms | frame p95 ${n(info.frameP95)}ms`,
      Object.entries(info.counts).map(([key,value])=>`${key}:${value}`).join(' '),...states.slice(0,4),
      ...windows.slice(-2).map(w=>`${w.owner}:${w.bucket} #${w.id} ${w.count}/${w.limit} gap=${n(w.gap)} wait=${n(w.remaining)} ${w.accepted?'PASS':'BLOCK'}`)];
    lines.forEach((line,i)=>ctx.fillText(line,16,26+i*16));ctx.restore();
  }
  return { get enabled(){return visible;},get held(){return held;},beginStep,circle,segment,band,box,polygon,hit,hazard,hitWindow,
    rect:(x,y,u,v,angle,width,height,label)=>{if(active())record('rect',[x,y,u,v,angle,width,height],label);},
    setHeld,requestStep,keydown,shouldUpdate,measureFrame,idleFrame:()=>{frameAt=null;},report,draw, snapshot:()=>shapes.map(s=>({...s,values:s.values.map(v=>Array.isArray(v)?v.slice():v)})) };
}
