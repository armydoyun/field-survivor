import { RUN_END } from '../core/config.js';

export function createFinale({ sessionState, view, platform, screen, storage, decisions }) {
  const { keys } = platform;

  function openFinale() {
    if (!sessionState.run || sessionState.run.time < RUN_END || sessionState.run.finalStep !== 0) return false;
    sessionState.run.finalStep = 1; keys.clear(); screen.setMode('finalintro'); storage.save(); return true;
  }

  function beginFinale(){if(view.mode!=='finalintro'||!decisions.beginFinale())return;screen.setMode('playing');storage.save();}
  function chooseFinale(id){
    if(view.mode!=='finalchoice')return;const result=decisions.chooseFinale(id);if(!result)return;
    view.lastResult=result;keys.clear();screen.setMode('ending');storage.save();
  }

  return { openFinale, beginFinale, canRelease:decisions.canRelease, chooseFinale };
}
