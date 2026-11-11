import { canSimulate, canRenderScene, canRefreshHud, canAutoSave } from '../core/view-policy.js';
export function createLoop({ sessionState, view, update, cameraView, scene, hud, storage, inspector, finale }) {
  function frame(now) {
    if (view.disposed) return;
    const dt = Math.min(0.035, Math.max(0, (now - view.lastFrame) / 1000)); view.lastFrame = now;
    const allowed = canSimulate(view);
    const measuring = inspector?.enabled, started = measuring ? performance.now() : 0;
    const advance = inspector ? inspector.shouldUpdate(allowed) : allowed;
    let advancedDt=0;
    cameraView.juice?.tick(dt);
    // 히트스톱: 큰 타격 직후 아주 잠깐 판 시간을 멈춘다. 개발 패널(inspector)이 있는 판에서는 쓰지 않아 측정과 재현이 그대로다.
    const frozen = advance && !inspector && cameraView.juice?.consumeFreeze(dt);
    if (advance && !frozen) { if(inspector?.advance)advancedDt=inspector.advance(dt,update.update);else{advancedDt=inspector?.held?1/60:dt;update.update(advancedDt);} }
    const updated = measuring ? performance.now() : 0;
    finale?.watchStillness(now);
    if (canRenderScene(view)) { cameraView.followCamera(advancedDt); scene.draw(); }
    if (measuring) { if (advance) inspector.measureFrame(updated-started,performance.now()-updated); else inspector.idleFrame(); inspector.draw(); }
    if (canRefreshHud(view) && now - view.lastHud >= 200) { hud.updateHud(); view.lastHud = now; }
    if (now >= view.nextSave) { if (canAutoSave(view,sessionState.run)) storage.save(); view.nextSave = now + 5000; }
    inspector?.afterFrame?.(now);
    view.frameRequest = requestAnimationFrame(frame);
  }

  return { frame };
}
