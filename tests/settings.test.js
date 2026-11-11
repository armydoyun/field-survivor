import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_DEFAULTS, viewSetting, toggleView, hydrateView, settingsHtml } from '../src/ui/settings.js';
import { initialProfile, hydrateProfile } from '../src/core/profile.js';
import { createActions } from '../src/app/actions.js';

test('view settings default to the old screen, toggle, validate and survive hydration', () => {
  const profile = initialProfile();
  assert.deepEqual(profile.view, VIEW_DEFAULTS);
  for (const id of Object.keys(VIEW_DEFAULTS)) assert.equal(viewSetting(profile, id), VIEW_DEFAULTS[id]);
  assert.equal(toggleView(profile, 'shake'), false); assert.equal(toggleView(profile, 'labels'), true); assert.equal(toggleView(profile, 'bogus'), null);
  const back = initialProfile(); hydrateProfile(back, JSON.parse(JSON.stringify(profile))); assert.deepEqual(back.view, { ...VIEW_DEFAULTS, shake: false, labels: true });
  assert.deepEqual(hydrateView({ shake: 'no', numbers: false, extra: 1 }), { ...VIEW_DEFAULTS, numbers: false });
  assert.equal(viewSetting({}, 'effects'), true);
});

test('the settings panel lists every toggle with its state and the set- action reaches the controller', () => {
  const profile = initialProfile(); toggleView(profile, 'numbers');
  const html = settingsHtml(profile);
  for (const id of Object.keys(VIEW_DEFAULTS)) assert.ok(html.includes(`data-action="set-${id}"`), id);
  assert.ok(html.includes('aria-pressed="false"><span class="setting-name">피해 숫자'));
  const calls = [], actions = createActions({ viewSettings: { toggle: id => calls.push(id) }, view: { mode: 'paused' }, growthActions: {}, session: {}, screen: {}, storage: {}, story: {}, sites: {}, journey: {}, finale: {}, objectives: {}, buildGuide: {} });
  assert.equal(actions.dispatch('set-shake'), true); assert.deepEqual(calls, ['shake']);
});

