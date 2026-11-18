// SOLMAR BAY — tuning constants, palette, world layout
export const CFG = {
  // World
  WORLD_W: 2600,
  WORLD_H: 2000,
  TILE: 40,               // base grid unit
  ROAD_W: 64,             // road width
  BLOCK: 200,             // city block size (road center to road center)

  // Player (on foot)
  WALK_SPEED: 175,
  SPRINT_SPEED: 280,
  PLAYER_RADIUS: 12,
  PLAYER_MAX_HEALTH: 100,
  PLAYER_MAX_ARMOR: 100,

  // Vehicles
  ENTER_DIST: 46,
  CAR_LENGTH: 46,
  CAR_WIDTH: 22,

  // Wanted
  WANTED_MAX: 5,
  WANTED_DECAY_TIME: 25,  // seconds hidden to lose 1 star (low levels)
  COP_SPAWN_DIST: 520,    // spawn cops just off-screen
  COP_MAX_ON_FOOT: 6,

  // Combat
  BULLET_SPEED: 720,
  BULLET_RANGE: 520,
  MELEE_RANGE: 30,
  MELEE_DAMAGE: 12,

  // Economy
  START_MONEY: 250,
  TAXI_FARE_BASE: 25,
  TAXI_FARE_PER_M: 0.06,

  // Time
  DAY_LENGTH: 480,        // seconds per full day
  START_HOUR: 12.0,

  // Camera
  CAM_SMOOTH: 6.0,
  CAM_ZOOM_FOOT: 1.0,
  CAM_ZOOM_CAR: 0.82,
};

// Sun-soaked coastal palette
export const PAL = {
  grass: "#4a7c43",
  grassDark: "#3d6b38",
  sand: "#e8d29a",
  water: "#2a7fae",
  waterDeep: "#1d5f8a",
  road: "#3a3a40",
  roadEdge: "#55555e",
  sidewalk: "#9a9a92",
  crosswalk: "#d8d8d0",
  buildingRoof: ["#b0483e", "#4a6b8a", "#7a6a4a", "#5a4a7a", "#3e7a5a", "#8a6a3e"],
  buildingEdge: "#2a2a2e",
  park: "#3f7a3a",
  tree: "#2d6a2a",
  palm: "#2a7a3a",
  lane: "#e8d44d",
  hudGold: "#ffd700",
};

// Vehicle definitions: name, top speed, accel, handling, color set, seats
export const VEHICLES = {
  sedan:   { name: "Comet Sedan",    top: 300, accel: 190, grip: 3.4, brake: 320, hp: 100, colors: ["#c0392b", "#2980b9", "#ecf0f1", "#2c3e50"] },
  sports:  { name: "Vortex GT",      top: 420, accel: 280, grip: 4.4, brake: 380, hp: 80,  colors: ["#e74c3c", "#f1c40f", "#1abc9c", "#e67e22"] },
  taxi:    { name: "Bay Cab",        top: 290, accel: 180, grip: 3.3, brake: 300, hp: 100, colors: ["#f7dc6f"] },
  truck:   { name: "Hauler 2500",    top: 240, accel: 130, grip: 2.6, brake: 260, hp: 160, colors: ["#7f8c8d", "#5d6d7e", "#935116"] },
  van:     { name: "Courier Van",    top: 260, accel: 150, grip: 2.9, brake: 280, hp: 130, colors: ["#aeb6bf", "#5499c7", "#f5b041"] },
  police:  { name: "VCPD Interceptor", top: 380, accel: 260, grip: 4.2, brake: 360, hp: 120, colors: ["#1a1a2e"] },
  bike:    { name: "Rebel 900",      top: 360, accel: 300, grip: 4.8, brake: 340, hp: 50,  colors: ["#c0392b", "#2c3e50"] },
};

// Weapon definitions
export const WEAPONS = {
  fists:  { name: "Fists",   damage: 12, rate: 2.6, range: 34,  ammo: Infinity, auto: false, spread: 0,    kick: 0 },
  pistol: { name: "Pistol",  damage: 22, rate: 3.2, range: 460, ammo: 60,       auto: false, spread: 0.02, kick: 1.2 },
  smg:    { name: "SMG",     damage: 13, rate: 9.0, range: 400, ammo: 180,      auto: true,  spread: 0.07, kick: 0.7 },
  shotgun:{ name: "Shotgun", damage: 14, rate: 1.4, range: 260, ammo: 32,       auto: false, spread: 0.16, kick: 3.2, pellets: 6 },
};

// District definitions (name, bounds, flavor)
export const DISTRICTS = [
  { name: "Downtown",     x: 900,  y: 500,  w: 800, h: 600, kind: "downtown" },
  { name: "Marina Beach", x: 0,    y: 1300, w: 2600, h: 700, kind: "beach" },
  { name: "Palm Heights", x: 0,    y: 0,    w: 900, h: 600, kind: "residential" },
  { name: "Old Town",     x: 0,    y: 600,  w: 900, h: 700, kind: "residential" },
  { name: "Portside",     x: 1700, y: 0,    w: 900, h: 500, kind: "industrial" },
  { name: "North Hills",  x: 900,  y: 0,    w: 800, h: 500, kind: "hills" },
];
