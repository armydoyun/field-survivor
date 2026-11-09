import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRun } from '../src/core/run.js';
import { initialProfile } from '../src/core/profile.js';
import { createStatistics } from '../src/core/statistics.js';
import { makeRandomState } from '../src/core/random.js';
import { createSpecializations } from '../src/combat/specializations.js';
import { createGrowthMetrics } from '../src/ui/growth-metrics.js';
import { branches } from '../src/data/specializations.js';
import { specRules, specTiming, specRiftWidth, specBeaconRadius, specBeaconInterval } from '../src/combat/weapon-parameters.js';

export function specializationTrace(api,id,option,level){
  const profile=api.initialProfile(),run=api.createRun(profile,{maxHp:100,xpNext:28}),sessionState={profile,run},view={mode:'playing'},hits=[],windows=[];
  run.rng=api.makeRandomState(371);run.up[id]=level;run.branches[id]=option;
  for(const passive of ['power','wavecraft','conduction','placement','edgecraft','machinery','repulsion','multishot','pierce','crit','frost'])run.up[passive]=2;
  run.enemies=Array.from({length:6},(_,i)=>({id:i+1,kind:0,x:run.player.x+45+i*35,y:run.player.y+(i%2?20:-20),hp:1e9,maxHp:1e9,radius:11}));
  const statistics=api.createStatistics({sessionState}),metrics=api.createGrowthMetrics({sessionState,statistics,buildModel:{}}),feedback={markSkillAttack(){},ring(){},addSkillEcho(){},retireSkillField(f){f.life=0;}},combat={damage(e,amount){hits.push([e.id,amount]);}},inspector={band(){},circle(){},rect(){},segment(){},hitWindow(...args){windows.push(args.slice(0,5).concat(args.at(-1)));}};
  const skills=api.createSpecializations({sessionState,view,statistics,feedback,combat,inspector}),hash=createHash('sha256'),phases=new Set(),rows=[];
  for(let frame=0;frame<1200;frame++){
    const dt=frame%3===0?.02:.015;run.time+=dt;run.player.x+=Math.sin(frame*.03)*.3;run.player.y+=Math.cos(frame*.02)*.2;
    skills.specializationTick(dt,statistics.stats());
    for(const q of [...Object.values(run.arsenal.states),...run.arsenal.fields])if(q.phase)phases.add(q.phase);
    hash.update(JSON.stringify([run.time,run.player,run.arsenal,run.shots,run.rng,hits,windows]));hits.length=0;windows.length=0;
    if(frame%300===0)rows.push(metrics.specialWeaponRow(id.toUpperCase(),statistics.stats()));
    // Projectile movement is outside the specialization owner; keep its queue bounded for repeated volleys.
    run.shots=[];
  }
  return {hash:hash.digest('hex'),phases:[...phases].sort(),rows};
}

const api={createRun,initialProfile,createStatistics,makeRandomState,createSpecializations,createGrowthMetrics};
const baseline=JSON.parse(readFileSync(new URL('baseline-specializations.json',import.meta.url),'utf8'));
for(const weapon of branches)for(const option of weapon.options)test(`${weapon.id}:${option.id} retains v2.6.21 attacks, hit windows, RNG, states and descriptions at levels 3 and 5`,()=>{
  for(const level of [3,5])assert.deepEqual(specializationTrace(api,weapon.id,option.id,level),baseline[`${weapon.id}:${option.id}:${level}`]);
});
test('specialization rules are deeply frozen and remain outside per-run state',()=>{
  assert.ok(Object.isFrozen(specRules));assert.equal(Object.keys(specRules).length,8);
  for(const rules of Object.values(specRules)){assert.ok(Object.isFrozen(rules));for(const value of Object.values(rules))assert.ok(Number.isFinite(value)&&value>0);}
  assert.throws(()=>{specRules.nova.expand=99;},TypeError);
  const run=createRun(initialProfile(),{maxHp:100,xpNext:28});assert.ok(!('specRules' in run));
});
test('shared specialized dimensions and artillery cycle match execution at minimum and maximum machinery',()=>{
  for(const wavecraft of [0,2,4])assert.deepEqual([specRiftWidth({wavecraft}),specRiftWidth({wavecraft},true),specBeaconRadius({wavecraft})],[18+wavecraft*2,72+wavecraft*4,55+wavecraft*4]);
  for(const machinery of [0,4])for(const beacon of [3,5]){
    const s={machinery,beacon},shot=Math.max(.8,1.8-beacon*.17)*(1-machinery*.09),cycle=Math.max(specRules.beacon.minRest,shot-(specTiming.beaconAim+specTiming.beaconFlight))+(specTiming.beaconAim+specTiming.beaconFlight);
    assert.equal(specBeaconInterval(s),cycle);assert.equal(specBeaconInterval(s).toFixed(2),Math.max(.79,shot).toFixed(2));
  }
});
test('editing the shared rules propagates to actual simulation, live metrics and catalog descriptions',()=>{
  const directory=mkdtempSync(join(tmpdir(),'field-survivor-parameters-'));
  try{
    cpSync(new URL('../src',import.meta.url),join(directory,'src'),{recursive:true});writeFileSync(join(directory,'package.json'),'{"type":"module"}');
    const file=join(directory,'src/combat/weapon-parameters.js');let code=readFileSync(file,'utf8');
    for(const [before,after]of [['nova:{expand:.85','nova:{expand:.425'],['loop:.3,gap:.4,cap:3','loop:.3,gap:.8,cap:2'],['first:1.2,follow:.9','first:1.2,follow:.6']]){assert.ok(code.includes(before));code=code.replace(before,after);}writeFileSync(file,code);
    const base=pathToFileURL(directory+'/').href,script=`import {createHash} from 'node:crypto';
      const api=Object.assign({},...await Promise.all(['core/run','core/profile','core/statistics','core/random','combat/specializations','ui/growth-metrics','data/specializations'].map(p=>import(${JSON.stringify(base)}+'src/'+p+'.js'))));
      ${specializationTrace.toString()}
      console.log(JSON.stringify({traces:[['nova','boundary'],['chain','circuit'],['rift','trail']].map(([id,option])=>specializationTrace(api,id,option,3)),branches:api.branches}));`;
    const changed=JSON.parse(execFileSync(process.execPath,['--input-type=module','--eval',script],{encoding:'utf8',maxBuffer:1e6}));
    for(const [i,key]of ['nova:boundary:3','chain:circuit:3','rift:trail:3'].entries())assert.notEqual(changed.traces[i].hash,baseline[key].hash,key+' simulation must change');
    const desc=(id,option)=>changed.branches.find(w=>w.id===id).options.find(o=>o.id===option).desc;
    assert.ok(desc('nova','boundary').includes('확장 ×0.425'));assert.ok(desc('chain','circuit').includes('0.8초 간격 최대 2회'));assert.ok(desc('rift','trail').includes('후속 각 ×0.6'));
    assert.ok(changed.traces[1].rows[0][2].includes('0.8초 간격 최대 2회'));assert.ok(changed.traces[0].rows[0][2].includes('확장 11.9'));assert.ok(changed.traces[2].rows[0][2].includes('후속 각 17.9'));
  }finally{rmSync(directory,{recursive:true,force:true});}
});
