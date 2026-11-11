import { W, H } from '../core/config.js';
import { viewSetting } from '../ui/settings.js';
import { floorAt, drawFloorMarks, drawPillars, drawDrift, drawStoker, drawGuardianFocus } from './floor.js';

export function createScene({ sessionState, platform, cameraView, worldView, primitives, statistics, weaponView, fusionView, playerView, feedback, enemyView, navigation, hints }) {
  const { ctx } = platform;

  function draw() {
    ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.lineCap='butt';ctx.lineJoin='round';ctx.setLineDash([]);
    const floor = sessionState.run ? floorAt(sessionState.run.time) : null;
    ctx.fillStyle = floor ? floor.bg : '#15232d'; ctx.fillRect(0, 0, W, H);
    if (sessionState.run && cameraView.camera.owner !== sessionState.run) cameraView.followCamera(0);
    const cx = sessionState.run ? cameraView.camera.x : W / 2, cy = sessionState.run ? cameraView.camera.y : H / 2;
    ctx.save(); ctx.translate(W / 2 - cx + (sessionState.run ? cameraView.camera.shakeX : 0), H / 2 - cy + (sessionState.run ? cameraView.camera.shakeY : 0));
    ctx.strokeStyle = floor ? floor.line : '#25343e'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = Math.floor((cx - W / 2) / 48) * 48; x <= cx + W / 2; x += 48) { ctx.moveTo(x, cy - H / 2); ctx.lineTo(x, cy + H / 2); }
    for (let y = Math.floor((cy - H / 2) / 48) * 48; y <= cy + H / 2; y += 48) { ctx.moveTo(cx - W / 2, y); ctx.lineTo(cx + W / 2, y); }
    ctx.stroke(); if (!sessionState.run) { ctx.restore(); return; }
    if (floor.mark) drawFloorMarks(ctx, floor, cx, cy);

    worldView.drawJourney();
    const detail=primitives.visualDetail(),s=statistics.stats();
    worldView.drawMarkers();drawDrift(ctx,sessionState.run,viewSetting(sessionState.profile,'labels'));drawPillars(ctx,sessionState.run,cx,cy);drawStoker(ctx,sessionState.run);
    weaponView.drawAuxiliaryFields();weaponView.drawBaseDevices(s,cx,cy);
    worldView.drawCollectibles(s,detail,cx,cy);
    feedback.drawSkillEchoes();weaponView.drawPlayerShots(detail,cx,cy);weaponView.drawCombatWaves(detail,cx,cy);weaponView.drawCombatArcs(detail,cx,cy);
    ctx.globalAlpha = 1;
    weaponView.drawSpecializations();fusionView?.drawFusions();enemyView.drawHostileMarks();enemyView.drawEnemyTelegraphs();
    weaponView.drawEnemyBullets(cx,cy);
    enemyView.drawEnemies(detail,cx,cy);drawGuardianFocus(ctx,sessionState.run);
    playerView.drawOrbitAndMotion(s,detail);
    playerView.drawStatus(s);
    feedback.drawFeedback(detail,cx,cy);
    ctx.globalAlpha = 1;navigation.drawNavigation(cx,cy);ctx.restore();
    hints?.drawHint();
  }

  return { draw };
}
