import { canOpenShopWithKeyboard, canOpenUpgradeInfo, canInteractInWorld, canAcceptMovement, canTogglePause } from '../core/view-policy.js';
// Global key priority only; menu navigation and gameplay actions have separate owners.
export function createKeyboardInput({ sessionState, view, platform, shop, buildGuide, menuInput, storage, growthActions, display, actions, session }) {
  const { $, keys } = platform;
  function keydown(event){
    if (event.code === 'F9') { event.preventDefault(); if (!event.repeat) { if (view.shopOpen) shop.toggleShop(false); if (view.skillInfoOpen) buildGuide.closeUpgradeInfo(); if (view.buildOpen) buildGuide.toggleBuildGuide(false); menuInput.hideGame(); } return; }
    if (view.panic || event.isComposing) return;
    if (event.code === 'KeyS' && (event.ctrlKey || event.metaKey) && !event.altKey) { event.preventDefault(); if (!event.repeat) storage.save(); return; }
    if (view.shopOpen) { if (shop.keyboardShop(event)) event.preventDefault(); return; }
    if (view.skillInfoOpen) { if (event.code === 'Escape' || event.code === 'KeyI') buildGuide.closeUpgradeInfo(); else if (event.code === 'Tab') $('closeSkillInfo').focus({ preventScroll: true }); if (!['Enter','Space'].includes(event.code)) event.preventDefault(); return; }
    if (canOpenUpgradeInfo(view) && event.code === 'KeyI' && !event.repeat && !event.ctrlKey && !event.altKey) { const id = document.activeElement?.dataset?.upgradeInfo || document.activeElement?.dataset?.choice || sessionState.run?.choices?.[0]; if (id) { event.preventDefault(); buildGuide.openUpgradeInfo(id); } return; }
    if (view.buildOpen) { if (buildGuide.keyboardBuildGuide(event)) event.preventDefault(); else if (!['Enter','Space','Tab'].includes(event.code)) event.preventDefault(); return; }
    if(event.code==='KeyG'&&!event.repeat&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();growthActions.toggleFusion();return;}
    if (event.code === 'KeyB' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey && !(event.target instanceof Element && event.target.closest('input,textarea,select'))) { event.preventDefault(); buildGuide.toggleBuildGuide(true); return; }
    if (event.code === 'KeyS' && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && canOpenShopWithKeyboard(view) && !(event.target instanceof Element && (event.target.isContentEditable || event.target.closest('input,textarea,select')))) { event.preventDefault(); shop.toggleShop(true); return; }
    if (event.code === 'KeyF' && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey && !(event.target instanceof Element && (event.target.isContentEditable || event.target.closest('input,textarea,select')))) { event.preventDefault(); display.toggleFullscreen(); return; }
    if (event.code === 'KeyE' && !event.repeat) { if (canInteractInWorld(view)) { event.preventDefault(); actions.interact(); } return; }
    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat && canTogglePause(view)) { event.preventDefault(); session.pause(); return; }
    if (view.mode !== 'playing' && menuInput.keyboardMenu(event)) { event.preventDefault(); return; }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code) && canAcceptMovement(view)) { event.preventDefault(); keys.add(event.code); }
  }
  const keyup = event => keys.delete(event.code);
  return { keydown, keyup };
}
