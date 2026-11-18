// SOLMAR BAY — smooth follow camera. It eases toward the player, pulls
// back a little while driving so the road ahead is visible, and never
// leaves the world bounds.
import { CFG } from "./config.js";
import { clamp, lerp } from "./utils.js";

export const camera = { x: 0, y: 0, zoom: 1, targetZoom: 1 };

export function initCamera(x, y) {
  camera.x = x; camera.y = y;
  camera.zoom = CFG.ZOOM_FOOT;
  camera.targetZoom = CFG.ZOOM_FOOT;
}

export function updateCamera(dt, tx, ty, driving) {
  camera.targetZoom = driving ? CFG.ZOOM_CAR : CFG.ZOOM_FOOT;
  camera.zoom = lerp(camera.zoom, camera.targetZoom, Math.min(1, dt * 2.2));
  const k = Math.min(1, dt * CFG.CAM_SMOOTH);
  camera.x = lerp(camera.x, tx, k);
  camera.y = lerp(camera.y, ty, k);
  const vw = 1280 / camera.zoom, vh = 720 / camera.zoom;
  camera.x = clamp(camera.x, vw / 2 - 100, CFG.WORLD_W - vw / 2 + 100);
  camera.y = clamp(camera.y, vh / 2 - 100, CFG.WORLD_H - vh / 2 + 100);
}

// Wrap world drawing with apply/release; shake is an {x,y} offset.
export function applyCamera(ctx, shake) {
  ctx.save();
  ctx.translate(640, 360);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x + (shake ? shake.x : 0), -camera.y + (shake ? shake.y : 0));
}
export function releaseCamera(ctx) { ctx.restore(); }

// Screen pixels -> world coordinates (for mouse aiming).
export function screenToWorld(sx, sy) {
  return {
    x: camera.x + (sx - 640) / camera.zoom,
    y: camera.y + (sy - 360) / camera.zoom,
  };
}
