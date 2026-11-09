const n = (value, fallback = 0, min = -1e9, max = 1e9) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;

const integer = (value, fallback = 0, min = 0, max = 1e9) => Math.floor(n(value, fallback, min, max));

const timeText = value => { const s = Math.floor(value); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));

export { n, integer, timeText, clamp };
