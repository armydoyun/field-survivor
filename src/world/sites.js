import { canInteractInWorld } from '../core/view-policy.js';
import { runRandom } from '../core/random.js';
import { sites } from '../data/world.js';

export function createSites({ sessionState, view, platform, session, storage, screen, decisions, feedback, growthActions }) {
  const { keys } = platform;

  function spawnSite() {
    if (!sessionState.run || sessionState.run.site || sessionState.run.siteStep >= sites.length || sessionState.run.time < sites[sessionState.run.siteStep].at) return;
    const angle = runRandom(sessionState.run) * Math.PI * 2, distance = 330 + runRandom(sessionState.run) * 130, p = sessionState.run.player;
    sessionState.run.site = { id: sites[sessionState.run.siteStep].id, x: p.x + Math.cos(angle) * distance, y: p.y + Math.sin(angle) * distance };
    session.record(`탐사 신호 · ${sites[sessionState.run.siteStep].title}의 위치가 표시되었다.`); storage.save();
  }

  function meetSite() {
    if (!canInteractInWorld(view) || !sessionState.run?.site || Math.hypot(sessionState.run.player.x - sessionState.run.site.x, sessionState.run.player.y - sessionState.run.site.y) > 74) return false;
    sessionState.run.sitePending = true; keys.clear(); screen.setMode('site'); storage.save(); return true;
  }

  function chooseSite(choice){
    if(view.mode!=='site'||!decisions.chooseSite(choice))return;
    screen.setMode('relic');storage.save();
  }

  function chooseRelic(id){
    if(view.mode!=='relic'||!decisions.chooseRelic(id))return;
    feedback.ring(sessionState.run.player.x,sessionState.run.player.y,50,'#e9d29c',.4,'relic');
    if(sessionState.run.pending)growthActions.openUpgrade();else screen.setMode('playing');storage.save();
  }

  return { spawnSite, meetSite, chooseSite, chooseRelic };
}
