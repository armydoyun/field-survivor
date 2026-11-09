import { SAVE_KEY } from './config.js';
import { hydrateProfile } from './profile.js';
import { encodeSave, readSave } from '../save/format.js';
import { restoreRun } from '../save/restore-run.js';

// Browser IO and status messages only. Backend lookup remains inside try/catch.
export function createStorage({ sessionState, view, screen, backend=()=>localStorage }) {
  function save(){
    if(view.resetIdle){screen.toast('기록 초기화됨 · 새 게임 시작 시 저장됩니다.');return true;}
    try{backend().setItem(SAVE_KEY,encodeSave(sessionState.profile,sessionState.run));screen.toast(`저장됨 · ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`);return true;}
    catch{screen.toast('저장 불가 · 브라우저 설정 확인');return false;}
  }
  function load(){
    try{const data=readSave(backend().getItem(SAVE_KEY));if(!data)return;hydrateProfile(sessionState.profile,data.profile);sessionState.replaceRun(restoreRun(data.run,sessionState.profile));}
    catch{screen.toast('저장 데이터를 읽을 수 없음');}
  }
  function clear(){
    try{backend().removeItem(SAVE_KEY);return true;}
    catch{screen.toast('기록을 삭제할 수 없습니다. 브라우저 저장소 설정을 확인하세요.');return false;}
  }
  return {save,load,clear};
}
