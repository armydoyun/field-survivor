function refreshSlow(e,time) {
  if(!e.slowEffects?.length){e.slowAmount=e.slowUntil=0;return;}
  const active = e.slowEffects.filter(x => x.until > time && x.amount > 0);
  e.slowEffects = active; const best = active.reduce((a, x) => !a || x.amount > a.amount ? x : a, null); e.slowAmount = best?.amount || 0; e.slowUntil = best?.until || 0;
}

function applySlow(e,amount,duration,time) {
  refreshSlow(e,time); e.slowEffects ||= []; if (e.kind === 3) amount *= .5;
  const old = e.slowEffects.find(x => x.amount === amount); if (old) old.until = Math.max(old.until, time + duration); else e.slowEffects.push({ amount, until: time + duration });
  refreshSlow(e,time);
}

function setPush(e,x,y) { const scale = Math.min(1,120/(Math.hypot(x,y)||1)); e.pushX = x*scale; e.pushY = y*scale; }

function pushEnemy(e,x,y,force) {
  if (e.kind === 3 || e.coreNode || e.hp <= 0 || force <= 0) return;
  const dx = e.x-x, dy = e.y-y, d = Math.hypot(dx,dy), a = e.id*2.4;
  force*=e.elite?.8:1;setPush(e,(e.pushX||0)+(d<.001?Math.cos(a):dx/d)*force,(e.pushY||0)+(d<.001?Math.sin(a):dy/d)*force);
}

function advancePush(e,dt) { const x=e.pushX||0,y=e.pushY||0; if(!x&&!y)return; const f=1-Math.exp(-14*dt);e.x+=x*f;e.y+=y*f;e.pushX=x*(1-f);e.pushY=y*(1-f);if(Math.hypot(e.pushX,e.pushY)<.01){e.pushX=0;e.pushY=0;} }

export { refreshSlow, applySlow, setPush, pushEnemy, advancePush };
