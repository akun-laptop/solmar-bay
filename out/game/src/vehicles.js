// SOLMAR BAY — vehicles: arcade car physics, traffic AI, spawning.
// A vehicle has a driver ("player", "traffic", "police", or null for parked)
// and the physics are shared: the player, traffic and police all drive the
// same cars through driveVehicle().
import { CFG, VEHICLES } from "./config.js";
import { city, onRoad, nearestRoadPoint, collideBuildings } from "./city.js";
import { clamp, rand, pick, chance, angleDiff } from "./utils.js";
import { drawCar } from "./sprites.js";
import { addSkid, sparks, smoke, explosion } from "./effects.js";
import { sfx } from "./audio.js";

export const vehicles = [];
let nextId = 1;

export function spawnVehicle(type, x, y, angle, opts = {}) {
  const def = VEHICLES[type];
  const v = {
    id: nextId++,
    type, def,
    x, y, angle: angle || 0,
    speed: 0, vx: 0, vy: 0,
    color: opts.color || pick(def.colors),
    hp: def.hp,
    driver: opts.driver || null,
    ai: null,
    policeAI: null,
    dead: false, deadT: 0,
    lastSkid: null,
    smokeT: 0,
  };
  if (v.driver === "traffic") v.ai = makeTrafficAI(v);
  vehicles.push(v);
  return v;
}

function makeTrafficAI(v) {
  return {
    target: nearestRoadPoint(v.x, v.y),
    cruise: rand(110, 170),
    wait: 0,
  };
}

// Arcade handling: forward accel, speed-sensitive steering, a little drift.
// handbrake loosens the grip so the car slides and leaves skid marks.
export function driveVehicle(v, dt, throttle, steer, handbrake) {
  const def = v.def;
  if (throttle > 0) v.speed += def.accel * throttle * dt;
  else if (throttle < 0) {
    if (v.speed > 20) v.speed -= def.brake * dt;
    else v.speed = Math.max(-90, v.speed + def.accel * 0.6 * throttle * dt);
  }
  v.speed -= v.speed * 0.55 * dt; // drag
  if (Math.abs(v.speed) < 2 && throttle === 0) v.speed = 0;
  v.speed = clamp(v.speed, -100, def.top);

  const spdN = clamp(Math.abs(v.speed) / def.top, 0, 1);
  const steerRate = (handbrake ? 3.6 : 2.4) * (1 - spdN * 0.55);
  v.angle += steer * steerRate * dt * (v.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(v.speed) / 40 + 0.25);

  const vx = Math.cos(v.angle) * v.speed, vy = Math.sin(v.angle) * v.speed;
  const grip = handbrake ? 0.55 : 0.92;
  v.vx = v.vx * (1 - grip) + vx * grip;
  v.vy = v.vy * (1 - grip) + vy * grip;
  v.x += v.vx * dt;
  v.y += v.vy * dt;

  // sideways slide -> skid marks
  const lat = Math.abs(-Math.sin(v.angle) * v.vx + Math.cos(v.angle) * v.vy);
  if (lat > 90 && Math.abs(v.speed) > 120) {
    if (v.lastSkid) addSkid(v.lastSkid.x, v.lastSkid.y, v.x, v.y);
    v.lastSkid = { x: v.x, y: v.y };
    if (v.driver === "player" && Math.random() < 0.3) sfx.skid();
  } else v.lastSkid = null;

  v.x = clamp(v.x, 20, CFG.WORLD_W - 20);
  v.y = clamp(v.y, 20, CFG.WORLD_H - 20);
  const push = collideBuildings(v.x, v.y, 24);
  if (push) {
    v.x += push.x; v.y += push.y;
    if (Math.abs(v.speed) > 130) { damageVehicle(v, Math.abs(v.speed) * 0.06); sparks(v.x, v.y); sfx.crash(); }
    v.speed *= 0.4; v.vx *= 0.3; v.vy *= 0.3;
  }
}

export function damageVehicle(v, dmg) {
  if (v.dead) return;
  v.hp -= dmg;
  if (v.hp <= 0) {
    v.dead = true;
    v.deadT = 0;
    explosion(v.x, v.y);
    sfx.explosion();
  }
}

// Traffic: pick a road point ahead, steer toward it, brake for cars and
// pedestrians in front, pause sometimes as if at a light.
function updateTraffic(v, dt, player) {
  const ai = v.ai;
  if (!ai) return;
  if (ai.wait > 0) { ai.wait -= dt; driveVehicle(v, dt, 0, 0, false); return; }
  const d = Math.hypot(ai.target.x - v.x, ai.target.y - v.y);
  if (d < 30) {
    const options = [];
    for (const r of city.roadsH) options.push({ x: v.x, y: r.y });
    for (const r of city.roadsV) options.push({ x: r.x, y: v.y });
    const near = options.filter((o) => {
      const dd = Math.hypot(o.x - v.x, o.y - v.y);
      return dd < 260 && dd > 60;
    });
    ai.target = near.length ? pick(near) : { x: v.x + rand(-300, 300), y: v.y + rand(-300, 300) };
    if (chance(0.15)) ai.wait = rand(0.5, 2);
    return;
  }
  const want = Math.atan2(ai.target.y - v.y, ai.target.x - v.x);
  const steer = clamp(angleDiff(v.angle, want) * 2.2, -1, 1);
  let throttle = 1;
  const ahead = vehicles.find((o) => o !== v && !o.dead &&
    Math.hypot(o.x - v.x, o.y - v.y) < 70 &&
    Math.abs(angleDiff(v.angle, Math.atan2(o.y - v.y, o.x - v.x))) < 0.5);
  if (ahead) throttle = -0.6;
  if (player && !player.inCar && Math.hypot(player.x - v.x, player.y - v.y) < 55 &&
      Math.abs(angleDiff(v.angle, Math.atan2(player.y - v.y, player.x - v.x))) < 0.6) {
    throttle = -0.8;
    if (chance(0.02)) sfx.horn();
  }
  driveVehicle(v, dt, throttle * (ai.cruise / v.def.top), steer, false);
  if (!onRoad(v.x, v.y) && Math.random() < 0.02) ai.target = nearestRoadPoint(v.x, v.y);
}

export function updateVehicles(dt, player) {
  // car-car collision: circle push + damage on hard hits
  for (let i = 0; i < vehicles.length; i++) {
    const a = vehicles[i];
    if (a.dead) continue;
    for (let j = i + 1; j < vehicles.length; j++) {
      const b = vehicles[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d < 40 && d > 0.01) {
        const push = (40 - d) / 2, nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 120) { damageVehicle(a, rel * 0.03); damageVehicle(b, rel * 0.03); sparks((a.x + b.x) / 2, (a.y + b.y) / 2); }
        a.speed *= 0.7; b.speed *= 0.7;
      }
    }
  }
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (v.dead) {
      v.deadT += dt;
      if (v.deadT > 12) vehicles.splice(i, 1);
      continue;
    }
    if (v.driver === "traffic") updateTraffic(v, dt, player);
    else if (v.driver === "police" && v.policeAI) v.policeAI(dt);
    if (v.hp < v.def.hp * 0.4) {
      v.smokeT -= dt;
      if (v.smokeT <= 0) { smoke(v.x - Math.cos(v.angle) * 14, v.y - Math.sin(v.angle) * 14); v.smokeT = 0.12; }
    }
  }
}

// Keep about 10 traffic cars near the player; recycle the ones far away.
export function maintainTraffic(player) {
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (v.driver === "traffic" && Math.hypot(v.x - player.x, v.y - player.y) > 1400) vehicles.splice(i, 1);
  }
  const near = vehicles.filter((v) => v.driver === "traffic" && Math.hypot(v.x - player.x, v.y - player.y) < 900).length;
  if (near < 10) {
    const a = rand(0, Math.PI * 2), d = rand(500, 900);
    const x = player.x + Math.cos(a) * d, y = player.y + Math.sin(a) * d;
    if (x < 60 || x > CFG.WORLD_W - 60 || y < 60 || y > CFG.WORLD_H - 60) return;
    const rp = nearestRoadPoint(x, y);
    if (!rp) return;
    const type = pick(["sedan", "sedan", "sedan", "sports", "taxi", "truck", "van"]);
    const angle = rp.horiz ? (chance(0.5) ? 0 : Math.PI) : (chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    spawnVehicle(type, rp.x, rp.y, angle, { driver: "traffic" });
  }
}

// Parked cars in lots and at curbs, placed when a new game starts.
export function seedParkedCars() {
  const lots = city.zones.filter((z) => z.kind === "parking");
  const fallback = { x: 600, y: 600, w: 120, h: 120 };
  for (let i = 0; i < 26; i++) {
    const z = lots.length ? pick(lots) : fallback;
    const x = z.x + rand(15, z.w - 15), y = z.y + rand(15, z.h - 15);
    spawnVehicle(pick(["sedan", "sedan", "sports", "taxi", "truck", "van", "bike"]), x, y, pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), { driver: null });
  }
  for (let i = 0; i < 8; i++) {
    const r = pick(city.roadsH);
    spawnVehicle(pick(["sedan", "sports", "taxi"]), rand(300, CFG.WORLD_W - 300), r.y + CFG.ROAD_W / 2 - 12, pick([0, Math.PI]), { driver: null });
  }
}

export function drawVehicles(ctx, cam) {
  for (const v of vehicles) {
    if (Math.abs(v.x - cam.x) > 900 || Math.abs(v.y - cam.y) > 700) continue;
    drawCar(ctx, v.x, v.y, v.angle, v.dead ? "#1c1c1c" : v.color, {
      police: v.type === "police",
      taxi: v.type === "taxi",
      lights: v.type === "police" && !v.dead,
      damage: 1 - v.hp / v.def.hp,
      length: v.type === "truck" || v.type === "van" ? 56 : v.type === "bike" ? 34 : 46,
      width: v.type === "bike" ? 12 : 22,
    });
  }
}

export function nearestVehicle(x, y, maxDist) {
  let best = null, bd = maxDist;
  for (const v of vehicles) {
    if (v.dead) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}
