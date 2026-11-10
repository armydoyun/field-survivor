// 효과음 설정과 버튼. 설정은 프로필(profile.audio)에 저장한다. 화면 숨김(F9) 중에는 소리를 내지 않는다.
export function createAudioControl({ sessionState, view, platform, storage, sfx }) {
  const { $ } = platform;
  const settings = () => sessionState.profile.audio || (sessionState.profile.audio = { muted: false, volume: .6 });
  function label() { const button = $('soundButton'); if (button) button.innerHTML = `${settings().muted ? '소리 꺼짐' : '소리 켜짐'} <kbd>M</kbd>`; }
  function sync() { sfx.setMuted(settings().muted); sfx.setVolume(settings().volume); label(); }
  function toggle() { settings().muted = !settings().muted; sync(); storage.save(); return settings().muted; }
  function unlock() { const opened = sfx.unlock(); if (opened) sync(); return opened; }
  function play(id) { sfx.setSuspended(view.panic); return sfx.play(id); }
  return { unlock, toggle, sync, play };
}
