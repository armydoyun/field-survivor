import { canToggleShop, canBuyPermanentUpgrade } from '../core/view-policy.js';
import { shopItems } from '../data/shop.js';

export function createShop({ sessionState, view, platform, storage, hud, screen }) {
  const { $, keys, canvas } = platform;

  const shopCost = (item, level) => Math.round(item.base * Math.pow(item.growth, level));

  const cost = item => shopCost(item, sessionState.profile.perks[item.id] || 0);

  function buy(id) {
    if (!canBuyPermanentUpgrade(view)) return;
    const item = shopItems.find(x => x.id === id); if (!item || sessionState.profile.perks[id] >= item.max || sessionState.profile.gold < cost(item)) return;
    sessionState.profile.gold -= cost(item); sessionState.profile.perks[id]++; storage.save(); buildShop(); hud.updateHud();
    const next = $('shop').querySelector(`[data-buy="${id}"]:not(:disabled)`) || $('shop').querySelector('button:not(:disabled)'); if (next) next.focus({ preventScroll: true }); else screen.focusScene();
  }

  function buildShop() {
    $('shopWallet').textContent = `${sessionState.profile.gold.toLocaleString('ko-KR')} G`;
    $('shopNote').textContent = canBuyPermanentUpgrade(view) ? '구매 즉시 저장 · 보관 중인 도전에도 적용 · 재설계 횟수는 새 도전에서 충전' : '열람 중 · 영구 강화는 제목 화면에서 구매할 수 있습니다.';
    const shop = $('shop'); shop.innerHTML = shopItems.map(item => {
      const level = sessionState.profile.perks[item.id], maximum = level >= item.max, price = cost(item), disabled = !canBuyPermanentUpgrade(view) || maximum || sessionState.profile.gold < price;
      return `<button type="button" class="shop-button" data-buy="${item.id}" ${disabled ? 'disabled' : ''}><span class="shop-copy"><strong>${item.name} · Lv ${level}/${item.max}</strong><small>${item.desc}</small><span class="shop-effect">${maximum ? `현재 ${item.value(level)} · 완성` : `${item.value(level)} → ${item.value(level+1)}`}</span></span><span class="cost">${maximum ? 'MAX' : `${price.toLocaleString('ko-KR')} G`}</span></button>`;
    }).join('');
  }

  function toggleShop(open = !view.shopOpen) {
    if (!canToggleShop(view,open)) return;
    view.shopOpen = open; $('shopModal').hidden = !open; $('openShop').setAttribute('aria-expanded',String(open));
    if (open) { view.shopReturnFocus = document.activeElement; keys.clear(); buildShop(); $('closeShop').focus({ preventScroll:true }); }
    else { const node = view.shopReturnFocus; view.shopReturnFocus = null; (node?.isConnected && !node.closest('[hidden]') ? node : (view.mode === 'playing' ? canvas : $('openShop')))?.focus({ preventScroll:true }); view.lastFrame = performance.now(); }
  }

  function keyboardShop(event) {
    if (event.code === 'KeyS' && (event.ctrlKey || event.metaKey) && !event.altKey) { if (!event.repeat) storage.save(); return true; }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && ['Escape','KeyS'].includes(event.code)) { if (!event.repeat) toggleShop(false); return true; }
    if (event.code === 'Tab' || ['ArrowUp','ArrowDown'].includes(event.code)) { const items = [...$('shopModal').querySelectorAll('button:not(:disabled)')], i = items.indexOf(document.activeElement), step = event.shiftKey || event.code === 'ArrowUp' ? -1 : 1; items[i < 0 ? (step > 0 ? 0 : items.length-1) : (i+step+items.length)%items.length]?.focus({preventScroll:false}); return true; }
    return !['Enter','Space'].includes(event.code);
  }

  return { buy, buildShop, toggleShop, keyboardShop };
}
