// SOLMAR BAY — the HUD: DOM readouts (stars, clock, cash, health, weapon,
// speed, objective) and a live canvas minimap with the mission target,
// police blips and the player arrow.
import { CFG } from "./config.js";
import { city } from "./city.js";
import { fmtMoney, fmtTime } from "./utils.js";
import { currentObjective, objectiveText, currentMission } from "./missions.js";

let els = {};
let minimapCtx = null;
let toastTimer = null;
let bannerTimer = null;
let dialogueQueue = [];
let dialogueTimer = null;

export function initHud() {
  els = {
    hud: document.getElementById("hud"),
    wanted: document.getElementById("wanted"),
    clock: document.getElementById("clock"),
    money: document.getElementById("money"),
    healthFill: document.getElementById("health-fill"),
    armorFill: document.getElementById("armor-fill"),
    weaponInfo: document.getElementById("weapon-info"),
    speedo: document.getElementById("speedo"),
    objective: document.getElementById("objective"),
    banner: document.getElementById("mission-banner"),
    toast: document.getElementById("toast"),
    dialogue: document.getElementById("dialogue"),
    dialogueSpeaker: document.getElementById("dialogue-speaker"),
    dialogueText: document.getElementById("dialogue-text"),
  };
  minimapCtx = document.getElementById("minimap").getContext("2d");
}

export function showHud(show) { els.hud.classList.toggle("hidden", !show); }

export function updateHud(game) {
  const p = game.player;
  els.wanted.textContent = "★".repeat(game.wanted) + "☆".repeat(5 - game.wanted);
  els.wanted.style.color = game.wanted >= 3 ? "#ff3b30" : "#ffd700";
  els.clock.textContent = fmtTime(game.hour);
  els.money.textContent = fmtMoney(game.money);
  els.healthFill.style.width = Math.max(0, p.health) + "%";
  els.armorFill.style.width = Math.max(0, p.armor) + "%";
  const w = p.weapon;
  const ammo = p.weapons[w];
  els.weaponInfo.textContent = w === "fists" ? "FISTS" : `${w.toUpperCase()} — ${ammo === Infinity ? "∞" : ammo}`;
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
    els.speedo.textContent = `${kmh} km/h · ${p.inCar.def.name}`;
  } else {
    els.speedo.textContent = "";
  }
  const obj = currentObjective(game.missions);
  const m = currentMission(game.missions);
  if (obj && game.missions.active) {
    els.objective.textContent = objectiveText(game.missions);
  } else if (m && !game.missions.active) {
    els.objective.textContent = `Next mission: ${m.name} — press M to start`;
  } else {
    els.objective.textContent = "All missions complete — free roam!";
  }
  els.objective.style.display = "block";
  drawMinimap(game);
}

function drawMinimap(game) {
  const c = minimapCtx;
  const W = 220, H = 160;
  const sx = W / CFG.WORLD_W, sy = H / CFG.WORLD_H;
  c.clearRect(0, 0, W, H);
  c.fillStyle = "#2d5a2a";
  c.fillRect(0, 0, W, H);
  c.fillStyle = "#1d5f8a";
  c.fillRect(0, city.beachY * sy, W, H - city.beachY * sy);
  c.strokeStyle = "#888";
  c.lineWidth = 2;
  for (const r of city.roadsH) {
    c.beginPath(); c.moveTo(r.x0 * sx, r.y * sy); c.lineTo(r.x1 * sx, r.y * sy); c.stroke();
  }
  for (const r of city.roadsV) {
    c.beginPath(); c.moveTo(r.x * sx, r.y0 * sy); c.lineTo(r.x * sx, r.y1 * sy); c.stroke();
  }
  const obj = currentObjective(game.missions);
  if (obj && obj.type === "goto") {
    c.fillStyle = "#ffd700";
    c.beginPath(); c.arc(obj.x * sx, obj.y * sy, 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#fff"; c.lineWidth = 1; c.stroke();
  }
  c.fillStyle = "#0a84ff";
  for (const cop of game.cops) {
    if (!cop.dead) c.fillRect(cop.x * sx - 2, cop.y * sy - 2, 4, 4);
  }
  const p = game.player;
  c.save();
  c.translate(p.x * sx, p.y * sy);
  c.rotate(p.angle);
  c.fillStyle = "#fff";
  c.beginPath();
  c.moveTo(6, 0); c.lineTo(-4, -4); c.lineTo(-4, 4);
  c.closePath(); c.fill();
  c.restore();
}

export function showToast(text, ms = 2600) {
  els.toast.textContent = text;
  els.toast.style.opacity = "1";
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.style.opacity = "0"; }, ms);
}

export function showBanner(text, ms = 2600) {
  els.banner.textContent = text;
  els.banner.style.opacity = "1";
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { els.banner.style.opacity = "0"; }, ms);
}

// Dialogue lines play one at a time, ~3.6s each; "SPEAKER: text" splits.
export function showDialogue(speaker, lines) {
  dialogueQueue = lines.map((l) => {
    const idx = l.indexOf(": ");
    return idx > 0 ? { speaker: l.slice(0, idx), text: l.slice(idx + 2) } : { speaker, text: l };
  });
  nextDialogue();
}
function nextDialogue() {
  if (dialogueQueue.length === 0) {
    els.dialogue.style.display = "none";
    return;
  }
  const d = dialogueQueue.shift();
  els.dialogueSpeaker.textContent = d.speaker + ":";
  els.dialogueText.textContent = d.text;
  els.dialogue.style.display = "block";
  if (dialogueTimer) clearTimeout(dialogueTimer);
  dialogueTimer = setTimeout(nextDialogue, 3600);
}
export function advanceDialogue() {
  if (dialogueQueue.length > 0 || els.dialogue.style.display === "block") {
    if (dialogueTimer) clearTimeout(dialogueTimer);
    nextDialogue();
  }
}
