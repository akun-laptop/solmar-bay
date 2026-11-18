// SOLMAR BAY — localStorage save / load
const KEY = "solmar-bay-save-v1";

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      money: state.money,
      missionIndex: state.missionIndex,
      completedMissions: state.completedMissions,
      player: { x: state.player.x, y: state.player.y, health: state.player.health, armor: state.player.armor },
      weapons: state.player.weapons,
      hour: state.hour,
      stats: state.stats,
      collectibles: state.collectibles,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
