// Mulberry32 v1. Only simulation state is persisted; old unseeded saves keep their original stream.
export function makeRandomState(seed) { const value = Number(seed) >>> 0; return { version:1, seed:value, state:value }; }
export function restoreRandomState(raw) {
  const uint = x => Number.isInteger(x) && x >= 0 && x <= 0xffffffff;
  return raw?.version === 1 && uint(raw.seed) && uint(raw.state) ? { version:1, seed:raw.seed, state:raw.state } : null;
}
export function nextRandom(state) {
  state.state = (state.state + 0x6d2b79f5) >>> 0;
  let value = Math.imul(state.state ^ state.state >>> 15, 1 | state.state);
  value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}
export const runRandom = run => run?.rng ? nextRandom(run.rng) : Math.random();
export const newSeed = () => (Math.random() * 4294967296) >>> 0;
export function createVisualRandom(sessionState) {
  let owner = null, state;
  return () => {
    const run = sessionState.run;
    if (!run?.rng) return Math.random();
    if (owner !== run) { owner = run; state = makeRandomState(run.rng.seed ^ 0x9e3779b9); }
    return nextRandom(state);
  };
}
