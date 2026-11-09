import { fusionRecipes } from '../data/fusions.js';
import { canOpenFusion, canRerollUpgrade } from '../core/view-policy.js';
import { branchReady } from '../growth/build.js';

export function createGrowthActions({ sessionState, view, platform, screen, storage, feedback, progression }) {
  const { keys } = platform;

  let fusionReturnMode='playing';

  function chooseFusion(id){
    if(view.mode!=='fusion'||!sessionState.run)return false;const f=progression.chooseFusion(id);if(!f)return false;
    keys.clear();if(fusionReturnMode==='playing'&&sessionState.run.pending)openUpgrade();else screen.setMode(fusionReturnMode);storage.save();return true;
  }

  function toggleFusion(){if(view.mode==='fusion'){screen.setMode(fusionReturnMode);return;}if(!fusionRecipes.length)return;if(!canOpenFusion(view,sessionState.run))return;fusionReturnMode=view.mode;keys.clear();screen.setMode('fusion');}

  function rerollUpgrade() {
    if (!canRerollUpgrade(view,sessionState.run)) return;
    if(!progression.rerollUpgrade())return;keys.clear();screen.setMode('levelup');storage.save();
  }

  function openUpgrade(){const result=progression.prepareUpgrade();if(!result)return;screen.setMode(result.converted?'playing':'levelup');storage.save();}

  function chooseBranch(id){
    if(view.mode!=='branch'||!sessionState.run)return;const result=progression.chooseBranch(id);if(!result)return;const {weapon:current,option:pick}=result;
    feedback.popup(sessionState.run.player.x,sessionState.run.player.y-42,`${current.name} / ${pick.name}`,'#d7eeda');feedback.ring(sessionState.run.player.x,sessionState.run.player.y,48,'#a8e8d9',.34,'upgrade');
    if(branchReady(sessionState.run))screen.setMode('branch');else if(sessionState.run.pending)openUpgrade();else screen.setMode('playing');storage.save();
  }

  function chooseUpgrade(id){
    if(view.mode!=='levelup'||!progression.chooseUpgrade(id))return;
    feedback.showUpgrade(id);
    if(branchReady(sessionState.run))screen.setMode('branch');else if(sessionState.run.pending)openUpgrade();else screen.setMode('playing');storage.save();
  }

  return { chooseFusion, toggleFusion, rerollUpgrade, openUpgrade, chooseBranch, chooseUpgrade };
}
