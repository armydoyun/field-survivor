// 효과음: WebAudio로 즉석 합성한다(파일 없음, 오프라인 단일 파일 유지). NEXT-UPDATE-PLAN.md 3절.
// 전투 계산 · 판 상태 · 난수와 분리되어 있다. 렌더 쪽 피드백 훅에서만 호출한다.
// 오디오 컨텍스트는 첫 사용자 입력 뒤에 연다(브라우저 정책). 컨텍스트가 없는 환경(테스트 등)에서는 아무것도 하지 않는다.

// 소리 정의: 음(진동자) 또는 잡음, 길이, 음량, 주파수 미끄럼. gap은 같은 소리의 최소 간격(초), cap은 초당 최대 횟수.
export const SOUNDS = Object.freeze({
  hit: { kind: "tone", wave: "triangle", freq: 880, to: 520, dur: 0.035, gain: 0.05, gap: 0.03, cap: 20 },
  crit: { kind: "tone", wave: "square", freq: 1320, to: 990, dur: 0.07, gain: 0.06, gap: 0.06, cap: 8 },
  kill: { kind: "noise", dur: 0.09, gain: 0.07, filter: 1800, gap: 0.05, cap: 12 },
  hurt: { kind: "tone", wave: "sawtooth", freq: 160, to: 90, dur: 0.16, gain: 0.12, gap: 0.3, cap: 4 },
  level: { kind: "arp", wave: "triangle", notes: [523, 659, 784], step: 0.06, dur: 0.12, gain: 0.09, gap: 0.2, cap: 3 },
  select: { kind: "tone", wave: "sine", freq: 660, to: 880, dur: 0.08, gain: 0.07, gap: 0.08, cap: 6 },
  guardianYield: { kind: "tone", wave: "sine", freq: 440, to: 220, dur: 0.5, gain: 0.1, gap: 1, cap: 1 },
  guardianSpare: { kind: "arp", wave: "sine", notes: [392, 494, 587, 784], step: 0.09, dur: 0.35, gain: 0.08, gap: 1, cap: 1 },
  guardianEnd: { kind: "noise", dur: 0.45, gain: 0.12, filter: 600, gap: 1, cap: 1 },
  shield: { kind: "arp", wave: "sine", notes: [1047, 1568], step: 0.04, dur: 0.4, gain: 0.08, gap: 0.3, cap: 3 },
  drift: { kind: "tone", wave: "sine", freq: 110, to: 82, dur: 0.6, gain: 0.09, gap: 2, cap: 1 },
});

export function createSfx({ audioContext = () => (globalThis.AudioContext ? new globalThis.AudioContext() : null), now = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000 } = {}) {
  let ctx = null, master = null, noise = null, volume = 0.6, muted = false, suspended = false;
  const last = new Map(), window = new Map();

  function unlock() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume?.(); return true; }
    try { ctx = audioContext(); } catch { ctx = null; }
    if (!ctx) return false;
    master = ctx.createGain(); master.gain.value = muted ? 0 : volume; master.connect(ctx.destination);
    return true;
  }

  // 같은 소리가 너무 잦으면 건너뛴다: 최소 간격(gap)과 1초 창 안의 최대 횟수(cap).
  function allowed(id, def, t) {
    if (t - (last.get(id) ?? -Infinity) < def.gap) return false;
    const recent = (window.get(id) || []).filter(x => t - x < 1);
    if (recent.length >= def.cap) { window.set(id, recent); return false; }
    recent.push(t); window.set(id, recent); last.set(id, t);
    return true;
  }

  function noiseBuffer() {
    if (noise) return noise;
    const length = Math.floor(ctx.sampleRate * 0.5), buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
    let seed = 7; for (let i = 0; i < length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647) * 2 - 1; }
    return (noise = buffer);
  }

  function envelope(t, dur, gain) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master); return g;
  }

  function tone(def, t, freq = def.freq, dur = def.dur) {
    const osc = ctx.createOscillator(); osc.type = def.wave; osc.frequency.setValueAtTime(freq, t);
    if (def.to) osc.frequency.exponentialRampToValueAtTime(def.to, t + dur);
    osc.connect(envelope(t, dur, def.gain)); osc.start(t); osc.stop(t + dur + 0.02);
  }

  function play(id) {
    const def = SOUNDS[id];
    if (!def || !ctx || muted || suspended || volume <= 0) return false;
    if (!allowed(id, def, now())) return false;
    const t = ctx.currentTime;
    if (def.kind === "tone") tone(def, t);
    else if (def.kind === "arp") def.notes.forEach((freq, i) => tone({ ...def, to: 0 }, t + i * def.step, freq, def.dur));
    else {
      const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      src.buffer = noiseBuffer(); filter.type = "lowpass"; filter.frequency.setValueAtTime(def.filter, t);
      src.connect(filter); filter.connect(envelope(t, def.dur, def.gain)); src.start(t); src.stop(t + def.dur + 0.02);
    }
    return true;
  }

  function apply() { if (master) master.gain.value = muted ? 0 : volume; }
  function setMuted(value) { muted = !!value; apply(); return muted; }
  function setVolume(value) { volume = Math.max(0, Math.min(1, Number(value) || 0)); apply(); return volume; }
  // 화면 숨김(F9) · 선택 화면 등에서 잠시 멈춘다. 설정(muted)과 따로 둔다.
  function setSuspended(value) { suspended = !!value; }

  return { unlock, play, setMuted, setVolume, setSuspended, state: () => ({ ready: !!ctx, muted, volume, suspended }) };
}
