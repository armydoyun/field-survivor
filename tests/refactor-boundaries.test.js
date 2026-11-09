import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialProfile } from '../src/core/profile.js';
import { createRun } from '../src/core/run.js';
import { commitRunStart, commitRunResult } from '../src/core/run-lifecycle.js';

function state(){const s={profile:initialProfile(),run:null,replaceRun(r){s.run=r;}};return s;}
test('starting a run owns replacement and run counting without touching another session or banking old gold',()=>{
  const s=state(),other=state(),r=createRun(s.profile,{maxHp:100,xpNext:28}),old=createRun(s.profile,{maxHp:100,xpNext:28});old.gold=500;s.run=old;
  const otherBefore=structuredClone({profile:other.profile,run:other.run});assert.equal(commitRunStart(s,r),true);assert.equal(s.run,r);assert.equal(s.profile.runs,1);assert.equal(s.profile.gold,0);assert.equal(old.gold,500);assert.deepEqual({profile:other.profile,run:other.run},otherBefore);
});
test('invalid run start and repeated completion do not partially commit or bank the result twice',()=>{
  const s=state(),before=structuredClone(s.profile);assert.equal(commitRunStart(s,null),false);assert.equal(commitRunResult(s),null);assert.deepEqual(s.profile,before);
  const r=createRun(s.profile,{maxHp:100,xpNext:28});Object.assign(r,{time:315,kills:23,gold:90,level:9});commitRunStart(s,r);
  const result=commitRunResult(s);assert.deepEqual(result,{time:315,kills:23,gold:90,level:9});assert.equal(s.run,null);assert.equal(s.profile.gold,90);assert.equal(s.profile.bestTime,315);assert.equal(s.profile.bestKills,23);assert.equal(s.profile.runs,1);
  assert.equal(commitRunResult(s,result),null);assert.equal(s.profile.gold,90);assert.equal(r.gold,90);
});
test('ending completion banks its explicit reward and preserves metadata and existing best records',()=>{
  const s=state();s.profile.gold=10;s.profile.bestTime=900;s.profile.bestKills=80;const r=createRun(s.profile,{maxHp:100,xpNext:28});Object.assign(r,{time:400,kills:50,gold:30});commitRunStart(s,r);
  const ending={time:400,kills:50,gold:330,level:8,ending:'test',endingId:'preserve',threads:['a'],scenes:['b']};assert.equal(commitRunResult(s,ending),ending);assert.equal(s.profile.gold,340);assert.equal(s.profile.bestTime,900);assert.equal(s.profile.bestKills,80);assert.equal(s.run,null);assert.deepEqual(ending.threads,['a']);
});
test('application composition directly constructs complete services and has no mutable service placeholders',()=>{
  const code=readFileSync(new URL('../src/app/create-game.js',import.meta.url),'utf8');assert.doesNotMatch(code,/Object\.assign\s*\(/);assert.doesNotMatch(code,/\b(?:storage|session|combat|feedback|screen|enemyRuntime|weaponView)\s*=\s*\{\s*\}/);
  for(const name of ['storage','session','combat','feedback','screen','enemyRuntime','weaponView'])assert.match(code,new RegExp('const '+name+' = create'));
  assert.ok(code.indexOf('const events =')<code.indexOf('events.bindEvents()'));assert.ok(code.indexOf('const enemyRuntime =')<code.indexOf('storage.load()'));
});

