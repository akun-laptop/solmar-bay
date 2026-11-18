// SOLMAR BAY — HUD: DOM updates + canvas minimap
import { CFG, PAL } from "./config.js";
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
  const mm = document.getElementById("minimap");
  minimapCtx = mm.getContext("2d");
}

export function showHud(show) { els.hud.classList.toggle("hidden", !show); }

export function updateHud(state) {
  const p = state.player;
  // wanted stars
  els.wanted.textContent = "★".repeat(state.wanted) + "☆".repeat(5 - state.wanted);
  els.wanted.style.color = state.wanted >= 3 ? "#ff3b30" : "#ffd700";
  els.clock.textContent = fmtTime(state.hour);
  els.money.textContent = fmtMoney(state.money);
  els.healthFill.style.width = Math.max(0, p.health) + "%";
  els.armorFill.style.width = Math.max(0, p.armor) + "%";
  const w = state.player.weapon;
  const ammo = state.player.weapons[w];
  els.weaponInfo.textContent = w === "fists" ? "FISTS" : `${w.toUpperCase()} — ${ammo === Infinity ? "∞" : ammo}`;
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
    els.speedo.textContent = `${kmh} km/h · ${p.inCar.def.name}`;
  } else {
    els.speedo.textContent = "";
  }
  // objective
  const obj = currentObjective(state.missions);
  const m = currentMission(state.missions);
  if (obj && state.missions.active) {
    els.objective.textContent = objectiveText(state.missions);
    els.objective.style.display = "block";
  } else if (m && !state.missions.active) {
    els.objective.textContent = `Next mission: ${m.name} — press M to start`;
    els.objective.style.display = "block";
  } else {
    els.objective.textContent = "All missions complete — free roam!";
    els.objective.style.display = "block";
  }
  drawMinimap(state);
}

function drawMinimap(state) {
  const c = minimapCtx;
  const W = 220, H = 160;
  const sx = W / CFG.WORLD_W, sy = H / CFG.WORLD_H;
  c.clearRect(0, 0, W, H);
  // land
  c.fillStyle = "#2d5a2a";
  c.fillRect(0, 0, W, H);
  // water
  c.fillStyle = "#1d5f8a";
  c.fillRect(0, city.beachY * sy, W, H - city.beachY * sy);
  // roads
  c.strokeStyle = "#888";
  c.lineWidth = 2;
  for (const r of city.roadsH) {
    c.beginPath(); c.moveTo(r.x0 * sx, r.y * sy); c.lineTo(r.x1 * sx, r.y * sy); c.stroke();
  }
  for (const r of city.roadsV) {
    c.beginPath(); c.moveTo(r.x * sx, r.y0 * sy); c.lineTo(r.x * sx, r.y1 * sy); c.stroke();
  }
  // mission target
  const obj = currentObjective(state.missions);
  if (obj && obj.type === "goto") {
    c.fillStyle = "#ffd700";
    c.beginPath(); c.arc(obj.x * sx, obj.y * sy, 5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "#fff"; c.lineWidth = 1; c.stroke();
  }
  // cops
  c.fillStyle = "#0a84ff";
  for (const cop of state.cops) {
    if (!cop.dead) c.fillRect(cop.x * sx - 2, cop.y * sy - 2, 4, 4);
  }
  // player arrow
  const p = state.player;
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
