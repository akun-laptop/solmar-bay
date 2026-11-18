// SOLMAR BAY — procedural sprite drawing (all art is code, no image files)
import { PAL } from "./config.js";

// Draw a top-down car: body, cabin, windshield, lights, wheels
export function drawCar(ctx, x, y, angle, color, opts = {}) {
  const L = opts.length || 46, W = opts.width || 22;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(-L / 2 + 2, -W / 2 + 3, L, W);
  // wheels
  ctx.fillStyle = "#141414";
  const ww = 8, wh = 4;
  ctx.fillRect(-L / 2 + 4, -W / 2 - 2, ww, wh);
  ctx.fillRect(-L / 2 + 4, W / 2 - 2, ww, wh);
  ctx.fillRect(L / 2 - 12, -W / 2 - 2, ww, wh);
  ctx.fillRect(L / 2 - 12, W / 2 - 2, ww, wh);
  // body
  ctx.fillStyle = color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 6);
  ctx.fill();
  // cabin
  ctx.fillStyle = "rgba(20,30,45,0.92)";
  roundRect(ctx, -L / 6, -W / 2 + 4, L / 3, W - 8, 3);
  ctx.fill();
  // windshield highlight
  ctx.fillStyle = "rgba(160,220,255,0.5)";
  ctx.fillRect(L / 6 - 2, -W / 2 + 5, 3, W - 10);
  // headlights / taillights
  ctx.fillStyle = "#fff9c4";
  ctx.fillRect(L / 2 - 3, -W / 2 + 2, 3, 4);
  ctx.fillRect(L / 2 - 3, W / 2 - 6, 3, 4);
  ctx.fillStyle = "#ff3b30";
  ctx.fillRect(-L / 2, -W / 2 + 2, 3, 4);
  ctx.fillRect(-L / 2, W / 2 - 6, 3, 4);
  // taxi sign
  if (opts.taxi) {
    ctx.fillStyle = "#ffd700";
    ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = "#111";
    ctx.font = "bold 6px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TAXI", 0, 2);
  }
  // police livery
  if (opts.police) {
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(-L / 2 + 6, -W / 2 + 1, L - 12, 3);
    ctx.fillStyle = "#0a84ff";
    ctx.fillRect(-L / 6, -W / 2 + 2, 5, 4);
    ctx.fillStyle = "#ff3b30";
    ctx.fillRect(L / 6 - 5, -W / 2 + 2, 5, 4);
    if (opts.lights) {
      const t = (Date.now() / 180) % 2;
      ctx.fillStyle = t < 1 ? "rgba(10,132,255,0.35)" : "rgba(255,59,48,0.35)";
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill();
    }
  }
  // damage smoke handled by effects; show dents
  if (opts.damage > 0.5) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-L / 2 + 2, -W / 2 + 2, 10, 6);
  }
  ctx.restore();
}

// Draw a top-down person: shadow, body circle, head, direction indicator
export function drawPerson(ctx, x, y, angle, shirt, skin, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath(); ctx.ellipse(1, 2, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  // body
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  // shoulders
  ctx.fillStyle = shade(shirt, -18);
  ctx.beginPath(); ctx.arc(-4, -3, 4, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-4, 3, 4, 0, Math.PI * 2); ctx.fill();
  // head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(2, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  // facing nub (gun arm when aiming)
  ctx.rotate(angle);
  ctx.fillStyle = opts.armed ? "#222" : skin;
  ctx.fillRect(6, -2, opts.armed ? 12 : 6, 4);
  ctx.restore();
}

// Draw a building with height shading + roof detail
export function drawBuilding(ctx, b, sunAngle) {
  const h = b.hgt;
  // drop shadow (sun from top-left)
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(b.x + h * 0.4, b.y + h * 0.4, b.w, b.h);
  // walls
  ctx.fillStyle = shade(b.color, -32);
  ctx.fillRect(b.x, b.y + 3, b.w, b.h);
  // roof
  ctx.fillStyle = b.color;
  ctx.fillRect(b.x, b.y, b.w, b.h - 3);
  // roof detail
  ctx.fillStyle = shade(b.color, 18);
  if (b.roof === "flat") {
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 16);
    ctx.fillStyle = shade(b.color, -12);
    ctx.fillRect(b.x + b.w / 2 - 5, b.y + b.h / 2 - 5, 10, 10); // AC unit
  } else {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h - 3);
    ctx.lineTo(b.x + b.w / 2, b.y + 4);
    ctx.lineTo(b.x + b.w, b.y + b.h - 3);
    ctx.closePath();
    ctx.fill();
  }
  // edge
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 4);
}

export function drawTree(ctx, x, y, kind) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath(); ctx.ellipse(3, 4, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
  if (kind === "palm") {
    ctx.strokeStyle = "#7a5a34"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -4); ctx.stroke();
    ctx.strokeStyle = "#2a8a3a"; ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, -4);
      ctx.quadraticCurveTo(Math.cos(a) * 8, -4 + Math.sin(a) * 8 - 4, Math.cos(a) * 13, Math.sin(a) * 13);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#2d6a2a";
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3a8a34";
    ctx.beginPath(); ctx.arc(-3, -3, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawLamp(ctx, x, y, night) {
  ctx.fillStyle = "#444";
  ctx.fillRect(x - 1, y - 1, 2, 2);
  if (night) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, 26);
    g.addColorStop(0, "rgba(255,220,120,0.5)");
    g.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Lighten/darken a hex color by amount (-100..100)
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}
