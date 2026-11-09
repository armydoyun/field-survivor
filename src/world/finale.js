import { RUN_END } from '../core/config.js';

// 마지막 선택 화면에서 이만큼 아무 입력도 없으면(해방 조건을 채운 판에 한해) 열린 문 결말로 넘어간다.
export const FINAL_STILLNESS = 4.5;

export function createFinale({ sessionState, view, platform, screen, storage, decisions }) {
  const { keys } = platform;

  function openFinale() {
    if (!sessionState.run || sessionState.run.time < RUN_END || sessionState.run.finalStep !== 0) return false;
    sessionState.run.finalStep = 1; keys.clear(); screen.setMode('finalintro'); storage.save(); return true;
  }

  function beginFinale(){if(view.mode!=='finalintro'||!decisions.beginFinale())return;screen.setMode('playing');storage.save();}
  function chooseFinale(id){
    if(view.mode!=='finalchoice')return;const result=decisions.chooseFinale(id);if(!result)return;
    view.lastResult=result;view.finalStillSince=null;keys.clear();screen.setMode('ending');storage.save();
  }

  // 화면 갱신마다 호출된다(now: 밀리초). 입력이 들어오면 view.inputSeen이 켜지고 멈춘 시간을 처음부터 다시 센다.
  function watchStillness(now){
    if(view.mode!=='finalchoice'){view.finalStillSince=null;return false;}
    if(view.finalStillSince==null||view.inputSeen){view.finalStillSince=now;view.inputSeen=false;return false;}
    if(now-view.finalStillSince<FINAL_STILLNESS*1000||!decisions.route()?.release)return false;
    chooseFinale('release');return true;
  }

  return { openFinale, beginFinale, route:decisions.route, chooseFinale, watchStillness };
}
