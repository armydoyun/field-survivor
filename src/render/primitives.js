import { skillStyle, skillDetail } from './skill-style.js';
import { skillColors } from '../data/visuals.js';
import { viewSetting } from '../ui/settings.js';
import { clamp } from '../core/utils.js';

export function createPrimitives({ sessionState, renderState, platform, cameraView }) {
  const { ctx } = platform;

  function drawShape(x, y, radius, fill, sides = 0) {
    ctx.fillStyle = fill; ctx.beginPath();
    if (sides) { for (let i = 0; i < sides; i++) { const a = i * Math.PI * 2 / sides - Math.PI / 2; if (!i) ctx.moveTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); else ctx.lineTo(x + Math.cos(a) * radius, y + Math.sin(a) * radius); } ctx.closePath(); }
    else ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const skillColor=id=>skillColors[id][0];

  const visualDetail=()=>skillDetail(sessionState.run,cameraView.reducedMotion()||!viewSetting(sessionState.profile,'effects'));

  function skillLine(x1,y1,x2,y2,color,width=2,active=true,band=0,strength=1){ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(active?[]:[5,7]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);if(active){if(visualDetail()){ctx.strokeStyle='#11232b';ctx.globalAlpha=(.7*strength)*renderState.opacity;ctx.lineWidth=width+2;ctx.stroke();}if(band>0){ctx.strokeStyle=color;ctx.globalAlpha=(skillStyle.band*strength)*renderState.opacity;ctx.lineWidth=band*2;ctx.stroke();}}ctx.strokeStyle=color;ctx.globalAlpha=((active?.88:.28)*strength)*renderState.opacity;ctx.lineWidth=width;ctx.stroke();if(active&&visualDetail()){ctx.globalAlpha=(.5*strength)*renderState.opacity;ctx.strokeStyle='#f2fff1';ctx.lineWidth=.7;ctx.stroke();}ctx.restore();}

  function skillCircle(x,y,r,color,active=true,width=1.5,start=0,end=Math.PI*2){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=(active?.72:skillStyle.warning)*renderState.opacity;ctx.setLineDash(active?[]:[4,7]);ctx.beginPath();ctx.arc(x,y,Math.max(0,r),start,end);ctx.stroke();ctx.restore();}

  function skillArrow(x,y,angle,color,size=5,alpha=.8){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.globalAlpha=(alpha)*renderState.opacity;ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(-size,-size*.65);ctx.lineTo(0,0);ctx.lineTo(-size,size*.65);ctx.stroke();ctx.restore();}

  function skillFlow(a,b,color,back=false,alpha=.7){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<18)return;const count=visualDetail()?Math.min(3,Math.max(1,Math.floor(d/90))):1,shift=cameraView.reducedMotion()?.5:(sessionState.run.time*.8)%1;for(let i=0;i<count;i++){const t=(i+shift)/count,v=back?1-t:t;skillArrow(a.x+dx*v,a.y+dy*v,Math.atan2(dy,dx)+(back?Math.PI:0),color,5,alpha);}}

  function skillBrackets(x,y,r,color,progress=0){ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=(.6)*renderState.opacity;ctx.lineWidth=1.2;ctx.setLineDash([]);ctx.beginPath();for(const sx of [-1,1])for(const sy of [-1,1]){ctx.moveTo(x+sx*r,y+sy*(r-5));ctx.lineTo(x+sx*r,y+sy*r);ctx.lineTo(x+sx*(r-5),y+sy*r);}ctx.stroke();ctx.restore();if(progress>0)skillCircle(x,y,r+5,color,true,1.5,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp(progress,0,1));}

  function skillDisk(x,y,r,color,fade=1){ctx.save();ctx.globalAlpha=(skillStyle.fill*fade)*renderState.opacity;ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.fill();ctx.globalAlpha=(.8*fade)*renderState.opacity;ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.stroke();if(visualDetail()){ctx.globalAlpha=(.2*fade)*renderState.opacity;ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,Math.max(0,r-5),0,Math.PI*2);ctx.stroke();}ctx.restore();}

  function skillCraft(x,y,size,angle,color,active=true,heavy=false){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=(active?.96:.42)*renderState.opacity;ctx.fillStyle=skillStyle.housing;ctx.strokeStyle=color;ctx.lineWidth=heavy?2:1.5;ctx.beginPath();ctx.moveTo(size,0);ctx.lineTo(-size*.6,size*.65);ctx.lineTo(-size*.37,0);ctx.lineTo(-size*.6,-size*.65);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-size*.37,0);ctx.lineTo(size*.45,0);ctx.stroke();if(heavy){ctx.beginPath();for(const sign of [-1,1]){ctx.moveTo(-size*.5,sign*size*.82);ctx.lineTo(size*.2,sign*size*.58);ctx.lineTo(size*.48,sign*size*.2);ctx.moveTo(-size*.24,sign*size*.37);ctx.lineTo(size*.14,sign*size*.17);}ctx.stroke();}if(active&&visualDetail()){ctx.globalAlpha=(.45)*renderState.opacity;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(-size*.5,-size*.2);ctx.lineTo(-size*(1.05+.15*Math.sin(sessionState.run.time*12)),0);ctx.lineTo(-size*.5,size*.2);ctx.fill();}ctx.restore();}

  function skillEmitter(x,y,angle,color,ready=true,relay=false){ctx.save();ctx.translate(x,y);ctx.globalAlpha=(ready?.9:.4)*renderState.opacity;ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.fillStyle=skillStyle.housing;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3,vx=Math.cos(a)*9,vy=Math.sin(a)*9;if(i)ctx.lineTo(vx,vy);else ctx.moveTo(vx,vy);}ctx.closePath();ctx.fill();ctx.stroke();ctx.rotate(angle);ctx.beginPath();ctx.moveTo(1,-3);ctx.lineTo(relay?14:12,-3);ctx.lineTo(relay?14:12,3);ctx.lineTo(1,3);ctx.stroke();drawShape(0,0,2.5,color,relay?4:0);ctx.restore();}

  return { drawShape, skillColor, visualDetail, skillLine, skillCircle, skillArrow, skillFlow, skillBrackets, skillDisk, skillCraft, skillEmitter };
}
