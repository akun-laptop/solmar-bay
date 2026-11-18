// SOLMAR BAY — the player: on-foot movement, car enter/exit, weapons
import { CFG, WEAPONS } from "./config.js";
import { collideBuildings, inWater } from "./city.js";
import { clamp, angleTo } from "./utils.js";
import { moveVector, isDown, mouse } from "./input.js";
import { screenToWorld } from "./camera.js";
import { nearestVehicle, driveVehicle } from "./vehicles.js";
import { drawPerson } from "./sprites.js";
import { sfx } from "./audio.js";

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    health: CFG.PLAYER_MAX_HEALTH,
    armor: 0,
    inCar: null,          // vehicle object or null
    weapons: { fists: Infinity, pistol: 60, smg: 0, shotgun: 0 },
    weapon: "fists",
    fireCooldown: 0,
    reloadT: 0,
    meleeT: 0,
    dead: false,
    sprint: false,
  };
}

export function updatePlayer(p, dt, state) {
  if (p.dead) return;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.meleeT = Math.max(0, p.meleeT - dt);

  if (p.inCar) {
    const v = p.inCar;
    if (v.dead) { exitCar(p, state, true); return; }
    p.x = v.x; p.y = v.y;
    p.angle = v.angle;
    if (state.demoMode) return; // screenshot autopilot drives (main.js)
    // driving input
    const mv = moveVector();
    const throttle = -mv.y;               // W = forward
    const steer = mv.x;
    const handbrake = isDown("Space") || isDown("ShiftLeft");
    driveVehicle(v, dt, throttle, steer, handbrake);
    // exit car
    if (state.consumeKey("KeyE")) exitCar(p, state, false);
    // horn
    if (state.consumeKey("KeyH")) sfx.horn();
    return;
  }

  // --- On foot ---
  const mv = moveVector();
  p.sprint = isDown("ShiftLeft") && (mv.x !== 0 || mv.y !== 0);
  const speed = p.sprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
  let nx = p.x + mv.x * speed * dt;
  let ny = p.y + mv.y * speed * dt;
  // aim with mouse
  const w = screenToWorld(mouse.x, mouse.y);
  p.aimAngle = angleTo(p.x, p.y, w.x, w.y);
  if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);

  // building collision
  const push = collideBuildings(nx, ny, CFG.PLAYER_RADIUS);
  if (push) { nx += push.x; ny += push.y; }
  // water blocks walking
  if (!inWater(nx, ny)) { p.x = nx; p.y = ny; }
  p.x = clamp(p.x, 15, CFG.WORLD_W - 15);
  p.y = clamp(p.y, 15, CFG.WORLD_H - 15);

  // enter nearest car
  if (state.consumeKey("KeyE")) {
    const v = nearestVehicle(p.x, p.y, CFG.ENTER_DIST);
    if (v) enterCar(p, v, state);
  }
  // weapon switch
  if (state.consumeKey("Digit1")) p.weapon = "fists";
  if (state.consumeKey("Digit2") && p.weapons.pistol > 0) p.weapon = "pistol";
  if (state.consumeKey("Digit3") && p.weapons.smg > 0) p.weapon = "smg";
  if (state.consumeKey("Digit4") && p.weapons.shotgun > 0) p.weapon = "shotgun";
}

export function enterCar(p, v, state) {
  if (v.driver === "traffic" || v.driver === "police") {
    // carjacking: driver flees, wanted +1 (if police see it)
    v.driver = null;
    state.onCarjack(v);
  }
  v.driver = "player";
  p.inCar = v;
  sfx.enterCar();
  state.onEnterCar(v);
}

export function exitCar(p, state, forced) {
  const v = p.inCar;
  if (!v) return;
  v.driver = null;
  v.speed *= 0.4;
  // step out to the side
  const side = v.angle + Math.PI / 2;
  p.x = v.x + Math.cos(side) * 26;
  p.y = v.y + Math.sin(side) * 26;
  p.inCar = null;
  if (!forced) sfx.door();
  state.onExitCar(v);
}

export function damagePlayer(p, dmg) {
  if (p.dead) return;
  let rest = dmg;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest * 0.6);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  if (p.health <= 0) { p.health = 0; p.dead = true; }
}
export function healPlayer(p, amt) { p.health = Math.min(CFG.PLAYER_MAX_HEALTH, p.health + amt); }

export function currentWeapon(p) { return WEAPONS[p.weapon]; }

export function drawPlayer(ctx, p) {
  if (p.dead) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = "#1a5276";
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f1c27d";
    ctx.beginPath(); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (p.inCar) return; // drawn inside the car
  const armed = p.weapon !== "fists";
  drawPerson(ctx, p.x, p.y, p.aimAngle, "#1a5276", "#f1c27d", { armed });
  // aim line (subtle)
  if (armed) {
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.aimAngle) * 18, p.y + Math.sin(p.aimAngle) * 18);
    ctx.lineTo(p.x + Math.cos(p.aimAngle) * 60, p.y + Math.sin(p.aimAngle) * 60);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
