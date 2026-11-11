import test from 'node:test';
import assert from 'node:assert/strict';
import { createSfx, SOUNDS } from '../src/audio/sfx.js';
import { createAudioControl } from '../src/app/audio.js';
import { initialProfile, hydrateProfile } from '../src/core/profile.js';

function fakeContext(log) {
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = kind => ({ kind, connect() {}, start() { log.push(kind); }, stop() {}, gain: param(), frequency: param(), type: '' });
  return { state: 'running', currentTime: 0, sampleRate: 8000, destination: {}, resume() {},
    createGain: () => node('gain'), createOscillator: () => node('osc'), createBufferSource: () => node('noise'), createBiquadFilter: () => node('filter'),
    createBuffer: (_c, length) => ({ getChannelData: () => new Float32Array(length) }) };
}

test('without an audio context every sound is a silent no-op', () => {
  const sfx = createSfx({ audioContext: () => null });
  assert.equal(sfx.unlock(), false); assert.equal(sfx.play('hit'), false); assert.equal(sfx.state().ready, false);
});

test('sounds are rate limited per id by minimum gap and per-second cap, and respect mute and suspension', () => {
  let t = 0; const log = [], sfx = createSfx({ audioContext: () => fakeContext(log), now: () => t });
  assert.equal(sfx.play('hit'), false, 'not before the first input');
  assert.equal(sfx.unlock(), true);
  assert.equal(sfx.play('hit'), true); assert.equal(sfx.play('hit'), false, 'within the minimum gap');
  let played = 1; for (let i = 0; i < 100; i++) { t += SOUNDS.hit.gap + .001; if (t < 1 && sfx.play('hit')) played++; }
  assert.ok(played <= SOUNDS.hit.cap);
  t = 5; assert.equal(sfx.play('kill'), true); assert.ok(log.includes('noise'));
  t = 6; assert.equal(sfx.play('level'), true); assert.equal(log.filter(x => x === 'osc').length >= SOUNDS.level.notes.length, true);
  sfx.setMuted(true); t = 9; assert.equal(sfx.play('hit'), false); sfx.setMuted(false);
  sfx.setSuspended(true); t = 10; assert.equal(sfx.play('hit'), false); sfx.setSuspended(false); assert.equal(sfx.play('hit'), true);
  assert.equal(sfx.play('unknown'), false);
});

test('the audio control toggles and saves the setting, labels the button, and stays quiet while hidden', () => {
  const profile = initialProfile(), view = { panic: false }, button = { innerHTML: '' }, saves = [];
  const sfx = createSfx({ audioContext: () => fakeContext([]), now: () => 100 });
  const audio = createAudioControl({ sessionState: { profile }, view, platform: { $: id => id === 'soundButton' ? button : null }, storage: { save: () => saves.push(1) }, sfx });
  audio.sync(); assert.ok(button.innerHTML.startsWith('소리 켜짐'));
  assert.equal(audio.toggle(), true); assert.equal(profile.audio.muted, true); assert.ok(button.innerHTML.startsWith('소리 꺼짐')); assert.equal(saves.length, 1);
  audio.toggle(); audio.unlock(); assert.equal(audio.play('select'), true);
  view.panic = true; assert.equal(audio.play('crit'), false);
  const restored = initialProfile(); hydrateProfile(restored, { audio: { muted: true, volume: 7 } }); assert.deepEqual(restored.audio, { muted: true, volume: 1 });
  const fresh = initialProfile(); hydrateProfile(fresh, {}); assert.deepEqual(fresh.audio, { muted: false, volume: .6 });
});

test('the volume slider stores 0 to 100 in steps of 5, follows mute and the fire sounds stay quieter than hits', () => {
  const profile = initialProfile(), saves = [], slider = { value: '0', disabled: false }, button = { innerHTML: '' };
  const sfx = createSfx({ audioContext: () => null });
  const audio = createAudioControl({ sessionState: { profile }, view: {}, platform: { $: id => id === 'volumeSlider' ? slider : id === 'soundButton' ? button : null }, storage: { save: () => saves.push(1) }, sfx });
  audio.sync(); assert.equal(slider.value, '60');
  assert.equal(audio.setVolume('42'), .4); assert.equal(slider.value, '40'); assert.equal(sfx.state().volume, .4); assert.equal(saves.length, 1);
  assert.equal(audio.setVolume(250), 1); assert.equal(audio.setVolume('x'), 0);
  audio.toggle(); assert.equal(slider.disabled, true);
  for (const id of Object.keys(SOUNDS).filter(id => id.startsWith('fire'))) assert.ok(SOUNDS[id].gain < SOUNDS.hit.gain, id);
});
