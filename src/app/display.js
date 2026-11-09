import { W, H } from '../core/config.js';

export function createDisplay({ view, platform, screen, scene }) {
  const { $, canvas, ctx } = platform;

  async function toggleFullscreen() {
    const host = $('gameColumn');
    if (!document.fullscreenEnabled || !host.requestFullscreen) return screen.toast('이 브라우저에서 전체화면을 사용할 수 없습니다.');
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (!view.panic) await host.requestFullscreen(); }
    catch { screen.toast('전체화면 전환이 차단되었습니다.'); }
  }

  function fitCanvas() {
    const box = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2), width = Math.max(1, Math.round(box.width * dpr)), height = Math.max(1, Math.round(box.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const scale = Math.min(width / W, height / H); ctx.setTransform(scale, 0, 0, scale, (width - W * scale) / 2, (height - H * scale) / 2); scene.draw();
  }

  return { toggleFullscreen, fitCanvas };
}
