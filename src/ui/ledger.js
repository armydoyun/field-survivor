// 결말 기록 한눈에 보기(v3.1): 결말 4종과 변주, 인물 기록, 시작 무기 해금. 읽기 전용 HTML이다.
import { finalEndings, lastRecord } from '../data/world.js';
import { lastRecordOpen } from '../world/last-record.js';
import { loadouts, unlockedLoadouts } from '../data/loadouts.js';
import { VARIANTS } from '../world/route.js';
import { escapeHtml } from './html.js';
import { weaponSvg } from './weapon-icons.js';
import { weaponNames } from '../data/weapons.js';

const variantOf = id => Object.entries(VARIANTS).find(([, v]) => v.ending === id)?.[0] || null;

export function endingGridHtml(memory) {
  const cards = finalEndings.map(e => {
    const count = memory.endings[e.id] || 0, variant = variantOf(e.id), seen = variant ? (memory.variants?.[variant] || 0) : 0;
    const extra = variant ? `<small class="ledger-variant" data-found="${seen > 0}">${seen > 0 ? `변주 · ${escapeHtml(VARIANTS[variant].name)} ${seen}회` : '숨은 변주 · ?'}</small>` : '';
    return `<li class="ledger-ending" data-found="${count > 0}" data-ending="${e.id}"><strong>${count > 0 ? escapeHtml(e.name) : '???'}</strong><span>${count}회</span>${extra}</li>`;
  }).join('');
  return `<ul class="ledger-endings">${cards}</ul>`;
}

export function peopleHtml(memory) {
  const w = memory.witness, g = memory.guardian, k = memory.stoker || { met: 0, stoked: 0, quenched: 0 };
  const row = (name, met, detail) => `<li data-met="${met}"><strong>${name}</strong><span>${met ? detail : '아직 만나지 않음'}</span></li>`;
  return `<ul class="ledger-people">${row('기록원', w.met > 0, `만남 ${w.met} · 들음 ${w.heard} · 추출 ${w.taken}${w.quiet ? ' · 멈춘 시간' : ''}`)}${row('감시자', g.spared + g.ended > 0, `돌려보냄 ${g.spared} · 분해 ${g.ended}`)}${row('화부', k.met > 0, `만남 ${k.met} · 지핌 ${k.stoked} · 끔 ${k.quenched}`)}</ul>`;
}

export function loadoutHtml(memory) {
  const open = new Set(unlockedLoadouts(memory));
  return `<div class="ledger-loadouts"><strong>시작 무기 ${open.size}/${loadouts.length}</strong><span>${loadouts.map(l => `<i data-open="${open.has(l.id)}" title="${escapeHtml(open.has(l.id) ? weaponNames[l.id] : `잠김 · ${l.unlock}`)}">${weaponSvg(l.id)}</i>`).join('')}</span></div>`;
}

export function lastRecordHtml(memory) {
  if (memory.lastRecord > 0) return `<div class="ledger-last" data-done="true"><strong>${escapeHtml(lastRecord.name)}</strong><span>장치를 멈췄다 · ${memory.lastRecord}회</span></div>`;
  if (lastRecordOpen(memory)) return `<div class="ledger-last" data-done="false"><strong>${escapeHtml(lastRecord.name)}</strong><span>${escapeHtml(lastRecord.ledger)}</span></div>`;
  return '';
}

export function ledgerOverviewHtml(memory) {
  return `<section class="ledger-overview">${lastRecordHtml(memory)}${endingGridHtml(memory)}${peopleHtml(memory)}${loadoutHtml(memory)}</section>`;
}
