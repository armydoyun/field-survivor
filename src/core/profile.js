import { fusionRecipes } from '../data/fusions.js';
import { retiredFusionIds } from '../save/retired-fusions.js';
import { shopItems } from '../data/shop.js';
import { legacies, fronts, echoes, objectives, sites, anomalies, relics, finalEndings } from '../data/world.js';

import { n, integer } from './utils.js';

const legacyDefault = () => Object.fromEntries(Object.entries(legacies).map(([id, x]) => [id, { [x.options[0].id]: 0, [x.options[1].id]: 0, silent: 0 }]));

const frontDefault = () => Object.fromEntries(fronts.map(f => [f.id, { [f.paths[0].id]: 0, [f.paths[1].id]: 0, silent: 0 }]));

const echoDefault = () => Object.fromEntries(echoes.map(e => [e.id, { keep: 0, use: 0, silent: 0 }]));

const objectiveDefault = () => Object.fromEntries(objectives.map(o => [o.id, { complete: 0, failed: 0, ignored: 0 }]));

const siteDefault = () => Object.fromEntries(sites.map(site => [site.id, { keep: 0, take: 0 }]));

const anomalyDefault = () => ({ clock: { hold: 0, rush: 0 }, border: { ward: 0, harvest: 0 }, echo: { keep: 0, erase: 0 } });

const initialProfile = () => ({ gold: 0, perks: Object.fromEntries(shopItems.map(item => [item.id, 0])), bestTime: 0, bestKills: 0, runs: 0, memory: { heard: 0, burned: 0, archive: [],fusions:{}, witness: initialWitness(), guardian: { spared: 0, ended: 0 }, anomalies: anomalyDefault(), sites: siteDefault(), objectives: objectiveDefault(), relics: {}, endings: initialEndings(), echoes: echoDefault(), fronts: frontDefault(), legacies: legacyDefault(), lastResolution: null } });

const initialEndings = () => Object.fromEntries(finalEndings.map(e => [e.id, 0]));

const initialWitness = () => ({ met: 0, heard: 0, taken: 0, quiet: false });

function hydrateProfile(profile, p) {
  profile.gold = integer(p.gold); profile.bestTime = n(p.bestTime, 0, 0, 1e7); profile.bestKills = integer(p.bestKills); profile.runs = integer(p.runs);
  for (const item of shopItems) profile.perks[item.id] = integer(p.perks?.[item.id], 0, 0, item.max);
  profile.memory.heard = integer(p.memory?.heard, 0, 0, 10000); profile.memory.burned = integer(p.memory?.burned, 0, 0, 10000);
  profile.memory.archive = Array.isArray(p.memory?.archive) ? p.memory.archive.filter(x => typeof x === 'string').slice(-8).map(x => x.slice(0, 110)) : [];
  // v2.6.27 이전의 신호 챕터(memory.chapters)는 최종 결말과 이름이 겹쳐 폐지했다. 저장값은 읽지 않는다.
  const witness = p.memory?.witness; if (witness && typeof witness === 'object') profile.memory.witness = { met: integer(witness.met, 0, 0, 99999), heard: integer(witness.heard, 0, 0, 99999), taken: integer(witness.taken, 0, 0, 99999), quiet: witness.quiet === true };
  const guardian = p.memory?.guardian; if (guardian && typeof guardian === 'object') profile.memory.guardian = { spared: integer(guardian.spared, 0, 0, 99999), ended: integer(guardian.ended, 0, 0, 99999) };
  const savedSites = p.memory?.sites;
  if (savedSites && typeof savedSites === 'object') for (const site of sites) for (const option of site.options) {
    profile.memory.sites[site.id][option.id] = integer(savedSites[site.id]?.[option.id], 0, 0, 99999);
  }
  for (const objective of objectives) for (const result of ['complete', 'failed', 'ignored']) profile.memory.objectives[objective.id][result] = integer(p.memory?.objectives?.[objective.id]?.[result], 0, 0, 99999);
  for (const e of echoes) for (const result of ['keep','use','silent']) profile.memory.echoes[e.id][result] = integer(p.memory?.echoes?.[e.id]?.[result], 0, 0, 99999);
  for (const f of fronts) for (const result of [...f.paths.map(x => x.id), 'silent']) profile.memory.fronts[f.id][result] = integer(p.memory?.fronts?.[f.id]?.[result], 0, 0, 99999);
  for (const [id, legacy] of Object.entries(legacies)) for (const result of [...legacy.options.map(x => x.id), 'silent']) profile.memory.legacies[id][result] = integer(p.memory?.legacies?.[id]?.[result], 0, 0, 99999);
  const savedRelics = p.memory?.relics;
  if (savedRelics && typeof savedRelics === 'object') for (const relic of relics) profile.memory.relics[relic.id] = integer(savedRelics[relic.id], 0, 0, 99999);
  const savedEndings = p.memory?.endings; if (savedEndings && typeof savedEndings === 'object') for (const ending of finalEndings) profile.memory.endings[ending.id] = integer(savedEndings[ending.id], 0, 0, 99999);
  const savedResolution = p.memory?.lastResolution; profile.memory.lastResolution = savedResolution && finalEndings.some(e => e.id === savedResolution.ending) && Array.isArray(savedResolution.threads) ? { ending: savedResolution.ending, scenes: Array.isArray(savedResolution.scenes) ? savedResolution.scenes.filter(t=>typeof t==='string').slice(0,3).map(t=>t.slice(0,300)) : [], threads: savedResolution.threads.filter(t => typeof t === 'string').slice(0, 40).map(t => t.slice(0, 180)) } : null;
  const savedAnomalies = p.memory?.anomalies;
  if (savedAnomalies && typeof savedAnomalies === 'object') for (const event of anomalies) for (const choice of event.options) {
    profile.memory.anomalies[event.id][choice.id] = integer(savedAnomalies[event.id]?.[choice.id], 0, 0, 99999);
  }
  profile.memory.fusions={};for(const id of [...retiredFusionIds,...fusionRecipes.map(f=>f.id)]){const count=integer(p.memory?.fusions?.[id],0,0,99999);if(count)profile.memory.fusions[id]=count;}
  return profile;
}

function appendRecord(profile, run, line) { run.logs.push(line); run.logs = run.logs.slice(-6); profile.memory.archive.push(line); profile.memory.archive = profile.memory.archive.slice(-8); }

export { initialProfile, hydrateProfile, appendRecord };

export function hasRecords(profile, run) { return !!run || profile.runs > 0 || profile.gold > 0 || profile.bestTime > 0 || profile.bestKills > 0 || Object.values(profile.perks).some(Boolean) || JSON.stringify(profile.memory) !== JSON.stringify(initialProfile().memory); }
