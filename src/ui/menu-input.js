import { canPauseGame } from '../core/view-policy.js';
export function createMenuInput({ view, platform, session, storage, screen, growthActions }) {
  const { $, keys } = platform;

  function hideGame() {
    if (!view.panic && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (!view.panic && canPauseGame(view)) session.pause();
    view.panic = !view.panic; $('privacy').hidden = !view.panic; $('app').hidden = view.panic; document.title = view.panic ? 'Workspace' : 'FIELD SURVIVOR';
    if (view.panic) { keys.clear(); storage.save(); } else { view.lastFrame = performance.now(); } screen.focusScene();
  }

  function keyboardMenu(event) {
    if (view.mode === 'playing' || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return false;
    if (view.mode === 'levelup' && event.code === 'KeyR') { growthActions.rerollUpgrade(); return true; }
    if(view.mode==='fusion'&&event.code==='Escape'){growthActions.toggleFusion();return true;}
    if (view.mode === 'newconfirm' && event.code === 'Escape') { screen.setMode(view.newConfirmReturn); return true; }
    if (view.mode === 'resetconfirm' && event.code === 'Escape') { screen.setMode('menu'); return true; }
    const overlay = $('overlay'), active = document.activeElement;
    const choices = [...overlay.querySelectorAll(view.mode === 'levelup' ? '[data-choice]:not(:disabled)' : 'button:not(:disabled)')];
    if (!choices.length) return false;
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
    // 화면 설정 토글은 숫자키 · Enter 기본 선택에서 뺀다(화살표 · Tab으로만 닿는다). 접힌 패널 안 버튼도 제외.
    const primary = choices.filter(button => !button.closest?.('.settings-panel'));
    if (digit) { primary[Number(digit[1]) - 1]?.click(); return true; }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
      const nav = choices.filter(button => !button.closest?.('.settings-panel:not([open])'));
      const i = nav.indexOf(active), step = ['ArrowRight', 'ArrowDown'].includes(event.code) ? 1 : -1;
      nav[(i < 0 ? (step > 0 ? 0 : nav.length - 1) : (i + step + nav.length) % nav.length)].focus(); return true;
    }
    if (event.code === 'Enter' || event.code === 'Space') {
      if (active?.matches('button,summary') && !active.disabled) return false;
      (primary[0] || choices[0]).click(); return true;
    }
    if (event.code === 'Tab' && view.mode === 'levelup') {
      const items = [...overlay.querySelectorAll('.option-card [data-choice], .option-card [data-upgrade-info], [data-action="reroll"]')].filter(button => !button.disabled);
      if (!items.length) return false;
      const i = items.indexOf(active), step = event.shiftKey ? -1 : 1;
      items[i < 0 ? (step > 0 ? 0 : items.length - 1) : (i + step + items.length) % items.length].focus({ preventScroll: true });
      return true;
    }
    if (event.code === 'Tab' && view.mode !== 'menu') {
      const i = choices.indexOf(active); if ((event.shiftKey && i <= 0) || (!event.shiftKey && i === choices.length - 1)) { choices[event.shiftKey ? choices.length - 1 : 0].focus(); return true; }
    }
    return false;
  }

  return { hideGame, keyboardMenu };
}
