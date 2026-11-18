// SOLMAR BAY — combat: the player's weapons, police gunfire, bullets.
// A bullet is just a fast point with a range; hits are resolved against
// peds, cops, vehicles and the player each frame.
import { CFG, WEAPONS } from "./config.js";
import { collideBuildings } from "./city.js";
import { rand, dist2 } from "./utils.js";
import { currentWeapon } from "./player.js";
import { vehicles, damageVehicle } from "./vehicles.js";
import { pedestrians, damagePed, scarePeds } from "./pedestrians.js";
import { muzzle, blood, sparks, addShake } from "./effects.js";
import { sfx } from "./audio.js";

export const bullets = [];

export function fireWeapon(p, game) {
  const w = currentWeapon(p);
  if (p.fireCooldown > 0) return;
  if (w === WEAPONS.fists) {
    p.fireCooldown = 1 / w.rate;
    p.meleeT = 0.18;
    sfx.punch();
    const hx = p.x + Math.cos(p.aimAngle) * 26, hy = p.y + Math.sin(p.aimAngle) * 26;
    for (const ped of pedestrians) {
      if (!ped.dead && dist2(ped.x, ped.y, hx, hy) < 30 * 30) {
        if (damagePed(ped, w.damage, p.x, p.y)) game.onPedKilled(ped);
        blood(ped.x, ped.y);
      }
    }
    for (const cop of game.cops) {
      if (!cop.dead && dist2(cop.x, cop.y, hx, hy) < 30 * 30) {
        game.damageCop(cop, w.damage);
        blood(cop.x, cop.y);
      }
    }
    return;
  }
  if (p.weapons[p.weapon] <= 0) { sfx.click(); p.fireCooldown = 0.3; return; }
  p.weapons[p.weapon] -= 1;
  p.fireCooldown = 1 / w.rate;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const a = p.aimAngle + rand(-w.spread, w.spread);
    bullets.push({
      x: p.x + Math.cos(p.aimAngle) * 18,
      y: p.y + Math.sin(p.aimAngle) * 18,
      vx: Math.cos(a) * CFG.BULLET_SPEED,
      vy: Math.sin(a) * CFG.BULLET_SPEED,
      damage: w.damage,
      range: w.range,
      traveled: 0,
      fromPlayer: true,
    });
  }
  muzzle(p.x, p.y, p.aimAngle);
  if (p.weapon === "shotgun") sfx.shotgun(); else sfx.shoot();
  addShake(w.kick * 0.6, 0.08);
  scarePeds(p.x, p.y, 260);
  game.onGunshot(p.x, p.y);
}

// A foot cop takes a shot at the player.
export function copFire(cop, game) {
  const p = game.player;
  const a = Math.atan2(p.y - cop.y, p.x - cop.x) + rand(-0.09, 0.09);
  bullets.push({
    x: cop.x + Math.cos(a) * 16, y: cop.y + Math.sin(a) * 16,
    vx: Math.cos(a) * CFG.BULLET_SPEED, vy: Math.sin(a) * CFG.BULLET_SPEED,
    damage: 8, range: 420, traveled: 0, fromPlayer: false,
  });
  muzzle(cop.x, cop.y, a);
  sfx.shoot();
}

export function updateBullets(dt, game) {
  const p = game.player;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.traveled += CFG.BULLET_SPEED * dt;
    let dead = b.traveled > b.range;
    if (!dead && collideBuildings(b.x, b.y, 2)) { sparks(b.x, b.y); dead = true; }
    if (dead) { bullets.splice(i, 1); continue; }

    if (b.fromPlayer) {
      for (const ped of pedestrians) {
        if (!ped.dead && dist2(ped.x, ped.y, b.x, b.y) < 12 * 12) {
          if (damagePed(ped, b.damage, p.x, p.y)) game.onPedKilled(ped);
          blood(ped.x, ped.y);
          dead = true; break;
        }
      }
      if (dead) { bullets.splice(i, 1); continue; }
      for (const cop of game.cops) {
        if (!cop.dead && dist2(cop.x, cop.y, b.x, b.y) < 12 * 12) {
          game.damageCop(cop, b.damage);
          blood(cop.x, cop.y);
          dead = true; break;
        }
      }
      if (dead) { bullets.splice(i, 1); continue; }
      for (const v of vehicles) {
        if (v.dead || v === p.inCar) continue;
        if (dist2(v.x, v.y, b.x, b.y) < 26 * 26) {
          damageVehicle(v, b.damage);
          sparks(b.x, b.y);
          dead = true; break;
        }
      }
    } else {
      if (!p.dead && !p.inCar && dist2(p.x, p.y, b.x, b.y) < 12 * 12) {
        game.damagePlayer(b.damage);
        blood(p.x, p.y);
        dead = true;
      } else if (!p.dead && p.inCar && dist2(p.inCar.x, p.inCar.y, b.x, b.y) < 26 * 26) {
        damageVehicle(p.inCar, b.damage * 0.5);
        sparks(b.x, b.y);
        dead = true;
      }
    }
    if (dead) bullets.splice(i, 1);
  }
}

export function drawBullets(ctx) {
  ctx.strokeStyle = "#ffe66d";
  ctx.lineWidth = 2;
  for (const b of bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
