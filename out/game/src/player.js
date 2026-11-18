// SOLMAR BAY — Rico Vance: on-foot movement and aiming, entering and
// leaving cars, weapon switching. Driving itself lives in vehicles.js.
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
    health: CFG.MAX_HEALTH,
    armor: 0,
    inCar: null,
    weapons: { fists: Infinity, pistol: 60, smg: 0, shotgun: 0 },
    weapon: "fists",
    fireCooldown: 0,
    meleeT: 0,
    dead: false,
    sprint: false,
  };
}

export function updatePlayer(p, dt, game) {
  if (p.dead) return;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.meleeT = Math.max(0, p.meleeT - dt);

  if (p.inCar) {
    const v = p.inCar;
    if (v.dead) { exitCar(p, game, true); return; }
    p.x = v.x; p.y = v.y;
    p.angle = v.angle;
    if (game.demoMode) return; // the screenshot autopilot drives
    const mv = moveVector();
    driveVehicle(v, dt, -mv.y, mv.x, isDown("Space") || isDown("ShiftLeft"));
    if (game.consumeKey("KeyE")) exitCar(p, game, false);
    if (game.consumeKey("KeyH")) sfx.horn();
    return;
  }

  // --- On foot ---
  const mv = moveVector();
  p.sprint = isDown("ShiftLeft") && (mv.x !== 0 || mv.y !== 0);
  const speed = p.sprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
  let nx = p.x + mv.x * speed * dt;
  let ny = p.y + mv.y * speed * dt;
  const w = screenToWorld(mouse.x, mouse.y);
  p.aimAngle = angleTo(p.x, p.y, w.x, w.y);
  if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);

  const push = collideBuildings(nx, ny, CFG.PLAYER_RADIUS);
  if (push) { nx += push.x; ny += push.y; }
  if (!inWater(nx, ny)) { p.x = nx; p.y = ny; }
  p.x = clamp(p.x, 15, CFG.WORLD_W - 15);
  p.y = clamp(p.y, 15, CFG.WORLD_H - 15);

  if (game.consumeKey("KeyE")) {
    const v = nearestVehicle(p.x, p.y, CFG.ENTER_DIST);
    if (v) enterCar(p, v, game);
  }
  if (game.consumeKey("Digit1")) p.weapon = "fists";
  if (game.consumeKey("Digit2") && p.weapons.pistol > 0) p.weapon = "pistol";
  if (game.consumeKey("Digit3") && p.weapons.smg > 0) p.weapon = "smg";
  if (game.consumeKey("Digit4") && p.weapons.shotgun > 0) p.weapon = "shotgun";
}

export function enterCar(p, v, game) {
  if (v.driver === "traffic" || v.driver === "police") {
    v.driver = null; // carjacking: the driver is gone
    game.onCarjack(v);
  }
  v.driver = "player";
  p.inCar = v;
  sfx.enterCar();
  game.onEnterCar(v);
}

export function exitCar(p, game, forced) {
  const v = p.inCar;
  if (!v) return;
  v.driver = null;
  v.speed *= 0.4;
  const side = v.angle + Math.PI / 2;
  p.x = v.x + Math.cos(side) * 26;
  p.y = v.y + Math.sin(side) * 26;
  p.inCar = null;
  if (!forced) sfx.door();
  game.onExitCar(v);
}

// Armor absorbs 60% of incoming damage before health takes the rest.
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
export function healPlayer(p, amt) { p.health = Math.min(CFG.MAX_HEALTH, p.health + amt); }

export function currentWeapon(p) { return WEAPONS[p.weapon]; }

export function drawPlayer(ctx, p) {
  if (p.inCar) return; // the car sprite carries the player
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
  const armed = p.weapon !== "fists";
  drawPerson(ctx, p.x, p.y, p.aimAngle, "#1a5276", "#f1c27d", { armed });
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
