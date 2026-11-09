export function createScreen({ view, platform, shop, buildGuide, modals, hud }) {
  const { $, canvas } = platform;
  function toast(message){$('saveStatus').textContent=message;}
  function focusScene() { if (view.panic) return $('privacy').focus({ preventScroll: true }); if (view.shopOpen) return $('closeShop').focus({ preventScroll: true }); (view.mode === 'playing' ? canvas : $('overlay').querySelector('button:not(:disabled)'))?.focus({ preventScroll: true }); }

  function setMode(next) { if (view.shopOpen) shop.toggleShop(false); if (view.skillInfoOpen) buildGuide.closeUpgradeInfo(); if (view.buildOpen) buildGuide.toggleBuildGuide(false); view.mode = next; $('pauseButton').disabled = !['playing', 'paused'].includes(view.mode); $('pauseButton').innerHTML = view.mode === 'paused' ? '재개 <kbd>ESC</kbd>' : '일시정지 <kbd>ESC</kbd>'; modals.renderModal(); shop.buildShop(); hud.updateHud(); focusScene(); }

  return { toast, focusScene, setMode };
}
