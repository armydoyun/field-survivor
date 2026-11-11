// 영구 강화 가격 계산. 표는 data/shop.js에 있다.
// 가격은 10G 단위로 반올림한다.
export const shopCost = (item, level) => Math.round(item.base * Math.pow(item.growth, level) / 10) * 10;
export const shopSpent = (item, level) => { let sum = 0; for (let l = 0; l < level; l++) sum += shopCost(item, l); return sum; };
