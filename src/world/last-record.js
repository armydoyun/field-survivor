// 최종 결말 '마지막 기록'의 조건과 판 중 진행. 판에는 열린 판에서만 run.lastRecord = { said } 필드가 생긴다.
import { truthPieces, lastRecord } from '../data/world.js';
import { appendRecord } from '../core/profile.js';

// 진실 조각을 찾았는지: 멈춰 있기 · 엔진의 기원은 별도 기억, 나머지는 결말 횟수.
export function truthFoundIds(memory) {
  return truthPieces.filter(x => x.id === 'stillness' ? memory.witness?.quiet === true : x.id === 'origin' ? memory.stoker?.origin === true : (memory.endings?.[x.id] || 0) > 0).map(x => x.id);
}
export const lastRecordOpen = memory => truthFoundIds(memory).length === truthPieces.length;

// 새 판 시작 때: 조건을 채웠으면 필드를 만들고 시작 문단을 남긴다.
export function beginLastRecord(profile, run) {
  if (!run || !lastRecordOpen(profile.memory)) return false;
  run.lastRecord = { said: 0 };
  appendRecord(profile, run, `마지막 기록 · ${lastRecord.start}`);
  return true;
}

// 매 프레임: 정해진 시각마다 세 사람이 한 번씩 마지막 말을 한다.
export function tickLastRecord(profile, run) {
  const state = run?.lastRecord;
  if (!state || state.said >= lastRecord.words.length) return false;
  const next = lastRecord.words[state.said];
  if (run.time < next.at) return false;
  appendRecord(profile, run, next.line); state.said++;
  return true;
}
