// 화면 설정(v3.1): 화면 흔들림 · 이펙트 강도 · 피해 숫자 · 색 대신 글자 표시. 프로필(profile.view)에 저장한다.
// 기본값은 이전과 같은 화면이다. 판 상태 · 난수는 건드리지 않는다.
import { escapeHtml } from './html.js';

export const VIEW_DEFAULTS = Object.freeze({ shake: true, effects: true, numbers: true, labels: false });
export const VIEW_SETTINGS = Object.freeze([
  { id: 'shake', name: '화면 흔들림', on: '켜짐', off: '꺼짐', note: '피격 · 폭발 때 화면이 흔들립니다.' },
  { id: 'effects', name: '이펙트', on: '전체', off: '간단히', note: '간단히: 잔상 · 파편 · 고리 효과를 줄입니다.' },
  { id: 'numbers', name: '피해 숫자', on: '표시', off: '숨김', note: '적을 맞힐 때 뜨는 숫자입니다.' },
  { id: 'labels', name: '색 대신 글자', on: '켜짐', off: '꺼짐', note: '경로 색 · 표류 구역 종류를 글자로도 보여 줍니다.' }
]);

export const viewSetting = (profile, id) => (profile?.view?.[id] ?? VIEW_DEFAULTS[id]);

export function hydrateView(raw) {
  const view = {};
  for (const id of Object.keys(VIEW_DEFAULTS)) view[id] = typeof raw?.[id] === 'boolean' ? raw[id] : VIEW_DEFAULTS[id];
  return view;
}

export function toggleView(profile, id) {
  if (!Object.hasOwn(VIEW_DEFAULTS, id)) return null;
  profile.view = { ...hydrateView(profile.view), [id]: !viewSetting(profile, id) };
  return profile.view[id];
}

export function settingsHtml(profile, open = false) {
  const rows = VIEW_SETTINGS.map(s => { const on = viewSetting(profile, s.id); return `<li><button type="button" class="setting-toggle" data-action="set-${s.id}" aria-pressed="${on}"><span class="setting-name">${escapeHtml(s.name)}</span><span class="setting-state" data-on="${on}">${escapeHtml(on ? s.on : s.off)}</span></button><small>${escapeHtml(s.note)}</small></li>`; }).join('');
  return `<details class="settings-panel"${open ? ' open' : ''}><summary>화면 설정</summary><ul class="settings-list">${rows}</ul></details>`;
}
