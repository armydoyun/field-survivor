import { restoreFusions } from './restore-fusions.js';
import { makeArsenal } from '../core/run.js';
import { n, clamp, integer } from '../core/utils.js';
import { upgrades } from '../data/upgrades.js';
import { branches } from '../data/specializations.js';
import { refreshBuild, weaponConsumed } from '../growth/build.js';

export function restoreLoadout(r,raw){
  r.up = {}; for (const def of upgrades) r.up[def.id] = integer(raw.up?.[def.id], 0, 0, def.max);
  r.branches = {}; for (const b of branches) if (r.up[b.id] >= 3 && b.options.some(o => o.id === raw.branches?.[b.id])) r.branches[b.id] = raw.branches[b.id];
  r.beacons = (Array.isArray(raw.beacons) ? raw.beacons : []).slice(0, 2).filter(b => b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.life)).map(b => ({ x: n(b.x, 0, -1e7, 1e7), y: n(b.y, 0, -1e7, 1e7), life: n(b.life, 1, 0, 11), clock: n(b.clock, .3, 0, 3), lastTargetId: integer(b.lastTargetId) }));
  r.mines = (Array.isArray(raw.mines) ? raw.mines : []).slice(0, 8).filter(m => m && Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.life)).map(m => ({ x: n(m.x, 0, -1e7, 1e7), y: n(m.y, 0, -1e7, 1e7), life: n(m.life, 1, 0.01, 12) }));
  refreshBuild(r);if(weaponConsumed('mine',r))r.mines=[];if(weaponConsumed('beacon',r))r.beacons=[];
}

function restoreArsenal(raw,r){
  const a=makeArsenal();if(raw?.version!==1)return a;
  const names=new Set('clock phase left target angle charge points units x y x1 y1 x2 y2 dx dy age life delay stage id at count radius length width damage pierce hit backHit marks seen loaded occupied tx ty sx sy index lastTarget cycle guard vx vy type owner aimAngle orbitPhase born heading deployTime moveTime'.split(' '));
  const words=new Set('wait aim burst charge release orbit out back stay expand hold return forward reverse loop arm pressed jump record open prepare fold observe flight shoot pack move deploy'.split(' ').concat(branches.map(b=>b.id)));
  function clean(v,depth=0){if(depth>6)return null;if(typeof v==='number')return Number.isFinite(v)?clamp(v,-1e7,1e7):0;if(typeof v==='boolean')return v;if(typeof v==='string')return words.has(v)?v:'';if(Array.isArray(v))return v.slice(0,200).map(x=>clean(x,depth+1)).filter(x=>x!==null);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v))if(names.has(k))o[k]=clean(v[k],depth+1);return o;}return null;}
  for(const b of branches)if(!weaponConsumed(b.id,r)&&r.branches[b.id]&&raw.states?.[b.id]&&typeof raw.states[b.id]==='object'){const state=clean(raw.states[b.id]);for(const k of ['angle','aimAngle','deployTime'])if(state[k]!=null&&!Number.isFinite(state[k]))delete state[k];if(Number.isFinite(state.clock)&&state.clock>=0&&state.clock<=30){if(state.units&&!Array.isArray(state.units))state.units=[];if(state.units)state.units=state.units.filter(u=>u&&Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.clock)).slice(0,b.id==='orbit'?5:2);if(state.points)state.points=Array.isArray(state.points)?state.points.slice(0,12):[];for(const u of state.units||[]){for(const k of ['orbitPhase','born','heading','moveTime'])if(u[k]!=null&&!Number.isFinite(u[k]))delete u[k];if(Number.isFinite(u.born))u.born=clamp(u.born,0,r.time);if(b.id==='orbit'&&r.branches.orbit==='escort'&&u.phase==='out'&&(!Number.isFinite(u.dx)||!Number.isFinite(u.dy)))u.phase='orbit';if(b.id==='beacon'&&u.phase==='move'&&![u.sx,u.sy,u.tx,u.ty].every(Number.isFinite)){u.phase='shoot';u.left=4;u.clock=0;}}if(b.id==='beacon'&&['prepare','flight'].includes(state.phase)&&![state.tx,state.ty].every(Number.isFinite)){state.phase='observe';state.clock=0;}a.states[b.id]=state;}}
  a.fields=(Array.isArray(raw.fields)?raw.fields:[]).slice(0,40).map(f=>clean(f)).filter(f=>f&&!weaponConsumed(f.owner,r)&&r.branches[f.owner]&&['nova','chain','lance','mine','rift'].includes(f.type)&&Number.isFinite(f.x)&&Number.isFinite(f.y)&&Number.isFinite(f.age)&&Number.isFinite(f.life)&&f.life>0&&f.life<=20);a.fields=a.fields.filter(f=>f.type==='nova'?Number.isFinite(f.radius)&&f.radius>0:f.type==='lance'?[f.dx,f.dy,f.x1,f.y1,f.count,f.pierce].every(Number.isFinite):f.type==='rift'?[f.angle,f.length,f.width].every(Number.isFinite):f.type==='mine'&&f.phase==='jump'?[f.sx,f.sy,f.tx,f.ty,f.loaded].every(Number.isFinite):true);for(const f of a.fields){f.points=Array.isArray(f.points)?f.points.filter(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)):[];f.hit=Array.isArray(f.hit)?f.hit:[];f.backHit=Array.isArray(f.backHit)?f.backHit:[];f.marks=Array.isArray(f.marks)?f.marks:[];f.points=f.points.slice(0,12);f.seen=Array.isArray(f.seen)?f.seen:[];}
  a.tracks=(Array.isArray(raw.tracks)?raw.tracks:[]).slice(0,180).map(t=>clean(t)).filter(t=>t&&Number.isFinite(t.id)&&Number.isFinite(t.x)&&Number.isFinite(t.y));return a;
}

export function restoreWeaponStates(r,raw){
  r.arsenal=restoreArsenal(raw.arsenal,r);restoreFusions(r,raw);
}
