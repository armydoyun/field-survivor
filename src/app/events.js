import { canPauseGame } from '../core/view-policy.js';
export function createEvents({ view, platform, shop, buildGuide, menuInput, storage, display, session, input, actions, inspector }) {
  const { $, keys, canvas } = platform;

  let unbind = null;
  function bindEvents() {
    if (unbind) return unbind;
    const listeners = [];
    const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options); listeners.push([target, type, handler, options]); };
    const touched = () => { view.inputSeen = true; };
    listen(window, 'keydown',event=>{touched();if(!inspector?.keydown(event))input.keydown(event);});
    listen(window, 'pointerdown', touched);
    listen(window, 'pointermove', touched);
    listen(window, 'wheel', touched, { passive: true });

    listen(window, 'keyup',input.keyup);

    listen(window, 'blur', () => { keys.clear(); if (canPauseGame(view)) session.pause(); });

    listen(document, 'visibilitychange', () => { if (document.hidden && canPauseGame(view)) session.pause(); if (document.hidden) storage.save(); });

    listen(window, 'pagehide', storage.save);

    listen($('saveButton'), 'click', storage.save);

    listen($('pauseButton'), 'click', session.pause);

    listen($('hideButton'), 'click', menuInput.hideGame);

    listen(document, 'fullscreenchange', display.fitCanvas);

    listen($('overlay'), 'click',actions.overlayClick);

    listen($('closeSkillInfo'), 'click', buildGuide.closeUpgradeInfo);

    listen($('skillModal'), 'click', event => { if (event.target === $('skillModal')) buildGuide.closeUpgradeInfo(); });

    listen($('openBuildGuide'), 'click', () => buildGuide.toggleBuildGuide(true));

    listen($('closeBuildGuide'), 'click', () => buildGuide.toggleBuildGuide(false));

    listen($('buildModal'), 'click', event => { if (event.target === $('buildModal')) buildGuide.toggleBuildGuide(false); const tab = event.target.closest('[data-build-tab]'); if (tab) { view.buildTab = tab.dataset.buildTab; buildGuide.renderBuildGuide(); } });

    listen($('openShop'), 'click', () => shop.toggleShop(true));

    listen($('closeShop'), 'click', () => shop.toggleShop(false));

    listen($('shopModal'), 'click', event => { if (event.target === $('shopModal')) shop.toggleShop(false); });

    listen($('openFusion'), 'click',actions.toggleFusion);

    listen($('shop'), 'click', event => { const button = event.target.closest('[data-buy]'); if (button) shop.buy(button.dataset.buy); });

    listen(window, 'resize', display.fitCanvas);

    const observer = 'ResizeObserver' in window ? new ResizeObserver(display.fitCanvas) : null;
    observer?.observe(canvas);
    let active = true;
    const cleanup = () => { if (!active) return; active = false; for (const [target, type, handler, options] of listeners) target.removeEventListener(type, handler, options); observer?.disconnect(); if (unbind === cleanup) unbind = null; };
    unbind = cleanup; return cleanup;
  }

  return { bindEvents };
}
