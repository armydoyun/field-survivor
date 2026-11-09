import { activeFusions } from '../growth/build.js';
import { makeFusionRuntime } from '../combat/fusion-record.js';
const types=new Set(['bolt','rect','blast','mine','ring','zone','trail','lance']);
const fields=new Set('type channel age life group x y sx sy x2 y2 vx vy radius width depth angle c decay pierce bucket limit delay done sensor transport chain triggerAt half start out back center links linkCount next first travel distance phase returnSpeed blast'.split(' '));
const paramKeys='damage rate size reach length aim hop multishot pierce crit critMult frost repulsion'.split(' ');
const tag=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,60}$/.test(v);
const finite=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
function effect(raw){
  if(!raw||!types.has(raw.type)||!finite(raw.age,0,5)||!finite(raw.life,.001,5)||!finite(raw.x,-1e7,1e7)||!finite(raw.y,-1e7,1e7)||!raw.p||!paramKeys.every(k=>finite(raw.p[k],0,k==='damage'?1e7:1000)))return null;
  const e={};for(const [k,v]of Object.entries(raw))if(fields.has(k)&&(typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e7||tag(v)))e[k]=v;
  e.p=Object.fromEntries(paramKeys.map(k=>[k,raw.p[k]]));e.hit=Array.isArray(raw.hit)?raw.hit.filter(v=>Number.isInteger(v)||typeof v==='string'&&/^\d+:(0|1|out|back)$/.test(v)).slice(0,660):[];
  const required={bolt:['vx','vy','radius','c','decay','pierce'],rect:['angle','width','depth','delay','c'],blast:['delay','radius','c','sx','sy'],mine:['delay','radius','sensor','c','sx','sy','transport'],ring:['half','radius','width','start','out','back','linkCount'],zone:['radius','next'],trail:['x2','y2','width'],lance:['vx','vy','radius','delay','travel','distance','c','back','returnSpeed']}[e.type];
  if(!required.every(k=>Number.isFinite(e[k]))||!tag(e.group)||!tag(e.channel))return null;
  if(['rect','mine','lance'].includes(e.type)&&!tag(e.bucket))return null;
  if(e.type==='lance'&&!['out','back'].includes(e.phase)||e.type==='ring'&&e.half<=0||e.type==='zone'&&e.next<0)return null;
  if(e.type==='bolt'&&(e.decay<0||e.decay>1))return null;
  if(['radius','width','depth','half','distance','returnSpeed'].some(k=>k in e&&e[k]<=0)||['c','back','out','delay','transport','sensor','pierce','travel','linkCount','limit','next'].some(k=>k in e&&e[k]<0))return null;
  return e;
}
export function restoreFusions(r,raw){
  r.fusionStates={};r.fusionTrail=[];r.fusionRemainder=finite(raw.fusionRemainder,0,1/120)?raw.fusionRemainder:0;
  for(const f of activeFusions(r)){
    const v=raw.fusionStates?.[f.id];if(!v||v.version!==2||v.phase!=='active')continue;
    const q=makeFusionRuntime(f.id);q.age=finite(v.age,0,r.time+1)?v.age:0;q.remainder=finite(v.remainder,0,1/120)?v.remainder:0;q.clock=finite(v.clock,0,10)?v.clock:0;q.sequence=finite(v.sequence,0,1e9)?Math.floor(v.sequence):0;
    for(const [k,n]of Object.entries(v.clocks||{}))if(/^(main|rift|gun[01]|wall|upper[01]?|upper-lightning|upper-wave|upper-cut)$/.test(k)&&finite(n,0,q.age+10))q.clocks[k]=n;
    q.hits=(Array.isArray(v.hits)?v.hits:[]).slice(0,12000).filter(h=>h&&Number.isInteger(h.id)&&tag(h.tag)&&finite(h.at,Math.max(0,q.age-6),q.age+1)&&finite(h.count,1,1000)).map(h=>({id:h.id,tag:h.tag,at:Math.min(h.at,q.age),count:Math.floor(h.count),cycleIndex:finite(h.cycleIndex,0,1e9)?Math.floor(h.cycleIndex):0}));
    q.baseTargets=(Array.isArray(v.baseTargets)?v.baseTargets:[]).filter(Number.isInteger).slice(0,4);
    q.recent=(Array.isArray(v.recent)?v.recent:[]).filter(Number.isInteger).slice(-2);
    q.units=(Array.isArray(v.units)?v.units:[]).slice(0,6).map(u=>u&&finite(u.x,-1e7,1e7)&&finite(u.y,-1e7,1e7)?{x:u.x,y:u.y,angle:Number.isFinite(u.angle)?u.angle:0,trailX:Number.isFinite(u.trailX)?u.trailX:u.x,trailY:Number.isFinite(u.trailY)?u.trailY:u.y,lastTarget:Number.isInteger(u.lastTarget)?u.lastTarget:0,lastFire:Number.isFinite(u.lastFire)?u.lastFire:-10}:null);
    q.effects=(Array.isArray(v.effects)?v.effects:[]).slice(0,200).map(effect).filter(Boolean);for(const key of ['base-slash','upper-slash']){const m=v.slashes?.[key];if(m)q.slashes[key]={index:finite(m.index,0,1e9)?Math.floor(m.index):0,recent:(Array.isArray(m.recent)?m.recent:[]).filter(Number.isInteger).slice(-2)};}
    q.angle=Number.isFinite(v.angle)?v.angle:0;r.fusionStates[f.id]=q;
  }
  r.fusionPushHits=(Array.isArray(raw.fusionPushHits)?raw.fusionPushHits:[]).slice(0,240).filter(h=>h&&Number.isInteger(h.id)&&finite(h.at,Math.max(0,r.time-.8),r.time)).map(h=>({id:h.id,at:h.at}));
}
