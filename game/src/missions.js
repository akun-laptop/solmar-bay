// SOLMAR BAY — story missions: 6-chapter arc with objectives + rewards
import { city } from "./city.js";
import { dist2 } from "./utils.js";
import { sfx } from "./audio.js";

// Mission definitions. Each has: id, name, giver, briefing lines,
// objectives (sequential), reward.
export const MISSIONS = [
  {
    id: "arrival",
    name: "Welcome to Solmar",
    giver: "MARA",
    briefing: [
      "MARA: Rico! You made it. Solmar Bay eats slow drivers alive.",
      "MARA: Prove you can handle her. Drive to the Marina lookout.",
      "MARA: My car's yours — the blue Vortex by the curb. Go.",
    ],
    reward: 150,
    objectives: [
      { type: "goto", text: "Drive to the Marina lookout", x: 1300, y: 1640, radius: 70 },
      { type: "goto", text: "Return to Mara's salvage yard", x: 340, y: 340, radius: 70 },
    ],
  },
  {
    id: "firstjob",
    name: "The First Job",
    giver: "MARA",
    briefing: [
      "MARA: A client needs a package moved. No questions, no cops.",
      "MARA: Pick it up at the Portside docks, drop it in Old Town.",
      "MARA: Drive clean. One star and the deal's off.",
    ],
    reward: 300,
    objectives: [
      { type: "goto", text: "Pick up the package at Portside docks", x: 2300, y: 300, radius: 70 },
      { type: "goto", text: "Deliver the package to Old Town", x: 500, y: 900, radius: 70 },
    ],
  },
  {
    id: "heat",
    name: "Heat Wave",
    giver: "MARA",
    briefing: [
      "MARA: The VCPD's got your plate from the docks. Lose them.",
      "MARA: Get your wanted level down — then meet me at the safehouse.",
      "MARA: Pay 'n Spray on 5th will scrub the heat. Or hide it out.",
    ],
    reward: 250,
    objectives: [
      { type: "wanted", text: "Lose the cops (get to 0 stars)", level: 0 },
      { type: "goto", text: "Meet Mara at the safehouse", x: 340, y: 340, radius: 70 },
    ],
    startWanted: 2,
  },
  {
    id: "rival",
    name: "Rival Crew",
    giver: "DEACON",
    briefing: [
      "DEACON: The Northside crew's moving on our turf. Send a message.",
      "DEACON: Take out their enforcers in North Hills — all three.",
      "DEACON: Then come see me downtown. Bring the car in one piece.",
    ],
    reward: 500,
    objectives: [
      { type: "eliminate", text: "Take out the Northside enforcers (0/3)", count: 3 },
      { type: "goto", text: "Meet Deacon downtown", x: 1300, y: 800, radius: 70 },
    ],
  },
  {
    id: "getaway",
    name: "The Getaway",
    giver: "DEACON",
    briefing: [
      "DEACON: Mara's crew hit a courier van. Cops everywhere.",
      "DEACON: Pick up Mara at the hospital, then lose a 3-star tail.",
      "DEACON: Don't let the car die. Mara's counting on you.",
    ],
    reward: 600,
    objectives: [
      { type: "goto", text: "Pick up Mara at the hospital", x: 700, y: 1500, radius: 70 },
      { type: "wanted", text: "Lose the 3-star wanted level", level: 0 },
      { type: "goto", text: "Drop Mara at the safehouse", x: 340, y: 340, radius: 70 },
    ],
    startWanted: 3,
    triggerWantedAt: 1, // wanted starts when objective 1 completes
  },
  {
    id: "heist",
    name: "Harbor Heist",
    giver: "MARA",
    briefing: [
      "MARA: The big one. A vault truck at the harbor, one shot.",
      "MARA: Grab the cash, lose the heat, and we retire rich.",
      "MARA: Whatever happens — drive like the bay is on fire.",
    ],
    reward: 1500,
    objectives: [
      { type: "goto", text: "Reach the harbor vault truck", x: 2300, y: 300, radius: 70 },
      { type: "wanted", text: "Escape with the cash (lose all stars)", level: 0 },
      { type: "goto", text: "Get to the Marina hideout", x: 1300, y: 1640, radius: 70 },
    ],
    startWanted: 4,
    triggerWantedAt: 1,
  },
];

export function createMissionState() {
  return {
    index: 0,              // current mission
    active: false,
    objectiveIndex: 0,
    kills: 0,              // for eliminate objectives
    completed: [],
    failed: false,
  };
}

export function currentMission(ms) {
  return ms.index < MISSIONS.length ? MISSIONS[ms.index] : null;
}
export function currentObjective(ms) {
  const m = currentMission(ms);
  if (!m || !ms.active) return null;
  return m.objectives[ms.objectiveIndex] || null;
}

export function startMission(ms, state) {
  const m = currentMission(ms);
  if (!m) return false;
  ms.active = true;
  ms.objectiveIndex = 0;
  ms.kills = 0;
  ms.failed = false;
  if (m.startWanted && (m.triggerWantedAt === undefined || m.triggerWantedAt === 0)) {
    state.setWanted(m.startWanted);
  }
  state.showDialogue(m.giver, m.briefing);
  state.showBanner(m.name);
  return true;
}

export function advanceObjective(ms, state) {
  const m = currentMission(ms);
  ms.objectiveIndex++;
  if (m.triggerWantedAt === ms.objectiveIndex && m.startWanted) {
    state.setWanted(m.startWanted);
    state.showToast("The heat is on! Lose the cops!");
  }
  if (ms.objectiveIndex >= m.objectives.length) {
    completeMission(ms, state);
  } else {
    sfx.pickup();
  }
}

export function completeMission(ms, state) {
  const m = currentMission(ms);
  ms.active = false;
  ms.completed.push(m.id);
  state.money += m.reward;
  state.stats.missionsDone++;
  state.showMissionComplete(m);
  sfx.missionPass();
  ms.index++;
}

export function failMission(ms, state, reason) {
  ms.active = false;
  ms.failed = true;
  state.showToast("Mission failed: " + reason);
  sfx.missionFail();
}

// Per-frame objective checking
export function updateMissions(ms, state, dt) {
  if (!ms.active) return;
  const obj = currentObjective(ms);
  if (!obj) return;
  const p = state.player;
  if (obj.type === "goto") {
    if (dist2(p.x, p.y, obj.x, obj.y) < obj.radius * obj.radius) {
      advanceObjective(ms, state);
    }
  } else if (obj.type === "wanted") {
    if (state.wanted <= obj.level) advanceObjective(ms, state);
  } else if (obj.type === "eliminate") {
    if (ms.kills >= obj.count) advanceObjective(ms, state);
  }
}

export function objectiveText(ms) {
  const obj = currentObjective(ms);
  if (!obj) return "";
  if (obj.type === "eliminate") {
    return obj.text.replace(/\(\d+\/\d+\)/, `(${ms.kills}/${obj.count})`);
  }
  return obj.text;
}
