import { clamp } from '../core/utils.js';

function segmentHit(ax, ay, bx, by, x, y, radius) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2)) : 0;
  return (ax + dx * t - x) ** 2 + (ay + dy * t - y) ** 2 <= radius * radius;
}

function segmentEntry(ax, ay, bx, by, x, y, radius) {
  const dx = bx-ax, dy = by-ay, fx = ax-x, fy = ay-y, c = fx*fx+fy*fy-radius*radius; if (c <= 0) return 0;
  const a = dx*dx+dy*dy, b = fx*dx+fy*dy, d = b*b-a*c; if (!a || d < 0) return Infinity;
  const t = (-b-Math.sqrt(d))/a; return t >= 0 && t <= 1 ? t : Infinity;
}

export { segmentHit, segmentEntry };

function hazardGeometry(h,time){const t=Math.max(0,Math.min(1,(time-h.fireAt)/(h.endAt-h.fireAt)));return {radius:h.shape==='ring'?26+(h.radius-26)*t:h.radius,angle:(h.angle||0)+(h.turn||0)*t};}

function hazardHit(h,p,time){
  if(h.shape==='beam'){const {angle}=hazardGeometry(h,time);return segmentHit(h.x,h.y,h.x+Math.cos(angle)*h.length,h.y+Math.sin(angle)*h.length,p.x,p.y,h.width/2+11);}
  if(h.shape==='ring'){const {radius}=hazardGeometry(h,time),d=Math.hypot(p.x-h.x,p.y-h.y),angle=Math.atan2(p.y-h.y,p.x-h.x),diff=Math.abs(Math.atan2(Math.sin(angle-h.angle),Math.cos(angle-h.angle))),edge=Math.asin(Math.min(1,11/Math.max(11,d)));return Math.abs(d-radius)<h.width/2+11&&diff>h.gap/2-edge;}
  return Math.hypot(p.x-h.x,p.y-h.y)<h.radius+11;
}

function pointInFusionPolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}

function moveSkillPoint(u,to,step){const d=Math.hypot(to.x-u.x,to.y-u.y);if(d>step){u.x+=(to.x-u.x)*step/d;u.y+=(to.y-u.y)*step/d;}else{u.x=to.x;u.y=to.y;}}

const turnSkill=(a,b,step) => a+clamp(Math.atan2(Math.sin(b-a),Math.cos(b-a)),-step,step);

const easeSkill=(t) => {t=clamp(t,0,1);return t*t*(3-2*t);};

function fusionPolygon(x,y,r,count,angle=0){return Array.from({length:count},(_,i)=>({x:x+Math.cos(angle+i*Math.PI*2/count)*r,y:y+Math.sin(angle+i*Math.PI*2/count)*r}));}

const fusionLerp=(a,b,t) => ({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});

const fusionPoint=(x,y) => ({x,y});

export { hazardGeometry, hazardHit, pointInFusionPolygon, moveSkillPoint, turnSkill, easeSkill, fusionPolygon, fusionLerp, fusionPoint };
