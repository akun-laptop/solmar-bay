// SOLMAR BAY — wanted system + police AI (cars chase, cops on foot)
import { CFG } from "./config.js";
import { city } from "./city.js";
import { clamp, rand, pick, angleDiff, dist2 } from "./utils.js";
import { spawnVehicle, driveVehicle, vehicles } from "./vehicles.js";
import { drawPerson } from "./sprites.js";
import { copFire } from "./combat.js";
import { sfx } from "./audio.js";

export const cops = [];        // on-foot police
export const copCars = [];     // police vehicles (also in vehicles[])

export function wantedFor(stars) {
  // how many cop cars / foot cops at each level
  return {
    cars: [0, 1, 2, 3, 4, 5][stars] || 0,
    foot: [0, 0, 1, 2, 4, 6][stars] || 0,
  };
}

export function spawnCopCar(state) {
  const p = state.player;
  // spawn off-screen on a road, in the direction the player is heading
  for (let tries = 0; tries < 8; tries++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(CFG.COP_SPAWN_DIST, CFG.COP_SPAWN_DIST + 260);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (x < 60 || x > CFG.WORLD_W - 60 || y < 60 || y > CFG.WORLD_H - 60) continue;
    const v = spawnVehicle("police", x, y, rand(0, Math.PI * 2), { driver: "police" });
    v.policeAI = makeCopCarAI(v, state);
    copCars.push(v);
    return v;
  }
  return null;
}

function makeCopCarAI(v, state) {
  return (dt) => {
    const p = state.player;
    if (p.dead) { driveVehicle(v, dt, 0, 0, false); return; }
    const want = Math.atan2(p.y - v.y, p.x - v.x);
    const diff = angleDiff(v.angle, want);
    const steer = clamp(diff * 2.6, -1, 1);
    // ram the player: full throttle, aim slightly ahead of a moving player
    let tx = p.x, ty = p.y;
    if (p.inCar) { tx += (p.inCar.vx || 0) * 0.35; ty += (p.inCar.vy || 0) * 0.35; }
    const want2 = Math.atan2(ty - v.y, tx - v.x);
    const diff2 = angleDiff(v.angle, want2);
    driveVehicle(v, dt, 1, clamp(diff2 * 2.6, -1, 1), false);
    // siren blip
    if (Math.random() < dt * 0.5) sfx.siren();
    // touch = bust if player on foot and slow
    if (!p.inCar && Math.hypot(p.x - v.x, p.y - v.y) < 40 && Math.abs(v.speed) < 60) {
      state.onBusted();
    }
  };
}

export function spawnFootCop(state) {
  const p = state.player;
  for (let tries = 0; tries < 8; tries++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(380, 560);
    const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
    if (x < 40 || x > CFG.WORLD_W - 40 || y < 40 || y > CFG.WORLD_H - 40) continue;
    const cop = {
      x, y, angle: 0, hp: 50, dead: false, deadT: 0,
      fireT: rand(0.5, 1.5), speed: rand(165, 200),
    };
    cops.push(cop);
    return cop;
  }
  return null;
}

export function updatePolice(dt, state) {
  const p = state.player;
  const want = wantedFor(state.wanted);
  // spawn to quota
  const liveCars = copCars.filter((v) => !v.dead).length;
  if (state.wanted > 0 && liveCars < want.cars && Math.random() < dt * 0.9) spawnCopCar(state);
  const liveFoot = cops.filter((c) => !c.dead).length;
  if (state.wanted > 0 && liveFoot < want.foot && Math.random() < dt * 0.7) spawnFootCop(state);
  // remove far/dead cop cars
  for (let i = copCars.length - 1; i >= 0; i--) {
    const v = copCars[i];
    if (v.dead && (v.deadT || 0) > 12) copCars.splice(i, 1);
    else if (!v.dead && state.wanted === 0 && Math.hypot(v.x - p.x, v.y - p.y) > 900) {
      v.driver = null; v.policeAI = null; copCars.splice(i, 1);
    }
  }
  // foot cops: chase + shoot
  for (let i = cops.length - 1; i >= 0; i--) {
    const c = cops[i];
    if (c.dead) {
      c.deadT += dt;
      if (c.deadT > 15) cops.splice(i, 1);
      continue;
    }
    if (state.wanted === 0) {
      // stand down: walk away, despawn when far
      c.x += Math.cos(c.angle) * 60 * dt;
      c.y += Math.sin(c.angle) * 60 * dt;
      if (Math.hypot(c.x - p.x, c.y - p.y) > 800) cops.splice(i, 1);
      continue;
    }
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    c.angle = Math.atan2(p.y - c.y, p.x - c.x);
    if (d > 130) {
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
    } else {
      // in range: shoot
      c.fireT -= dt;
      if (c.fireT <= 0 && !p.dead) {
        copFire(c, state);
        c.fireT = rand(0.7, 1.4);
      }
    }
    // bust: touch the player on foot
    if (!p.inCar && d < 26 && !p.dead) state.onBusted();
  }
}

export function damageCop(cop, dmg) {
  cop.hp -= dmg;
  if (cop.hp <= 0) { cop.dead = true; cop.deadT = 0; }
}

export function drawCops(ctx, cam) {
  for (const c of cops) {
    if (Math.abs(c.x - cam.x) > 900 || Math.abs(c.y - cam.y) > 700) continue;
    if (c.dead) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.fillStyle = "#1a1a2e";
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f1c27d";
      ctx.beginPath(); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    drawPerson(ctx, c.x, c.y, c.angle, "#1a1a2e", "#e0ac69", { armed: true });
    // badge dot
    ctx.fillStyle = "#ffd700";
    ctx.beginPath(); ctx.arc(c.x - 4, c.y - 4, 2, 0, Math.PI * 2); ctx.fill();
  }
}

export function clearPolice() {
  cops.length = 0;
  for (const v of copCars) { if (!v.dead) { v.driver = null; v.policeAI = null; } }
  copCars.length = 0;
}
