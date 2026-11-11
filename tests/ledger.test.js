import test from 'node:test';
import assert from 'node:assert/strict';
import { initialProfile, hydrateProfile } from '../src/core/profile.js';
import { ledgerOverviewHtml, endingGridHtml } from '../src/ui/ledger.js';
import { createModalContent } from '../src/ui/modal-content.js';

test('the ledger overview hides unfound endings, shows variants once found, people and start weapons', () => {
  const profile = initialProfile(), m = profile.memory;
  let html = endingGridHtml(m);
  assert.equal((html.match(/<strong>\?\?\?<\/strong>/g) || []).length, 4); assert.equal((html.match(/숨은 변주 · \?/g) || []).length, 2);
  m.endings.divided = 2; m.variants.chorus = 1; m.endings.consume = 1;
  html = ledgerOverviewHtml(m);
  assert.ok(html.includes('두 개의 목소리')); assert.ok(html.includes('변주 · 합창 1회')); assert.ok(html.includes('숨은 변주 · ?'), 'hollow still hidden');
  assert.ok(html.includes('아직 만나지 않음'));
  assert.ok(html.includes('시작 무기 3/8'));
  m.stoker.met = 1; m.stoker.stoked = 1; assert.ok(ledgerOverviewHtml(m).includes('만남 1 · 지핌 1 · 끔 0'));
});

test('variant counts are stored, validated and the ledger opens from the menu once anything is recorded', () => {
  const profile = initialProfile(); hydrateProfile(profile, { memory: { variants: { hollow: 2, chorus: -1 } } });
  assert.deepEqual(profile.memory.variants, { hollow: 2, chorus: 0 });
  const s = { profile, run: null }; profile.runs = 1;
  const menu = createModalContent({ sessionState: s, view: { mode: 'menu' }, route: () => null }).buildModal();
  assert.ok(menu.includes('data-action="ledger-open"'));
  const ledger = createModalContent({ sessionState: s, view: { mode: 'ledger' }, route: () => null }).buildModal();
  assert.ok(ledger.includes('ledger-overview'));
});
