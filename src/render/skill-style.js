// Presentation contract shared by original weapons and fusions. No combat state or RNG.
export const skillStyle=Object.freeze({core:'#effbf1',housing:'#152c38',outline:'#0c1c27',fill:.045,band:.07,warning:.24,echo:.22,stroke:1.5,maxEchoes:24});
export const fusionStyle=Object.freeze({
 F01:['#f7d989','#d5bdff','rail'],F02:['#f7d989','#a3dbf6','guns'],F03:['#e6ca8f','#f7d989','mines'],F04:['#80e3c4','#f7d989','wave'],
 F05:['#ade1ff','#8fe4c8','fleet'],F06:['#9de7ff','#8fe4c8','network'],F07:['#d5bdff','#8fe4c8','cutters'],F08:['#8fe4c8','#e6ca8f','meteors'],
 F09:['#a3dbf6','#80e3c4','wall'],F10:['#ade1ff','#80e3c4','strata'],F11:['#9de7ff','#80e3c4','reflux'],F12:['#9de7ff','#a3dbf6','network'],
 F13:['#d5bdff','#9de7ff','zone'],F14:['#ade1ff','#e6ca8f','lances'],F15:['#d5bdff','#ade1ff','slash'],F16:['#e6ca8f','#a3dbf6','mines'],
 H01:['#f7d989','#a3dbf6','barrage'],H02:['#9de7ff','#80e3c4','storm'],H03:['#ade1ff','#8fe4c8','fleet'],H04:['#d5bdff','#9de7ff','crusher'],H05:['#e6ca8f','#ade1ff','frontline'],H06:['#d5bdff','#9de7ff','slash']
});
export function skillDetail(run,reduced=false){
 const effects=Object.values(run.fusionStates||{}).reduce((sum,q)=>sum+(q.effects?.length||0),0);
 return !reduced&&run.enemies.length<120&&run.shots.length+effects<150;
}
export function createSkillDesign(ctx){
 const begin=(color,fade=1)=>{ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=Math.max(0,Math.min(1,fade));ctx.setLineDash([]);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=skillStyle.stroke;};
 const pathLine=(x,y,x2,y2)=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);};
 function bolt(x,y,angle,r,color,{fade=1,detail=true,aux=false,lance=false,cold=false,crit=false}={}){
  begin(color,fade);ctx.translate(x,y);ctx.rotate(angle);const tail=lance?28:aux?10:17;
  pathLine(-tail,0,-r,0);ctx.globalAlpha=fade*.16;ctx.lineWidth=Math.max(2,r*1.8);ctx.stroke();ctx.globalAlpha=fade*.85;ctx.lineWidth=lance?2:1.3;ctx.stroke();
  ctx.beginPath();ctx.moveTo(r,0);ctx.lineTo(-r*.7,r*.62);if(lance)ctx.lineTo(-r*.22,0);ctx.lineTo(-r*.7,-r*.62);ctx.closePath();ctx.fill();
  if(detail){ctx.strokeStyle=skillStyle.core;ctx.globalAlpha=fade*.8;ctx.lineWidth=.8;pathLine(-r*.5,0,r*.7,0);ctx.stroke();}
  if(cold){ctx.strokeStyle='#d6f5ff';ctx.globalAlpha=fade*.65;ctx.lineWidth=1;pathLine(0,-r,0,r);ctx.stroke();}
  if(crit&&detail){ctx.strokeStyle=skillStyle.core;ctx.globalAlpha=fade*.65;pathLine(0,-r-2,0,-r-5);ctx.moveTo(0,r+2);ctx.lineTo(0,r+5);ctx.stroke();}ctx.restore();
 }
 function lightning(x,y,x2,y2,color,{fade=1,detail=true,seed=0}={}){
  begin(color,fade);const dx=x2-x,dy=y2-y,d=Math.hypot(dx,dy)||1,n=detail?Math.min(8,Math.max(3,Math.ceil(d/35))):3;
  ctx.beginPath();ctx.moveTo(x,y);for(let i=1;i<n;i++){const t=i/n,zig=Math.sin(i*2.71+seed*.61)*Math.min(7,d*.055);ctx.lineTo(x+dx*t-dy/d*zig,y+dy*t+dx/d*zig);}ctx.lineTo(x2,y2);
  if(detail){ctx.globalAlpha=fade*.12;ctx.lineWidth=5;ctx.stroke();}ctx.globalAlpha=fade*.85;ctx.lineWidth=1.5;ctx.stroke();if(detail){ctx.strokeStyle=skillStyle.core;ctx.globalAlpha=fade*.65;ctx.lineWidth=.65;ctx.stroke();}ctx.restore();
 }
 function slash(x,y,angle,rx,ry,color,{fade=1,detail=true,accent=skillStyle.core}={}){
  begin(color,fade);ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.globalAlpha=fade*.2;ctx.lineWidth=1;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-rx,0);ctx.bezierCurveTo(-rx*.4,-ry,rx*.45,-ry*.7,rx,0);ctx.bezierCurveTo(rx*.35,-ry*.1,-rx*.25,ry*.5,-rx,0);ctx.closePath();ctx.globalAlpha=fade*.17;ctx.fill();
  ctx.beginPath();ctx.moveTo(-rx,0);ctx.bezierCurveTo(-rx*.2,-ry*.38,rx*.45,-ry*.36,rx,0);ctx.globalAlpha=fade*.95;ctx.lineWidth=detail?2.8:2;ctx.stroke();
  if(detail){ctx.strokeStyle=accent;ctx.globalAlpha=fade*.8;ctx.lineWidth=.8;ctx.stroke();ctx.strokeStyle=color;ctx.globalAlpha=fade*.35;ctx.beginPath();ctx.moveTo(-rx*.72,ry*.28);ctx.quadraticCurveTo(0,ry*.6,rx*.7,ry*.1);ctx.stroke();}ctx.restore();
 }
 function area(x,y,r,color,{fade=1,detail=true,warning=false,zone=false,motif='pulse'}={}){
  begin(color,fade);ctx.globalAlpha=fade*(warning?.14:.6);ctx.lineWidth=warning?1:1.6;ctx.setLineDash(warning?[3,7]:[]);ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.stroke();
  if(!warning){ctx.setLineDash([]);ctx.globalAlpha=fade*(zone?.025:skillStyle.fill);ctx.fill();}
  if(detail){ctx.globalAlpha=fade*(warning?.17:.38);ctx.lineWidth=1;const count=motif==='blast'?6:4;ctx.beginPath();for(let i=0;i<count;i++){const a=i*Math.PI*2/count+.15;ctx.moveTo(x+Math.cos(a)*Math.max(0,r-4),y+Math.sin(a)*Math.max(0,r-4));ctx.arc(x,y,Math.max(0,r-4),a,a+.22);ctx.moveTo(x+Math.cos(a)*(r-8),y+Math.sin(a)*(r-8));ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.stroke();}
  if(zone&&!warning){ctx.setLineDash([]);ctx.globalAlpha=fade*.45;ctx.lineWidth=1.2;ctx.beginPath();for(let i=0;i<3;i++){const a=i*Math.PI/3+.2;ctx.moveTo(x+Math.cos(a)*r*.55,y+Math.sin(a)*r*.55);ctx.lineTo(x-Math.cos(a)*r*.55,y-Math.sin(a)*r*.55);}ctx.stroke();}
  ctx.restore();
 }
 function annulus(x,y,r,width,color,{fade=1,detail=true,back=false}={}){
  begin(color,fade);ctx.globalAlpha=fade*skillStyle.band;ctx.beginPath();ctx.arc(x,y,r+width/2,0,Math.PI*2);ctx.arc(x,y,Math.max(0,r-width/2),0,Math.PI*2,true);ctx.fill();
  ctx.globalAlpha=fade*.6;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x,y,r+width/2,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=fade*.25;ctx.beginPath();ctx.arc(x,y,Math.max(0,r-width/2),0,Math.PI*2);ctx.stroke();
  if(detail){ctx.globalAlpha=fade*.7;ctx.lineWidth=1.5;for(let i=0;i<6;i++){const a=i*Math.PI/3,s=back?-1:1,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;ctx.beginPath();ctx.moveTo(px-Math.cos(a-.6)*5*s,py-Math.sin(a-.6)*5*s);ctx.lineTo(px,py);ctx.lineTo(px-Math.cos(a+.6)*5*s,py-Math.sin(a+.6)*5*s);ctx.stroke();}}ctx.restore();
 }
 function front(x,y,angle,width,depth,color,{fade=1,detail=true,warning=false}={}){
  begin(color,fade);ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=fade*(warning?.16:.55);ctx.setLineDash(warning?[4,8]:[]);ctx.lineWidth=warning?1:1.3;ctx.strokeRect(-depth/2,-width/2,depth,width);
  if(!warning){ctx.globalAlpha=fade*skillStyle.fill;ctx.fillRect(-depth/2,-width/2,depth,width);ctx.setLineDash([]);ctx.globalAlpha=fade*.86;ctx.lineWidth=2;pathLine(depth/2,-width/2,depth/2,width/2);ctx.stroke();
   if(detail){ctx.globalAlpha=fade*.3;ctx.lineWidth=1;ctx.beginPath();for(let i=-1;i<=1;i++){const y=i*width*.28;ctx.moveTo(-depth*.25,y-5);ctx.lineTo(depth*.15,y);ctx.lineTo(-depth*.25,y+5);}ctx.stroke();}}
  ctx.restore();
 }
 function rail(x,y,x2,y2,width,color,{fade=1,detail=true,passive=false}={}){
  begin(color,fade);const dx=x2-x,dy=y2-y,d=Math.hypot(dx,dy)||1,nx=-dy/d*width/2,ny=dx/d*width/2;
  ctx.globalAlpha=fade*(passive?.025:.055);ctx.lineWidth=width;pathLine(x,y,x2,y2);ctx.stroke();ctx.globalAlpha=fade*(passive?.2:.65);ctx.lineWidth=passive?1:1.7;ctx.setLineDash(passive?[3,7]:[]);pathLine(x,y,x2,y2);ctx.stroke();
  if(detail){ctx.globalAlpha=fade*.24;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+nx,y+ny);ctx.lineTo(x2+nx,y2+ny);ctx.moveTo(x-nx,y-ny);ctx.lineTo(x2-nx,y2-ny);ctx.stroke();}ctx.restore();
 }
 function mine(x,y,color,{fade=1,detail=true,armed=true,progress=1,chain=false}={}){
  begin(color,fade);ctx.translate(x,y);ctx.globalAlpha=fade*(armed?.9:.4);ctx.fillStyle=skillStyle.housing;ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;const px=Math.cos(a)*8,py=Math.sin(a)*8;if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.fillRect(-2,-2,4,4);
  if(detail){ctx.globalAlpha=fade*.4;ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,12,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,progress)));ctx.stroke();if(chain){pathLine(-12,0,-9,0);ctx.moveTo(9,0);ctx.lineTo(12,0);ctx.stroke();}}ctx.restore();
 }
 return {bolt,lightning,slash,area,annulus,front,rail,mine};
}
