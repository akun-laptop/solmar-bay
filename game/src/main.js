// SOLMAR BAY — the game loop, state machine, world rendering and wiring.
// Modes: menu (ambient city pan behind the title), playing, paused, dead,
// busted. This file owns the central `game` object every system talks to.
import { CFG, PAL } from "./config.js";
import { clamp, rand, pick, dist2, fmtMoney } from "./utils.js";
import { initInput, isDown, consumePress, endFrame, mouse } from "./input.js";
import { initAudio, resumeAudio, sfx, setEngine, startMusic, setMuted, isMuted } from "./audio.js";
import { generateCity, city, nearestRoadPoint } from "./city.js";
import { drawBuilding, drawTree, drawLamp } from "./sprites.js";
import { camera, initCamera, updateCamera, applyCamera, releaseCamera } from "./camera.js";
import { createPlayer, updatePlayer, damagePlayer, healPlayer, drawPlayer } from "./player.js";
import { vehicles, spawnVehicle, updateVehicles, maintainTraffic, seedParkedCars, drawVehicles, driveVehicle } from "./vehicles.js";
import { pedestrians, spawnPed, updatePeds, maintainPeds, drawPeds, scarePeds } from "./pedestrians.js";
import { cops, copCars, updatePolice, damageCop, drawCops, clearPolice } from "./police.js";
import { bullets, fireWeapon, updateBullets, drawBullets } from "./combat.js";
import { createMissionState, currentMission, currentObjective, startMission, updateMissions } from "./missions.js";
import { initHud, showHud, updateHud, showToast, showBanner, showDialogue, advanceDialogue } from "./hud.js";
import { updateEffects, drawEffects, addFloater, addShake, shakeOffset } from "./effects.js";
import { hasSave, saveGame, loadGame } from "./save.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------------- Central game state ----------------
const game = {
  mode: "menu",
  player: null,
  missions: createMissionState(),
  wanted: 0,
  wantedHiddenT: 0,
  money: CFG.START_MONEY,
  hour: CFG.START_HOUR,
  stats: { missionsDone: 0, kills: 0, carsStolen: 0, playTime: 0 },
  collectibles: [],
  cops, copCars,
  danger: null,
  demoMode: null,
  consumeKey(code) { return consumePress(code); },
  onCarjack(v) {
    game.stats.carsStolen++;
    scarePeds(v.x, v.y, 120);
    if (game.wanted < 1 && Math.random() < 0.6) game.setWanted(1);
    showToast("Car stolen! The VCPD is watching…");
  },
  onEnterCar() { setEngine(true, 0); },
  onExitCar() { setEngine(false, 0); },
  onGunshot(x, y) {
    game.danger = { x, y, r: 300 };
    if (game.wanted < 1) game.setWanted(1);
    else if (game.wanted < 2 && Math.random() < 0.3) game.setWanted(2);
  },
  onPedKilled(ped) {
    game.stats.kills++;
    game.setWanted(Math.max(game.wanted, 2));
    addFloater(ped.x, ped.y, "WASTED", "#ff3b30");
  },
  damageCop(cop, dmg) {
    damageCop(cop, dmg);
    if (cop.dead) {
      game.stats.kills++;
      game.setWanted(Math.min(5, game.wanted + 1));
      addFloater(cop.x, cop.y, "COP DOWN", "#ff3b30");
    }
  },
  damagePlayer(dmg) {
    damagePlayer(game.player, dmg);
    addShake(4, 0.15);
    if (game.player.dead) onPlayerDead();
  },
  setWanted(n) {
    const old = game.wanted;
    game.wanted = clamp(n, 0, CFG.WANTED_MAX);
    if (game.wanted > old) sfx.star();
  },
  onBusted() {
    if (game.mode !== "playing" || game.player.dead) return;
    game.mode = "busted";
    game.money = Math.max(0, game.money - CFG.BAIL_COST);
    showEndScreen("BUSTED", "The VCPD caught you. Bail set at $500.");
    sfx.missionFail();
  },
  showToast, showBanner, showDialogue,
  showMissionComplete(m) {
    const el = document.getElementById("mission-complete");
    document.getElementById("mc-name").textContent = m.name;
    document.getElementById("mc-reward").textContent = "+" + fmtMoney(m.reward);
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3200);
  },
};

// ---------------- Setup ----------------
generateCity();
initInput(canvas);
initHud();

function newGame(saved) {
  clearPolice();
  vehicles.length = 0;
  pedestrians.length = 0;
  bullets.length = 0;
  game.missions = createMissionState();
  game.wanted = 0;
  game.wantedHiddenT = 0;
  game.money = CFG.START_MONEY;
  game.hour = CFG.START_HOUR;
  game.stats = { missionsDone: 0, kills: 0, carsStolen: 0, playTime: 0 };
  game.collectibles = [];
  game.demoMode = null;
  const start = city.spawns.playerStart;
  game.player = createPlayer(start.x, start.y);
  if (saved) {
    game.money = saved.money ?? CFG.START_MONEY;
    game.missions.index = saved.missionIndex ?? 0;
    game.missions.completed = saved.completedMissions ?? [];
    game.player.x = saved.player?.x ?? start.x;
    game.player.y = saved.player?.y ?? start.y;
    game.player.health = saved.player?.health ?? 100;
    game.player.armor = saved.player?.armor ?? 0;
    if (saved.weapons) game.player.weapons = saved.weapons;
    game.hour = saved.hour ?? CFG.START_HOUR;
    game.stats = saved.stats ?? game.stats;
  }
  seedParkedCars();
  spawnVehicle("sports", start.x + 60, start.y + 30, 0, { driver: null, color: "#2980b9" });
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), d = rand(100, 700);
    spawnPed(clamp(start.x + Math.cos(a) * d, 40, CFG.WORLD_W - 40), clamp(start.y + Math.sin(a) * d, 40, CFG.WORLD_H - 40));
  }
  for (let i = 0; i < 8; i++) {
    const r = pick(city.roadsH);
    spawnVehicle(pick(["sedan", "sedan", "taxi", "sports"]), rand(200, CFG.WORLD_W - 200), r.y, pick([0, Math.PI]), { driver: "traffic" });
  }
  for (let i = 0; i < 10; i++) {
    game.collectibles.push({
      x: rand(150, CFG.WORLD_W - 150),
      y: rand(150, city.beachY - 150),
      taken: !!(saved?.collectibles?.[i]?.taken),
    });
  }
  initCamera(game.player.x, game.player.y);
}

// ---------------- Screens ----------------
const startScreen = document.getElementById("start-screen");
const pauseScreen = document.getElementById("pause-screen");
const endScreen = document.getElementById("end-screen");

function showEndScreen(title, sub) {
  document.getElementById("end-title").textContent = title;
  document.getElementById("end-sub").textContent = sub;
  endScreen.classList.remove("hidden");
  showHud(false);
  setEngine(false, 0);
}
function onPlayerDead() {
  game.mode = "dead";
  showEndScreen("WASTED", "Rico didn't make it. The bay moves on.");
  sfx.missionFail();
}

function startPlaying(saved) {
  initAudio(); resumeAudio(); startMusic();
  newGame(saved);
  startScreen.classList.add("hidden");
  game.mode = "playing";
  showHud(true);
}
document.getElementById("btn-new").addEventListener("click", () => {
  startPlaying(null);
  showBanner("SOLMAR BAY");
  setTimeout(() => showToast("Press M to start your first mission"), 1800);
  sfx.click();
});
document.getElementById("btn-continue").addEventListener("click", () => {
  startPlaying(loadGame());
  showToast("Welcome back to Solmar Bay");
  sfx.click();
});
document.getElementById("btn-controls").addEventListener("click", () => {
  document.getElementById("controls-panel").classList.toggle("hidden");
  sfx.click();
});
document.getElementById("btn-resume").addEventListener("click", () => {
  pauseScreen.classList.add("hidden");
  game.mode = "playing";
  sfx.click();
});
document.getElementById("btn-save").addEventListener("click", () => {
  const ok = saveGame(game);
  document.getElementById("pause-stats").textContent = ok ? "Game saved." : "Save failed (storage unavailable).";
  sfx.pickup();
});
document.getElementById("btn-quit").addEventListener("click", () => {
  saveGame(game);
  pauseScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  game.mode = "menu";
  showHud(false);
  refreshContinueButton();
  sfx.click();
});
document.getElementById("btn-retry").addEventListener("click", () => {
  endScreen.classList.add("hidden");
  newGame(null);
  game.mode = "playing";
  showHud(true);
  sfx.click();
});
document.getElementById("btn-title").addEventListener("click", () => {
  endScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  game.mode = "menu";
  refreshContinueButton();
  sfx.click();
});
function refreshContinueButton() {
  document.getElementById("btn-continue").classList.toggle("hidden", !hasSave());
}
refreshContinueButton();

// ---------------- World rendering ----------------
const LOCATION_LABELS = {
  safehouse: "MARA'S YARD", paynspray: "PAY 'N SPRAY", ammunation: "AMMU-NATION",
  hospital: "GENERAL HOSPITAL", marina: "MARINA", docks: "PORTSIDE DOCKS", airfield: "SOLMAR AIRFIELD",
};

function drawWorld() {
  const night = game.hour < 6 || game.hour > 19.5;
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(0, 0, CFG.WORLD_W, CFG.WORLD_H);
  ctx.fillStyle = PAL.grassDark;
  for (let x = 0; x < CFG.WORLD_W; x += 400) {
    for (let y = 0; y < city.beachY; y += 400) {
      if (((x * 31 + y * 17) % 100) / 100 < 0.4) ctx.fillRect(x + 40, y + 40, 180, 140);
    }
  }
  // beach + water
  ctx.fillStyle = PAL.sand;
  ctx.fillRect(0, city.beachY - 60, CFG.WORLD_W, 110);
  ctx.fillStyle = PAL.water;
  ctx.fillRect(0, city.beachY + 50, CFG.WORLD_W, CFG.WORLD_H - city.beachY - 50);
  ctx.fillStyle = PAL.waterDeep;
  for (let x = 0; x < CFG.WORLD_W; x += 90) {
    ctx.fillRect(x + ((Date.now() / 40 + x) % 90), city.beachY + 80 + (x % 3) * 30, 40, 3);
  }
  // parks and parking lots
  for (const z of city.zones) {
    if (z.kind === "park") {
      ctx.fillStyle = PAL.park;
      ctx.fillRect(z.x, z.y, z.w, z.h);
    } else {
      ctx.fillStyle = "#55555e";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "#ddd";
      ctx.lineWidth = 1;
      for (let px = z.x + 12; px < z.x + z.w - 8; px += 24) {
        ctx.beginPath(); ctx.moveTo(px, z.y + 8); ctx.lineTo(px, z.y + z.h - 8); ctx.stroke();
      }
    }
  }
  // roads + sidewalks + lane dashes
  for (const r of city.roadsH) {
    ctx.fillStyle = PAL.road;
    ctx.fillRect(r.x0, r.y - CFG.ROAD_W / 2, r.x1 - r.x0, CFG.ROAD_W);
  }
  for (const r of city.roadsV) {
    ctx.fillStyle = PAL.road;
    ctx.fillRect(r.x - CFG.ROAD_W / 2, r.y0, CFG.ROAD_W, r.y1 - r.y0);
  }
  ctx.fillStyle = PAL.sidewalk;
  for (const r of city.roadsH) {
    ctx.fillRect(r.x0, r.y - CFG.ROAD_W / 2 - 8, r.x1 - r.x0, 8);
    ctx.fillRect(r.x0, r.y + CFG.ROAD_W / 2, r.x1 - r.x0, 8);
  }
  for (const r of city.roadsV) {
    ctx.fillRect(r.x - CFG.ROAD_W / 2 - 8, r.y0, 8, r.y1 - r.y0);
    ctx.fillRect(r.x + CFG.ROAD_W / 2, r.y0, 8, r.y1 - r.y0);
  }
  ctx.strokeStyle = PAL.lane;
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 20]);
  for (const r of city.roadsH) {
    ctx.beginPath(); ctx.moveTo(r.x0, r.y); ctx.lineTo(r.x1, r.y); ctx.stroke();
  }
  for (const r of city.roadsV) {
    ctx.beginPath(); ctx.moveTo(r.x, r.y0); ctx.lineTo(r.x, r.y1); ctx.stroke();
  }
  ctx.setLineDash([]);
  // buildings, trees, lamps (culled to the camera view)
  for (const b of city.buildings) {
    if (Math.abs(b.x - camera.x) > 1100 || Math.abs(b.y - camera.y) > 800) continue;
    drawBuilding(ctx, b);
  }
  for (const t of city.trees) {
    if (Math.abs(t.x - camera.x) > 1000 || Math.abs(t.y - camera.y) > 750) continue;
    drawTree(ctx, t.x, t.y, t.kind);
  }
  for (const l of city.lamps) {
    if (Math.abs(l.x - camera.x) > 1000 || Math.abs(l.y - camera.y) > 750) continue;
    drawLamp(ctx, l.x, l.y, night);
  }
  // pulsing mission target marker
  const obj = currentObjective(game.missions);
  if (obj && obj.type === "goto" && game.missions.active) {
    const pulse = 1 + Math.sin(Date.now() / 250) * 0.15;
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(255,215,0,0.25)";
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd700";
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(8, 8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // cash stash collectibles
  for (const c of game.collectibles) {
    if (c.taken) continue;
    if (Math.abs(c.x - camera.x) > 1000 || Math.abs(c.y - camera.y) > 750) continue;
    ctx.fillStyle = "#7cf29c";
    ctx.beginPath(); ctx.arc(c.x, c.y, 8 + Math.sin(Date.now() / 300) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("$", c.x, c.y + 3);
  }
  // location labels
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (const [key, label] of Object.entries(LOCATION_LABELS)) {
    const s = city.spawns[key];
    if (!s) continue;
    if (Math.abs(s.x - camera.x) > 900 || Math.abs(s.y - camera.y) > 650) continue;
    ctx.fillText(label, s.x, s.y - 30);
  }
  if (night) {
    ctx.fillStyle = "rgba(10,10,50,0.28)";
    ctx.fillRect(camera.x - 800, camera.y - 500, 1600, 1000);
  }
}

// ---------------- Wanted decay ----------------
// Stay out of every cop's sight for a while and a star drops off.
function updateWanted(dt) {
  if (game.wanted <= 0) return;
  const p = game.player;
  let seen = false;
  for (const c of cops) if (!c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 420) { seen = true; break; }
  if (!seen) for (const v of copCars) if (!v.dead && Math.hypot(v.x - p.x, v.y - p.y) < 460) { seen = true; break; }
  if (seen) { game.wantedHiddenT = 0; return; }
  game.wantedHiddenT += dt;
  const need = game.wanted <= 2 ? CFG.HIDE_TIME : CFG.HIDE_TIME_HIGH;
  if (game.wantedHiddenT >= need) {
    game.setWanted(game.wanted - 1);
    game.wantedHiddenT = 0;
    if (game.wanted === 0) showToast("You lost the cops.");
  }
}

// ---------------- Demo mode (for screenshots) ----------------
// ?demo=chase|foot|mission auto-starts a scenario; the autopilot drives
// the player's car along roads so chase shots show real motion.
let stuckT = 0, reverseT = 0;
function demoAutopilot(dt) {
  const p = game.player;
  if (!game.demoMode || !p.inCar) return;
  const v = p.inCar;
  if (Math.abs(v.speed) < 30) stuckT += dt; else stuckT = 0;
  if (stuckT > 1) { reverseT = 0.7; stuckT = 0; }
  if (reverseT > 0) {
    reverseT -= dt;
    driveVehicle(v, dt, -1, 1, false);
    p.x = v.x; p.y = v.y; p.angle = v.angle;
    return;
  }
  const ahead = { x: v.x + Math.cos(v.angle) * 220, y: v.y + Math.sin(v.angle) * 220 };
  const rp = nearestRoadPoint(ahead.x, ahead.y);
  // traffic avoidance: check the whole corridor ahead, not one probe
  // point — a car already tailgated sits between the car and the probe
  // and a point check misses it entirely
  const hx = Math.cos(v.angle), hy = Math.sin(v.angle);
  let blocked = false;
  for (const o of vehicles) {
    if (o === v || o.dead) continue;
    const dx = o.x - v.x, dy = o.y - v.y;
    const along = dx * hx + dy * hy;            // distance ahead
    const side = Math.abs(dx * -hy + dy * hx);  // lateral distance
    if (along > 20 && along < 140 && side < 40) { blocked = true; break; }
  }
  let tx = rp.x, ty = rp.y;
  if (blocked) {
    const perp = Math.atan2(rp.y - v.y, rp.x - v.x) + Math.PI / 2;
    tx = rp.x + Math.cos(perp) * 55;
    ty = rp.y + Math.sin(perp) * 55;
  }
  const want = Math.atan2(ty - v.y, tx - v.x);
  const diff = ((want - v.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  driveVehicle(v, dt, 1, Math.max(-1, Math.min(1, diff * 2.5)), false);
  p.x = v.x; p.y = v.y; p.angle = v.angle;
}

window.__solmar = {
  game,
  startDemo(mode) {
    newGame(null);
    game.mode = "playing";
    showHud(true);
    startScreen.classList.add("hidden");
    game.demoMode = mode;
    if (mode === "chase") {
      const p = game.player;
      const v = spawnVehicle("sports", p.x, p.y, 0, { driver: "player", color: "#e74c3c" });
      p.inCar = v;
      v.speed = 260;
      game.setWanted(3);
      // three pursuit cars trail behind on the same road, visible in frame
      for (let i = 0; i < 3; i++) {
        const cv = spawnVehicle("police", p.x - 140 - i * 90, p.y + (i - 1) * 26, 0, { driver: "police" });
        cv.speed = 240;
        copCars.push(cv);
        // demo pursuit: trail 150px behind the player instead of ramming,
        // so the chase stays visible instead of pinning the car down
        cv.policeAI = ((veh) => (dt) => {
          const pl = game.player;
          const tx = pl.x - Math.cos(pl.angle) * 150, ty = pl.y - Math.sin(pl.angle) * 150;
          const want = Math.atan2(ty - veh.y, tx - veh.x);
          const diff = ((want - veh.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          driveVehicle(veh, dt, 1, Math.max(-1, Math.min(1, diff * 2.6)), false);
        })(cv);
      }
      game.missions.index = 4;
      startMission(game.missions, game);
    } else if (mode === "foot") {
      game.missions.index = 0;
      startMission(game.missions, game);
    } else if (mode === "mission") {
      game.missions.index = 1;
      startMission(game.missions, game);
      const p = game.player;
      const v = spawnVehicle("sedan", p.x + 40, p.y, 0, { driver: "player", color: "#2980b9" });
      p.inCar = v;
      v.speed = 180; // rolling start so the car is moving, not boxed in
    }
    return game;
  },
};

const demoParam = new URLSearchParams(location.search).get("demo");
if (demoParam) setTimeout(() => window.__solmar.startDemo(demoParam), 300);

// ---------------- Main loop ----------------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (game.mode === "menu") {
    const t = now / 1000;
    camera.x = 1300 + Math.sin(t * 0.05) * 500;
    camera.y = 1000 + Math.cos(t * 0.04) * 300;
    camera.zoom = 0.7;
    ctx.fillStyle = "#07070f";
    ctx.fillRect(0, 0, 1280, 720);
    applyCamera(ctx, null);
    drawWorld();
    releaseCamera(ctx);
    endFrame();
    return;
  }
  if (game.mode === "paused") { endFrame(); return; }
  if (game.mode === "dead" || game.mode === "busted") {
    render(dt);
    endFrame();
    return;
  }

  // ---- playing ----
  const p = game.player;
  game.stats.playTime += dt;
  game.hour = (game.hour + dt * 24 / CFG.DAY_LENGTH) % 24;

  if (consumePress("Escape") || consumePress("KeyP")) {
    game.mode = "paused";
    document.getElementById("pause-stats").textContent =
      `Missions: ${game.stats.missionsDone}/6 · Kills: ${game.stats.kills} · Cars stolen: ${game.stats.carsStolen} · Cash: ${fmtMoney(game.money)}`;
    pauseScreen.classList.remove("hidden");
    setEngine(false, 0);
    endFrame();
    return;
  }
  if (consumePress("KeyM")) {
    if (isDown("ShiftLeft")) setMuted(!isMuted());
    else if (!game.missions.active && currentMission(game.missions)) startMission(game.missions, game);
    else setMuted(!isMuted());
  }
  if (consumePress("Space") && !p.inCar) advanceDialogue();

  if (!p.inCar && (mouse.clicked || (mouse.down && p.weapon === "smg"))) {
    fireWeapon(p, game);
  }

  updatePlayer(p, dt, game);
  if (game.demoMode) demoAutopilot(dt);
  updateVehicles(dt, p);
  updatePeds(dt, p, game.danger);
  updatePolice(dt, game);
  updateBullets(dt, game);
  updateMissions(game.missions, game);
  updateEffects(dt);
  updateWanted(dt);
  maintainTraffic(p);
  maintainPeds(p);
  game.danger = null;

  for (const c of game.collectibles) {
    if (!c.taken && dist2(p.x, p.y, c.x, c.y) < 26 * 26) {
      c.taken = true;
      game.money += CFG.STASH_VALUE;
      sfx.cash();
      addFloater(c.x, c.y, "+$100 stash", "#7cf29c");
    }
  }
  const pns = city.spawns.paynspray;
  if (p.inCar && game.wanted > 0 && dist2(p.x, p.y, pns.x, pns.y) < 70 * 70) {
    game.setWanted(0);
    game.money = Math.max(0, game.money - CFG.SPRAY_COST);
    p.inCar.hp = p.inCar.def.hp;
    showToast("Pay 'n Spray — heat cleared, car fixed (-$50)");
    sfx.cash();
  }
  const hosp = city.spawns.hospital;
  if (!p.inCar && dist2(p.x, p.y, hosp.x, hosp.y) < 70 * 70 && p.health < CFG.MAX_HEALTH) {
    healPlayer(p, 40 * dt);
  }
  if (p.inCar) setEngine(true, Math.abs(p.inCar.speed) / p.inCar.def.top);
  else setEngine(false, 0);

  updateCamera(dt, p.x, p.y, !!p.inCar);
  render(dt);
  updateHud(game);
  endFrame();
}

function render(dt) {
  ctx.fillStyle = "#07070f";
  ctx.fillRect(0, 0, 1280, 720);
  const shake = shakeOffset(dt);
  applyCamera(ctx, shake);
  drawWorld();
  drawPeds(ctx, camera);
  drawVehicles(ctx, camera);
  drawCops(ctx, camera);
  drawPlayer(ctx, game.player);
  drawBullets(ctx);
  drawEffects(ctx);
  releaseCamera(ctx);
}

requestAnimationFrame(frame);
