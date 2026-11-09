import { W, H } from '../core/config.js';

export function createCameraView({ sessionState, view }) {
  const camera = { x: W / 2, y: H / 2, owner: null, pickupAt: 0, shake: 0, shakeX: 0, shakeY: 0 };

  const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');

  const reducedMotion = () => !!motionPreference?.matches;

  const cameraKick = power => { if (sessionState.run && !reducedMotion()) camera.shake = Math.max(camera.shake, Math.min(1, power)); };

  function followCamera(dt) {
    if (!sessionState.run) { camera.owner = null; camera.shake = camera.shakeX = camera.shakeY = 0; return; }
    const p = sessionState.run.player;
    if (camera.owner !== sessionState.run || Math.hypot(p.x - camera.x, p.y - camera.y) > 780) {
      camera.owner = sessionState.run; camera.x = p.x; camera.y = p.y; camera.pickupAt = 0; camera.shake = camera.shakeX = camera.shakeY = 0;
      return;
    }
    if (view.mode !== 'playing' || !dt) return;
    const k = 1 - Math.exp(-dt * (reducedMotion() ? 24 : 12));
    camera.x += (p.x - camera.x) * k; camera.y += (p.y - camera.y) * k;
    camera.shake = Math.max(0, camera.shake - dt * 4.2);
    const amplitude = reducedMotion() ? 0 : 2.6 * camera.shake;
    camera.shakeX = Math.sin(sessionState.run.time * 121) * amplitude; camera.shakeY = Math.sin(sessionState.run.time * 167) * amplitude * .7;
  }

  return { camera, reducedMotion, cameraKick, followCamera };
}
