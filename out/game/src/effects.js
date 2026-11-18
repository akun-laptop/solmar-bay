// SOLMAR BAY — particles, skid marks, floating score text and screen shake.
// Everything here is transient: it is spawned, fades, and is forgotten.
import { rand, pick } from "./utils.js";

export const particles = [];
export const skids = [];     // {x1,y1,x2,y2,life}
export const floaters = [];  // {x,y,text,life,color}
let shakeMag = 0, shakeT = 0;

export function addShake(mag, time = 0.25) {
  shakeMag = Math.max(shakeMag, mag);
  shakeT = Math.max(shakeT, time);
}
export function shakeOffset(dt) {
  if (shakeT <= 0) return { x: 0, y: 0 };
  shakeT -= dt;
  const m = shakeMag * Math.max(0, shakeT / 0.25);
  if (shakeT <= 0) shakeMag = 0;
  return { x: rand(-m, m), y: rand(-m, m) };
}

export function spawnParticles(x, y, opts = {}) {
  const n = opts.count || 10;
  const colors = opts.colors || ["#ffcc00", "#ff6600", "#ffffff"];
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(40, opts.speed || 220);
    particles.push({
      x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.25, opts.life || 0.6), maxLife: opts.life || 0.6,
      size: rand(2, opts.size || 5),
      color: pick(colors),
      gravity: opts.gravity || 0,
      drag: opts.drag || 2,
    });
  }
}
export function explosion(x, y) {
  spawnParticles(x, y, { count: 42, speed: 320, life: 0.9, size: 7, colors: ["#ffcc00", "#ff6600", "#ff3300", "#888888", "#ffffff"] });
  spawnParticles(x, y, { count: 16, speed: 90, life: 1.6, size: 10, colors: ["#555555", "#777777"], drag: 1 });
  addShake(14, 0.4);
}
export function muzzle(x, y, angle) {
  const mx = x + Math.cos(angle) * 16, my = y + Math.sin(angle) * 16;
  spawnParticles(mx, my, { count: 4, speed: 160, life: 0.12, size: 4, colors: ["#ffe66d", "#ffaa00"] });
}
export function blood(x, y) {
  spawnParticles(x, y, { count: 6, speed: 120, life: 0.4, size: 3, colors: ["#c0392b", "#a93226"] });
}
export function sparks(x, y) {
  spawnParticles(x, y, { count: 8, speed: 260, life: 0.3, size: 2, colors: ["#ffe66d", "#ffffff"] });
}
export function smoke(x, y) {
  particles.push({ x, y, vx: rand(-8, 8), vy: rand(-26, -14), life: rand(0.6, 1.2), maxLife: 1.2, size: rand(5, 9), color: "#666666", gravity: -12, drag: 0.6 });
}
export function addSkid(x1, y1, x2, y2) {
  skids.push({ x1, y1, x2, y2, life: 6 });
  if (skids.length > 400) skids.splice(0, skids.length - 400);
}
export function addFloater(x, y, text, color) {
  floaters.push({ x, y, text, life: 1.4, color: color || "#ffd700" });
}

export function updateEffects(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.gravity * dt;
    p.vx *= (1 - p.drag * dt); p.vy *= (1 - p.drag * dt);
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  for (let i = skids.length - 1; i >= 0; i--) {
    skids[i].life -= dt;
    if (skids[i].life <= 0) skids.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].life -= dt;
    floaters[i].y -= 26 * dt;
    if (floaters[i].life <= 0) floaters.splice(i, 1);
  }
}

export function drawEffects(ctx) {
  ctx.strokeStyle = "rgba(10,10,10,0.4)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const s of skids) {
    ctx.globalAlpha = Math.min(1, s.life / 2);
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + (p.life / p.maxLife) * 0.5), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";
  ctx.font = "bold 15px sans-serif";
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}
