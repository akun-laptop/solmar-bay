// SOLMAR BAY — game loop, state machine, world rendering, wiring
import { CFG, PAL } from "./config.js";
import { clamp, rand, pick, dist2, fmtMoney } from "./utils.js";
import { initInput, isDown, consumePress, endFrame, mouse } from "./input.js";
import { initAudio, resumeAudio, sfx, setEngine, startMusic, setMuted, isMuted } from "./audio.js";
import { generateCity, city, districtAt, onRoad, nearestRoadPoint } from "./city.js";
import { drawBuilding, drawTree, drawLamp, shade } from "./sprites.js";
import { camera, initCamera, updateCamera, applyCamera, releaseCamera, screenToWorld } from "./camera.js";
import { createPlayer, updatePlayer, damagePlayer, healPlayer, drawPlayer } from "./player.js";
import { vehicles, spawnVehicle, updateVehicles, maintainTraffic, seedParkedCars, drawVehicles, nearestVehicle, damageVehicle, driveVehicle } from "./vehicles.js";
import { pedestrians, spawnPed, updatePeds, maintainPeds, drawPeds, scarePeds } from "./pedestrians.js";
import { cops, copCars, updatePolice, damageCop, drawCops, clearPolice, spawnCopCar } from "./police.js";
import { bullets, fireWeapon, updateBullets, drawBullets } from "./combat.js";
import { MISSIONS, createMissionState, currentMission, currentObjective, startMission, updateMissions, failMission } from "./missions.js";
import { initHud, showHud, updateHud, showToast, showBanner, showDialogue, advanceDialogue } from "./hud.js";
import { updateEffects, drawEffects, explosion, addFloater, addShake, shakeOffset } from "./effects.js";
import { hasSave, saveGame, loadGame, clearSave } from "./save.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// ---------------- Game state ----------------
const state = {
  mode: "menu",          // menu | playing | paused | dead | busted
  player: null,
  missions: createMissionState(),
  wanted: 0,
  wantedHiddenT: 0,
  money: CFG.START_MONEY,
  hour: CFG.START_HOUR,
  stats: { missionsDone: 0, kills: 0, carsStolen: 0, distance: 0, playTime: 0 },
  collectibles: [],
  cops, copCars,
  danger: null,
  lastFrame: 0,
  keys: {},
  consumeKey(code) { return consumePress(code); },
  onCarjack(v) {
    state.stats.carsStolen++;
    scarePeds(v.x, v.y, 120);
    if (state.wanted < 1 && Math.random() < 0.6) state.setWanted(1);
    showToast("Car stolen! The VCPD is watching…");
  },
  onEnterCar(v) { setEngine(true, 0); },
  onExitCar(v) { setEngine(false, 0); },
  onGunshot(x, y) {
    state.danger = { x, y, r: 300 };
    if (state.wanted < 1) state.setWanted(1);
    else if (state.wanted < 2 && Math.random() < 0.3) state.setWanted(2);
  },
  onPedKilled(ped) {
    state.stats.kills++;
    state.setWanted(Math.max(state.wanted, 2));
    addFloater(ped.x, ped.y, "WASTED", "#ff3b30");
  },
  damageCop(cop, dmg) {
    damageCop(cop, dmg);
    if (cop.dead) {
      state.stats.kills++;
      state.setWanted(Math.min(5, state.wanted + 1));
      addFloater(cop.x, cop.y, "COP DOWN", "#ff3b30");
    }
  },
  damagePlayer(dmg) {
    damagePlayer(state.player, dmg);
    addShake(4, 0.15);
    if (state.player.dead) onPlayerDead("wasted");
  },
  setWanted(n) {
    const old = state.wanted;
    state.wanted = clamp(n, 0, CFG.WANTED_MAX);
    if (state.wanted > old) sfx.star();
  },
  onBusted() {
    if (state.mode !== "playing" || state.player.dead) return;
    state.mode = "busted";
    showEndScreen("BUSTED", "The VCPD caught you. Bail set at $500.");
    state.money = Math.max(0, state.money - 500);
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
  state.missions = createMissionState();
  state.wanted = 0;
  state.money = CFG.START_MONEY;
  state.hour = CFG.START_HOUR;
  state.stats = { missionsDone: 0, kills: 0, carsStolen: 0, distance: 0, playTime: 0 };
  state.collectibles = [];
  const start = city.spawns.playerStart;
  state.player = createPlayer(start.x, start.y);
  if (saved) {
    state.money = saved.money ?? CFG.START_MONEY;
    state.missions.index = saved.missionIndex ?? 0;
    state.missions.completed = saved.completedMissions ?? [];
    state.player.x = saved.player?.x ?? start.x;
    state.player.y = saved.player?.y ?? start.y;
    state.player.health = saved.player?.health ?? 100;
    state.player.armor = saved.player?.armor ?? 0;
    if (saved.weapons) state.player.weapons = saved.weapons;
    state.hour = saved.hour ?? CFG.START_HOUR;
    state.stats = saved.stats ?? state.stats;
    state.collectibles = saved.collectibles ?? [];
  }
  seedParkedCars();
  // starter car near spawn
  spawnVehicle("sports", start.x + 60, start.y + 30, 0, { driver: null, color: "#2980b9" });
  // initial peds + traffic
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), d = rand(100, 700);
    spawnPed(clamp(start.x + Math.cos(a) * d, 40, CFG.WORLD_W - 40), clamp(start.y + Math.sin(a) * d, 40, CFG.WORLD_H - 40));
  }
  for (let i = 0; i < 8; i++) {
    const r = pick(city.roadsH);
    spawnVehicle(pick(["sedan", "sedan", "taxi", "sports"]), rand(200, CFG.WORLD_W - 200), r.y, pick([0, Math.PI]), { driver: "traffic" });
  }
  // collectibles: 10 hidden cash stashes
  for (let i = 0; i < 10; i++) {
    state.collectibles.push({ x: rand(150, CFG.WORLD_W - 150), y: rand(150, city.beachY - 150), taken: (saved?.collectibles?.[i]?.taken) || false });
  }
  initCamera(state.player.x, state.player.y);
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
function onPlayerDead(cause) {
  state.mode = "dead";
  showEndScreen("WASTED", cause === "wasted" ? "Rico didn't make it. The bay moves on." : "Game over.");
  sfx.missionFail();
}

document.getElementById("btn-new").addEventListener("click", () => {
  initAudio(); resumeAudio(); startMusic();
  newGame(null);
  startScreen.classList.add("hidden");
  state.mode = "playing";
  showHud(true);
  showBanner("SOLMAR BAY");
  setTimeout(() => showToast("Press M to start your first mission"), 1800);
  sfx.click();
});
document.getElementById("btn-continue").addEventListener("click", () => {
  initAudio(); resumeAudio(); startMusic();
  newGame(loadGame());
  startScreen.classList.add("hidden");
  state.mode = "playing";
  showHud(true);
  showToast("Welcome back to Solmar Bay");
  sfx.click();
});
document.getElementById("btn-controls").addEventListener("click", () => {
  document.getElementById("controls-panel").classList.toggle("hidden");
  sfx.click();
});
document.getElementById("btn-resume").addEventListener("click", () => {
  pauseScreen.classList.add("hidden");
  state.mode = "playing";
  sfx.click();
});
document.getElementById("btn-save").addEventListener("click", () => {
  const ok = saveGame(state);
  document.getElementById("pause-stats").textContent = ok ? "Game saved." : "Save failed (storage unavailable).";
  sfx.pickup();
});
document.getElementById("btn-quit").addEventListener("click", () => {
  saveGame(state);
  pauseScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  state.mode = "menu";
  showHud(false);
  refreshContinueButton();
  sfx.click();
});
document.getElementById("btn-retry").addEventListener("click", () => {
  endScreen.classList.add("hidden");
  newGame(null);
  state.mode = "playing";
  showHud(true);
  sfx.click();
});
document.getElementById("btn-title").addEventListener("click", () => {
  endScreen.classList.add("hidden");
  startScreen.classList.remove("hidden");
  state.mode = "menu";
  refreshContinueButton();
  sfx.click();
});
function refreshContinueButton() {
  document.getElementById("btn-continue").classList.toggle("hidden", !hasSave());
}
refreshContinueButton();

// ---------------- World rendering ----------------
function drawWorld(dt) {
  const night = state.hour < 6 || state.hour > 19.5;
  // ground
  ctx.fillStyle = PAL.grass;
  ctx.fillRect(0, 0, CFG.WORLD_W, CFG.WORLD_H);
  // grass variation patches
  ctx.fillStyle = PAL.grassDark;
  for (let x = 0; x < CFG.WORLD_W; x += 400) {
    for (let y = 0; y < city.beachY; y += 400) {
      const h = ((x * 31 + y * 17) % 100) / 100;
      if (h < 0.4) ctx.fillRect(x + 40, y + 40, 180, 140);
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
  // parks
  for (const z of city.zones) {
    if (z.kind === "park") {
      ctx.fillStyle = PAL.park;
      ctx.fillRect(z.x, z.y, z.w, z.h);
    } else if (z.kind === "parking") {
      ctx.fillStyle = "#55555e";
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = "#ddd";
      ctx.lineWidth = 1;
      for (let px = z.x + 12; px < z.x + z.w - 8; px += 24) {
        ctx.beginPath(); ctx.moveTo(px, z.y + 8); ctx.lineTo(px, z.y + z.h - 8); ctx.stroke();
      }
    }
  }
  // roads
  for (const r of city.roadsH) {
    ctx.fillStyle = PAL.road;
    ctx.fillRect(r.x0, r.y - CFG.ROAD_W / 2, r.x1 - r.x0, CFG.ROAD_W);
  }
  for (const r of city.roadsV) {
    ctx.fillStyle = PAL.road;
    ctx.fillRect(r.x - CFG.ROAD_W / 2, r.y0, CFG.ROAD_W, r.y1 - r.y0);
  }
  // lane dashes
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
  // sidewalks
  ctx.fillStyle = PAL.sidewalk;
  for (const r of city.roadsH) {
    ctx.fillRect(r.x0, r.y - CFG.ROAD_W / 2 - 8, r.x1 - r.x0, 8);
    ctx.fillRect(r.x0, r.y + CFG.ROAD_W / 2, r.x1 - r.x0, 8);
  }
  for (const r of city.roadsV) {
    ctx.fillRect(r.x - CFG.ROAD_W / 2 - 8, r.y0, 8, r.y1 - r.y0);
    ctx.fillRect(r.x + CFG.ROAD_W / 2, r.y0, 8, r.y1 - r.y0);
  }
  // buildings
  for (const b of city.buildings) {
    if (Math.abs(b.x - camera.x) > 1100 || Math.abs(b.y - camera.y) > 800) continue;
    drawBuilding(ctx, b, 0);
  }
  // trees + lamps
  for (const t of city.trees) {
    if (Math.abs(t.x - camera.x) > 1000 || Math.abs(t.y - camera.y) > 750) continue;
    drawTree(ctx, t.x, t.y, t.kind);
  }
  for (const l of city.lamps) {
    if (Math.abs(l.x - camera.x) > 1000 || Math.abs(l.y - camera.y) > 750) continue;
    drawLamp(ctx, l.x, l.y, night);
  }
  // mission markers
  const obj = currentObjective(state.missions);
  if (obj && obj.type === "goto" && state.missions.active) {
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
  // collectibles
  for (const c of state.collectibles) {
    if (c.taken) continue;
    if (Math.abs(c.x - camera.x) > 1000 || Math.abs(c.y - camera.y) > 750) continue;
    ctx.fillStyle = "#7cf29c";
    ctx.beginPath(); ctx.arc(c.x, c.y, 8 + Math.sin(Date.now() / 300) * 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("$", c.x, c.y + 3);
  }
  // named location labels (in-world names only)
  const LABELS = { safehouse: "MARA'S YARD", paynspray: "PAY 'N SPRAY", ammunation: "AMMU-NATION", hospital: "GENERAL HOSPITAL", marina: "MARINA", docks: "PORTSIDE DOCKS", airport: "SOLMAR AIRFIELD" };
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (const [key, label] of Object.entries(LABELS)) {
    const s = city.spawns[key];
    if (!s) continue;
    if (Math.abs(s.x - camera.x) > 900 || Math.abs(s.y - camera.y) > 650) continue;
    ctx.fillText(label, s.x, s.y - 30);
  }
  // night overlay
  if (night) {
    ctx.fillStyle = "rgba(10,10,50,0.28)";
    ctx.fillRect(camera.x - 800, camera.y - 500, 1600, 1000);
  }
}

// ---------------- Wanted decay ----------------
function updateWanted(dt) {
  if (state.wanted <= 0) return;
  // hidden = no cop within 420px and not recently violent
  const p = state.player;
  let seen = false;
  for (const c of cops) if (!c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 420) { seen = true; break; }
  if (!seen) for (const v of copCars) if (!v.dead && Math.hypot(v.x - p.x, v.y - p.y) < 460) { seen = true; break; }
  if (seen) { state.wantedHiddenT = 0; return; }
  state.wantedHiddenT += dt;
  const need = state.wanted <= 2 ? CFG.WANTED_DECAY_TIME : CFG.WANTED_DECAY_TIME * 2;
  if (state.wantedHiddenT >= need) {
    state.setWanted(state.wanted - 1);
    state.wantedHiddenT = 0;
    if (state.wanted === 0) showToast("You lost the cops.");
  }
}

// ---------------- Main loop ----------------
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (state.mode === "menu") {
    // ambient menu backdrop: slow pan over the city
    const t = now / 1000;
    camera.x = 1300 + Math.sin(t * 0.05) * 500;
    camera.y = 1000 + Math.cos(t * 0.04) * 300;
    camera.zoom = 0.7;
    ctx.fillStyle = "#0a0a12";
    ctx.fillRect(0, 0, 1280, 720);
    applyCamera(ctx, null);
    drawWorld(dt);
    releaseCamera(ctx);
    endFrame();
    return;
  }
  if (state.mode === "paused") { endFrame(); return; }
  if (state.mode === "dead" || state.mode === "busted") {
    // keep rendering the world behind the end screen
    render(dt);
    endFrame();
    return;
  }

  // ---- playing ----
  const p = state.player;
  state.stats.playTime += dt;
  state.hour = (state.hour + dt * 24 / CFG.DAY_LENGTH) % 24;

  // pause
  if (consumePress("Escape") || consumePress("KeyP")) {
    state.mode = "paused";
    document.getElementById("pause-stats").textContent =
      `Missions: ${state.stats.missionsDone}/6 · Kills: ${state.stats.kills} · Cars stolen: ${state.stats.carsStolen} · Cash: ${fmtMoney(state.money)}`;
    pauseScreen.classList.remove("hidden");
    setEngine(false, 0);
    endFrame();
    return;
  }
  // mute
  if (consumePress("KeyM") && !state.missions.active && currentMission(state.missions)) {
    // M starts a mission when one is available; mute is Shift+M
    if (isDown("ShiftLeft")) setMuted(!isMuted());
    else {
      startMission(state.missions, state);
    }
  } else if (consumePress("KeyM")) {
    setMuted(!isMuted());
  }
  // dialogue advance
  if (consumePress("Space") && !p.inCar) advanceDialogue();

  // firing
  const w = p.weapon;
  if (!p.inCar && (mouse.clicked || (mouse.down && (w === "smg")))) {
    fireWeapon(p, state);
  }

  updatePlayer(p, dt, state);
  if (state.demoMode) demoAutopilot(dt);
  updateVehicles(dt, p, cops);
  updatePeds(dt, p, state.danger);
  updatePolice(dt, state);
  updateBullets(dt, state);
  updateMissions(state.missions, state, dt);
  updateEffects(dt);
  updateWanted(dt);
  maintainTraffic(p);
  maintainPeds(p);
  if (state.danger) state.danger = null;

  // collectibles
  for (const c of state.collectibles) {
    if (!c.taken && dist2(p.x, p.y, c.x, c.y) < 26 * 26) {
      c.taken = true;
      state.money += 100;
      sfx.cash();
      addFloater(c.x, c.y, "+$100 stash", "#7cf29c");
    }
  }
  // pay'n'spray: clear wanted when inside the zone in a car
  const pns = city.spawns.paynspray;
  if (p.inCar && state.wanted > 0 && dist2(p.x, p.y, pns.x, pns.y) < 70 * 70) {
    state.setWanted(0);
    state.money = Math.max(0, state.money - 50);
    p.inCar.hp = p.inCar.def.hp;
    showToast("Pay 'n Spray — heat cleared, car fixed (-$50)");
    sfx.cash();
  }
  // hospital heal
  const hosp = city.spawns.hospital;
  if (!p.inCar && dist2(p.x, p.y, hosp.x, hosp.y) < 70 * 70 && p.health < CFG.PLAYER_MAX_HEALTH) {
    healPlayer(p, 40 * dt);
  }
  // engine sound
  if (p.inCar) setEngine(true, Math.abs(p.inCar.speed) / p.inCar.def.top);
  else setEngine(false, 0);

  updateCamera(dt, p.x, p.y, !!p.inCar);
  render(dt);
  updateHud(state);
  endFrame();
}

function render(dt) {
  ctx.fillStyle = "#0a0a12";
  ctx.fillRect(0, 0, 1280, 720);
  const shake = shakeOffset(dt);
  applyCamera(ctx, shake);
  drawWorld(dt);
  drawPeds(ctx, camera);
  drawVehicles(ctx, camera);
  drawCops(ctx, camera);
  drawPlayer(ctx, state.player);
  drawBullets(ctx);
  drawEffects(ctx);
  releaseCamera(ctx);
}

// Screenshot helper: deterministic demo states for captures (?demo=chase|foot|mission|city)
window.__solmar = {
  state,
  demoMode: null,
  startDemo(mode) {
    newGame(null);
    state.mode = "playing";
    showHud(true);
    startScreen.classList.add("hidden");
    state.demoMode = mode;
    window.__solmar.demoMode = mode;
    if (mode === "chase") {
      const p = state.player;
      const v = spawnVehicle("sports", p.x, p.y, 0, { driver: "player", color: "#e74c3c" });
      p.inCar = v;
      v.speed = 260;
      state.setWanted(3);
      // cops spawn close behind on the same road so the chase is visible
      for (let i = 0; i < 3; i++) {
        const cv = spawnVehicle("police", p.x - 140 - i * 90, p.y + (i - 1) * 26, 0, { driver: "police" });
        cv.speed = 240;
        cv.policeAI = null;
        // attach AI via the police module's spawner path
        const { cops: _c, copCars } = state;
        copCars.push(cv);
        // reuse makeCopCarAI through a direct import-free hook: police update handles cars in copCars
        // demo chase: trail 150px behind the player (visible pursuit, no pinning)
        cv.policeAI = ((veh) => (dt) => {
          const pl = state.player;
          const tx = pl.x - Math.cos(pl.angle) * 150, ty = pl.y - Math.sin(pl.angle) * 150;
          const want = Math.atan2(ty - veh.y, tx - veh.x);
          const diff = ((want - veh.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          driveVehicle(veh, dt, 1, Math.max(-1, Math.min(1, diff * 2.6)), false);
        })(cv);
      }
      state.missions.index = 4;
      startMission(state.missions, state);
    } else if (mode === "foot") {
      state.missions.index = 0;
      startMission(state.missions, state);
    } else if (mode === "mission") {
      state.missions.index = 1;
      startMission(state.missions, state);
      const p = state.player;
      const v = spawnVehicle("sedan", p.x + 40, p.y, 0, { driver: "player", color: "#2980b9" });
      p.inCar = v;
    }
    return state;
  },
};

// Demo autopilot: drives the player's car along roads (screenshot mode only)
let stuckT = 0, reverseT = 0;
function demoAutopilot(dt) {
  const mode = window.__solmar.demoMode;
  const p = state.player;
  if (!mode || !p.inCar) return;
  const v = p.inCar;
  // unstick: if barely moving for a second, reverse + turn briefly
  if (Math.abs(v.speed) < 30) stuckT += dt; else stuckT = 0;
  if (stuckT > 1) { reverseT = 0.7; stuckT = 0; }
  if (reverseT > 0) {
    reverseT -= dt;
    driveVehicle(v, dt, -1, 1, false);
    p.x = v.x; p.y = v.y; p.angle = v.angle;
    return;
  }
  // steer toward a point ahead on the road network
  const ahead = { x: v.x + Math.cos(v.angle) * 220, y: v.y + Math.sin(v.angle) * 220 };
  const rp = nearestRoadPoint(ahead.x, ahead.y);
  const want = Math.atan2(rp.y - v.y, rp.x - v.x);
  const diff = ((want - v.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  driveVehicle(v, dt, 1, Math.max(-1, Math.min(1, diff * 2.5)), false);
  p.x = v.x; p.y = v.y; p.angle = v.angle;
}

// Auto-start a demo from the URL (?demo=chase) — used for screenshots
const demoParam = new URLSearchParams(location.search).get("demo");
if (demoParam) {
  setTimeout(() => window.__solmar.startDemo(demoParam), 300);
}

requestAnimationFrame(frame);
