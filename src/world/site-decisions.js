import { siteRewards } from '../data/world-choices.js';
import { sites, relics } from '../data/world.js';
import { upgrades } from '../data/upgrades.js';
import { relicChoices, hasRelic } from './effects.js';
import { ENEMY_LIMIT } from '../core/config.js';
import { appendRecord } from '../core/profile.js';

// Apply choices without presentation or persistence. Reject before any mutation.
export function createSiteDecisions({ sessionState, statistics, progression, enemyRuntime }) {
  const record = line => appendRecord(sessionState.profile,sessionState.run,line);
  function chooseSite(choice) {
    if (!sessionState.run?.sitePending || !['keep', 'take'].includes(choice)) return null;
    const site = sites[sessionState.run.siteStep], p = sessionState.run.player;
    if (!site || sessionState.run.site?.id !== site.id || sessionState.run.relicPending || sessionState.run.relics.some(id => relicChoices(site.id).some(item => item.id === id))) return null;
    // Commit exactly once before awarding or spawning anything.
    const reward=siteRewards[site.id][choice];
    sessionState.run.sitePending = false; sessionState.run.site = null; sessionState.run.siteStep++;
    sessionState.profile.memory.sites[site.id][choice]++; sessionState.run.siteDecisions[site.id] = choice;
    if (site.id === 'coordinate') { sessionState.run.gold += reward.gold; progression.collect(reward.xp); }
    if (site.id === 'reservoir') {
      if (choice === 'keep') { p.hp = Math.min(statistics.stats().maxHp, p.hp + reward.heal); progression.collect(reward.xp); }
      else { p.hp = Math.max(1, p.hp - reward.hpCost); sessionState.run.up.power = Math.min(upgrades.find(x => x.id === 'power').max, (sessionState.run.up.power || 0) + reward.power); }
    }
    if (site.id === 'archive') {
      if (choice === 'keep') { sessionState.run.gold += reward.gold; sessionState.run.up.vitality = Math.min(upgrades.find(x => x.id === 'vitality').max, (sessionState.run.up.vitality || 0) + reward.vitality); p.hp = Math.min(statistics.stats().maxHp, p.hp + reward.heal); }
      else { sessionState.run.up.haste = Math.min(upgrades.find(x=>x.id==='haste').max, (sessionState.run.up.haste || 0) + reward.haste); progression.collect(reward.xp); }
    }
    record(`탐사 지점 · ${site.title} · ${site.options.find(o => o.id === choice).name}`);
    for(let i=0;i<(reward.enemies?.length||0)&&sessionState.run.enemies.length<ENEMY_LIMIT;i++){
      const enemy=enemyRuntime.spawnEnemy(reward.enemies[i]);if(reward.elite)enemyRuntime.promoteElite(enemy);
    }
    sessionState.run.relicPending = site.id; return site;
  }
  function equipRelic(id) {
    const item = relics.find(item => item.id === id);
    if (!sessionState.run || !item || hasRelic(id,sessionState.run) || sessionState.run.relics.length >= sites.length || sessionState.run.relics.some(owned => relics.find(x => x.id === owned).site === item.site)) return false;
    sessionState.run.relics.push(id); if (id === 'mirror' && !sessionState.run.up.orbit) { sessionState.run.up.orbit = 1; record('반향 거울이 휴면 상태의 방어 위성 하나를 깨웠다.'); }
    sessionState.profile.memory.relics[id] = (sessionState.profile.memory.relics[id] || 0) + 1;
    sessionState.run.player.hp = Math.min(sessionState.run.player.hp, statistics.stats().maxHp); record(`유물 획득 · ${item.name}. ${item.desc}`); return true;
  }
  function chooseRelic(id) {
    if (!sessionState.run?.relicPending || !relicChoices(sessionState.run.relicPending).some(item => item.id === id) || !equipRelic(id)) return false;
    sessionState.run.relicPending = null; return true;
  }

  return { chooseSite, chooseRelic };
}
