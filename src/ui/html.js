const sceneHtml=scenes=>scenes?.length?`<div class="closure-reveal">${scenes.map(x=>`<p>${escapeHtml(x)}</p>`).join('')}</div>`:'';

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const modal = (heading, title, desc, actions = '', extra = '', wide = false) => `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-label="${title}"><div class="eyebrow">${heading}</div><h1>${title}</h1><p>${desc}</p>${extra}<div class="modal-actions">${actions}</div><div class="modal-keys">← → / ↑ ↓ · 선택 이동 <span>숫자키 · 바로 선택</span> <span>Enter · 확정</span></div></div>`;

const action = (id, text, primary = false) => `<button type="button" class="button${primary ? ' primary' : ''}${id.startsWith('reset-') ? ' danger-action' : ''}" data-action="${id}">${text}</button>`;

const decision = (heading,title,line,options) => modal(heading,title,line,'',`<div class="option-grid decision-grid" data-count="${options.length}">${options.map((o,i)=>`<div class="option-card"><button type="button" class="option" data-action="${o.id}"><span class="option-level"><kbd>${i+1}</kbd></span><strong>${escapeHtml(o.name)}</strong><span class="option-desc">${escapeHtml(o.effect || '')}</span><span class="option-select">선택<span aria-hidden="true"> →</span></span></button></div>`).join('')}</div>${options.some(o=>/EXP/.test(o.effect||''))?'<p class="small-note">기본·보석 EXP는 수집 보정 전 수치입니다. 수확의 잔·전투 분석·전투 회수·회수 방벽과 소수 누적이 최종 획득량에 적용됩니다.</p>':''}`,true);

const number = value => Number(value).toFixed(2).replace(/\.00$/, ''), percent = value => `${number(value * 100)}%`;

export { sceneHtml, escapeHtml, modal, action, decision, number, percent };
