import { makeJourney } from '../core/run.js';
import { n, integer } from '../core/utils.js';
import { episodeKinds, anomalies, sites, legacies, echoes, fronts, objectives, relics, signals } from '../data/world.js';
import { keystones } from '../data/progression.js';
import { HARVEST_CAP, RUN_END, W, H } from '../core/config.js';
import { relicChoices } from '../world/effects.js';

export function restoreJourney(raw,time) {
  if(!raw||!Array.isArray(raw.plan)||raw.plan.length!==4)return null;
  const j=makeJourney(raw.plan.map((x,i)=>({slot:i,at:n(x?.at,[450,840,1200,1590][i], [435,825,1185,1575][i],[465,855,1215,1605][i]),kind:i===0?'witness':i===2?'guardian':episodeKinds.includes(x?.kind)?x.kind:'relay'})));
  j.step=integer(raw.step,0,0,4);
  j.outcomes=Array.isArray(raw.outcomes)?raw.outcomes.filter((x,i,a)=>x&&Number.isInteger(x.slot)&&x.slot>=0&&x.slot<j.step&&a.findIndex(y=>y?.slot===x.slot)===i&&episodeKinds.includes(x.kind)).slice(0,4).map(x=>({slot:x.slot,kind:x.kind,success:x.success===true})):[];
  j.keystone=keystones.some(x=>x.id===raw.keystone)?raw.keystone:null;
  j.keystonePending=!j.keystone&&raw.keystonePending===true;
  const a=raw.active;
  if(a&&a.slot===j.step&&episodeKinds.includes(a.kind)) j.active={slot:j.step,kind:a.kind,x:n(a.x),y:n(a.y),baseX:n(a.baseX),baseY:n(a.baseY),start:n(a.start,time,0,time),until:n(a.until,time,0,time+85),reinforce:n(a.reinforce,time,0,time+7),charge:n(a.charge,0,0,14),gate:integer(a.gate,0,0,2),targetId:integer(a.targetId),targetDead:a.targetDead===true};
  const c=raw.core;
  if(c&&[0,1].includes(c.phase)) { j.core={phase:c.phase,cycle:integer(c.cycle),next:n(c.next,time,0,time+5),attack:null,power:n(c.power,0,0,1e6),nodeHp:n(c.nodeHp,1500,300,4000)}; const a=c.attack;
    if(a&&['cross','ring','sweep'].includes(a.kind)) j.core.attack={kind:a.kind,x:n(a.x),y:n(a.y),angle:n(a.angle,0,-100,100),turn:n(a.turn,0,-Math.PI/2,Math.PI/2),length:n(a.length,400,200,450),width:n(a.width,24,16,30),fireAt:n(a.fireAt,time,0,time+3),endAt:n(a.endAt,time,0,time+4)};
  }
  return j;
}

export function restoreWorld(r,raw,_profile){
  r.anomalyStep = integer(raw.anomalyStep, 0, 0, anomalies.length);
  r.anomalyPending = raw.anomalyPending === true && r.anomalyStep < anomalies.length;
  r.anomalyChoices = {}; r.anomalyUntil = {};
  for (const event of anomalies) {
    const choice = event.options.find(x => x.id === raw.anomalyChoices?.[event.id]);
    if (choice) r.anomalyChoices[event.id] = choice.id;
    if (event.id !== 'echo') r.anomalyUntil[event.id] = n(raw.anomalyUntil?.[event.id], 0, 0, 1e7);
  }
  r.anomalyWardAt = n(raw.anomalyWardAt, 0, 0, 1e7);
  r.siteDecisions = {}; for (const site of sites) if (site.options.some(o => o.id === raw.siteDecisions?.[site.id])) r.siteDecisions[site.id] = raw.siteDecisions[site.id];
  r.legacyOrigin = Object.hasOwn(legacies, raw.legacyOrigin) ? raw.legacyOrigin : null;
  const savedLegacy = legacies[r.legacyOrigin]; r.legacyChoice = savedLegacy && [...savedLegacy.options.map(x => x.id), 'silent'].includes(raw.legacyChoice) ? raw.legacyChoice : null;
  r.legacySite = savedLegacy && !r.legacyChoice && raw.legacySite && Number.isFinite(raw.legacySite.x) && Number.isFinite(raw.legacySite.y) ? { x: n(raw.legacySite.x, 0, -1e7, 1e7), y: n(raw.legacySite.y, 0, -1e7, 1e7) } : null;
  r.legacyPending = !!r.legacySite && raw.legacyPending === true;
  r.echoSeed = {}; for (const e of echoes) r.echoSeed[e.id] = Object.hasOwn(e.line, raw.echoSeed?.[e.id]) ? raw.echoSeed[e.id] : '';
  r.echoOutcomes = {}; for (const e of echoes) if (['keep','use','silent'].includes(raw.echoOutcomes?.[e.id])) r.echoOutcomes[e.id] = raw.echoOutcomes[e.id];
  r.echoStep = integer(raw.echoStep, 0, 0, echoes.length);
  const echo = echoes[r.echoStep], spot = raw.echoSite;
  if (echo && spot?.id === echo.id && r.echoSeed[echo.id] && Number.isFinite(spot.x) && Number.isFinite(spot.y) && !r.echoOutcomes[echo.id]) r.echoSite = { id: echo.id, x: n(spot.x, 0, -1e7, 1e7), y: n(spot.y, 0, -1e7, 1e7) };
  r.echoPending = !!r.echoSite && raw.echoPending === true;
  r.frontChoices = {}; for (const f of fronts) if ([...f.paths.map(p => p.id), 'silent'].includes(raw.frontChoices?.[f.id])) r.frontChoices[f.id] = raw.frontChoices[f.id];
  r.frontStep = integer(raw.frontStep, 0, 0, fronts.length);
  const frontDef = fronts[r.frontStep], oldFront = raw.front;
  if (frontDef && !r.frontChoices[frontDef.id] && oldFront?.id === frontDef.id && Number.isFinite(oldFront.x) && Number.isFinite(oldFront.y)) {
    r.front = { id: frontDef.id, x: n(oldFront.x, 0, -1e7, 1e7), y: n(oldFront.y, 0, -1e7, 1e7) };
  }
  r.objectiveOutcomes = {}; for (const task of objectives) if (['complete','failed','ignored'].includes(raw.objectiveOutcomes?.[task.id])) r.objectiveOutcomes[task.id] = raw.objectiveOutcomes[task.id];
  r.guardianFate = { spare: integer(raw.guardianFate?.spare,0,0,1000), end: integer(raw.guardianFate?.end,0,0,1000) }; r.guardianOrder = ['spare','end'].includes(raw.guardianOrder) ? raw.guardianOrder : '';
  r.objectiveStep = integer(raw.objectiveStep, 0, 0, objectives.length);
  const savedObjective = raw.objective, task = objectives[r.objectiveStep];
  if (task && savedObjective?.id === task.id && Number.isFinite(savedObjective.x) && Number.isFinite(savedObjective.y)) r.objective = {
    id: task.id, x: n(savedObjective.x, 0, -1e7, 1e7), y: n(savedObjective.y, 0, -1e7, 1e7), phase: integer(savedObjective.phase, 0, 0, 1),
    progress: n(savedObjective.progress, 0, 0, 16), left: n(savedObjective.left, 0, 0, 120), targetId: integer(savedObjective.targetId), reinforceAt: n(savedObjective.reinforceAt, 0, 0, 1e7)
  };
  r.siteStep = integer(raw.siteStep, 0, 0, sites.length);
  const siteDef = sites[r.siteStep];
  if (siteDef && raw.site?.id === siteDef.id && Number.isFinite(raw.site.x) && Number.isFinite(raw.site.y)) {
    r.site = { id: siteDef.id, x: n(raw.site.x, 0, -1e7, 1e7), y: n(raw.site.y, 0, -1e7, 1e7) };
    r.sitePending = raw.sitePending === true;
  }

  r.relics = Array.isArray(raw.relics) ? [...new Set(raw.relics.filter(id => relics.some(item => item.id === id)))].slice(0, 3) : [];
  r.relicPending = relicChoices(raw.relicPending).length && sites.slice(0, r.siteStep).some(site => site.id === raw.relicPending) && !r.relics.some(id => relicChoices(raw.relicPending).some(item => item.id === id)) ? raw.relicPending : null;
  r.relicCooldown = n(raw.relicCooldown, 0, 0, 1e7); r.relicFreezeUntil = n(raw.relicFreezeUntil, 0, 0, 1e7);
  r.harvestBudget = n(raw.harvestBudget, HARVEST_CAP, 0, HARVEST_CAP);
  r.bossChoiceId = integer(raw.bossChoiceId, 0, 0, 1e9);
  r.finalStep = r.time >= RUN_END ? integer(raw.finalStep, 0, 0, 3) : 0;
  r.signalStep = integer(raw.signalStep, 0, 0, signals.length); r.signalHp = integer(raw.signalHp, 0, 0, 60); r.signalPower = integer(raw.signalPower, 0, 0, 3); r.signalChoices = Array.isArray(raw.signalChoices) ? raw.signalChoices.slice(0,r.signalStep).filter(x=>x==='hear'||x==='burn') : [];
  r.logs = Array.isArray(raw.logs) ? raw.logs.filter(x => typeof x === 'string').slice(-6).map(x => x.slice(0, 110)) : [];
  const npc = raw.npc;
  if (npc && typeof npc === 'object' && ['none', 'waiting', 'heard', 'taken'].includes(npc.state)) {
    r.npc = { spawned: !!npc.spawned, state: npc.state, x: n(npc.x, W / 2, -1e7, 1e7), y: n(npc.y, H / 2, -1e7, 1e7), still: n(npc.still, 0, 0, 4.5), encounterPending: !!npc.encounterPending && npc.state === 'waiting', secretPending: !!npc.secretPending && npc.state === 'heard' && !npc.silenced, silenced: !!npc.silenced && npc.state === 'heard' };
  }
}
