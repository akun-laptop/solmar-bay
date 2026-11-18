// SOLMAR BAY — pedestrians: ordinary people walking the sidewalks who
// run away from gunfire, explosions and speeding cars.
import { CFG } from "./config.js";
import { nearestRoadPoint } from "./city.js";
import { rand, pick, chance, clamp } from "./utils.js";
import { drawPerson } from "./sprites.js";

export const pedestrians = [];
const SHIRTS = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6", "#1abc9c", "#ecf0f1", "#e67e22", "#fd79a8", "#636e72"];
const SKINS = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];

export function spawnPed(x, y) {
  const p = {
    x, y,
    angle: rand(0, Math.PI * 2),
    speed: rand(45, 75),
    shirt: pick(SHIRTS),
    skin: pick(SKINS),
    target: null,
    state: "walk",   // walk | flee | dead
    fleeT: 0,
    dead: false, deadT: 0,
    hp: 30,
  };
  pickPedTarget(p);
  pedestrians.push(p);
  return p;
}

// Walk along a sidewalk: a nearby road point, offset to one side.
function pickPedTarget(p) {
  const rp = nearestRoadPoint(p.x + rand(-200, 200), p.y + rand(-200, 200));
  if (!rp) { p.target = { x: p.x + rand(-100, 100), y: p.y + rand(-100, 100) }; return; }
  const off = CFG.ROAD_W / 2 + 10;
  p.target = rp.horiz
    ? { x: rp.x, y: rp.y + (chance(0.5) ? off : -off) }
    : { x: rp.x + (chance(0.5) ? off : -off), y: rp.y };
}

export function scarePeds(x, y, radius) {
  for (const p of pedestrians) {
    if (p.dead) continue;
    if (Math.hypot(p.x - x, p.y - y) < radius) {
      p.state = "flee";
      p.fleeT = rand(2, 4);
      p.angle = Math.atan2(p.y - y, p.x - x) + rand(-0.5, 0.5);
    }
  }
}

// Returns true when the hit kills the ped.
export function damagePed(p, dmg, fromX, fromY) {
  if (p.dead) return false;
  p.hp -= dmg;
  if (p.hp <= 0) {
    p.dead = true;
    p.state = "dead";
    p.deadT = 0;
    return true;
  }
  p.state = "flee";
  p.fleeT = 3;
  p.angle = Math.atan2(p.y - fromY, p.x - fromX);
  return false;
}

export function updatePeds(dt, player, danger) {
  for (let i = pedestrians.length - 1; i >= 0; i--) {
    const p = pedestrians[i];
    if (p.dead) {
      p.deadT += dt;
      if (p.deadT > 20) pedestrians.splice(i, 1);
      continue;
    }
    if (p.state === "flee") {
      p.fleeT -= dt;
      p.x += Math.cos(p.angle) * 190 * dt;
      p.y += Math.sin(p.angle) * 190 * dt;
      if (p.fleeT <= 0) { p.state = "walk"; pickPedTarget(p); }
    } else {
      if (!p.target) pickPedTarget(p);
      const dx = p.target.x - p.x, dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) pickPedTarget(p);
      else {
        p.angle = Math.atan2(dy, dx);
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
      }
    }
    if (danger && p.state !== "flee" && Math.hypot(p.x - danger.x, p.y - danger.y) < danger.r) {
      p.state = "flee";
      p.fleeT = rand(2, 4);
      p.angle = Math.atan2(p.y - danger.y, p.x - danger.x);
    }
    p.x = clamp(p.x, 15, CFG.WORLD_W - 15);
    p.y = clamp(p.y, 15, CFG.WORLD_H - 15);
  }
}

export function maintainPeds(player) {
  for (let i = pedestrians.length - 1; i >= 0; i--) {
    if (Math.hypot(pedestrians[i].x - player.x, pedestrians[i].y - player.y) > 1200) pedestrians.splice(i, 1);
  }
  const near = pedestrians.filter((p) => !p.dead && Math.hypot(p.x - player.x, p.y - player.y) < 800).length;
  if (near < 14) {
    const a = rand(0, Math.PI * 2), d = rand(400, 750);
    const x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
    if (x < 40 || x > CFG.WORLD_W - 40 || y < 40 || y > CFG.WORLD_H - 40) return;
    spawnPed(x, y);
  }
}

export function drawPeds(ctx, cam) {
  for (const p of pedestrians) {
    if (Math.abs(p.x - cam.x) > 900 || Math.abs(p.y - cam.y) > 700) continue;
    if (p.dead) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = "rgba(160,20,20,0.5)";
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.shirt;
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    const bob = Math.sin(Date.now() / 130 + p.x) * 0.4;
    drawPerson(ctx, p.x, p.y + bob, p.angle, p.shirt, p.skin, {});
  }
}
