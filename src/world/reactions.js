// 기억 축이 움직일 때 기록원의 반응 한 줄(NARRATIVE-REDESIGN.md 3.3 · 5.1절). 판 상태만 읽는 순수 함수다.
import { witnessReactions } from '../data/world.js';

const keepCount = r => (r.signalChoices || []).filter(x => x === 'hear').length + Object.values(r.siteDecisions || {}).filter(x => x === 'keep').length;
const burnCount = r => (r.signalChoices || []).filter(x => x === 'burn').length + Object.values(r.siteDecisions || {}).filter(x => x === 'take').length;

// direction: 'keep'(보존) | 'burn'(연소). 선택이 이미 판에 반영된 뒤 호출한다.
export function witnessReaction(r, direction) {
  const state = r?.npc?.state;
  if (state === 'taken') return witnessReactions.taken;
  if (state !== 'heard') return null;
  const lines = witnessReactions[direction], count = direction === 'keep' ? keepCount(r) : burnCount(r);
  return lines[Math.min(lines.length, Math.max(1, count)) - 1];
}

export function relicReaction(r, relicName) {
  return r?.npc?.state === 'heard' ? witnessReactions.relic.replace('{relic}', relicName) : null;
}
