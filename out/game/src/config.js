// SOLMAR BAY — tuning constants, palette, vehicle and weapon tables.
// Every number that shapes how the game feels lives here, in one place.

export const CFG = {
  // World dimensions (world units)
  WORLD_W: 2600,
  WORLD_H: 2000,
  ROAD_W: 64,          // road width
  BLOCK: 200,          // distance between road centerlines
  MARGIN: 120,         // inset of the road grid from the world edge
  BEACH_H: 260,        // height of the beach strip at the south edge

  // Player on foot
  WALK_SPEED: 175,
  SPRINT_SPEED: 285,
  PLAYER_RADIUS: 12,
  MAX_HEALTH: 100,
  MAX_ARMOR: 100,

  // Vehicles
  ENTER_DIST: 48,
  CAR_LENGTH: 46,
  CAR_WIDTH: 22,

  // Wanted system
  WANTED_MAX: 5,
  HIDE_TIME: 25,       // seconds unseen to drop one star (low levels)
  HIDE_TIME_HIGH: 50,  // seconds unseen to drop one star (3+ stars)
  COP_SPAWN_DIST: 520, // cops spawn just beyond the camera

  // Combat
  BULLET_SPEED: 720,
  BULLET_RANGE: 520,
  MELEE_RANGE: 32,

  // Economy
  START_MONEY: 250,
  STASH_VALUE: 100,
  SPRAY_COST: 50,
  BAIL_COST: 500,

  // Time of day
  DAY_LENGTH: 480,     // seconds per full in-game day
  START_HOUR: 12.0,

  // Camera
  CAM_SMOOTH: 6.0,
  ZOOM_FOOT: 1.0,
  ZOOM_CAR: 0.82,
};

// Sun-soaked coastal palette
export const PAL = {
  grass: "#4a7c43",
  grassDark: "#3d6b38",
  sand: "#e8d29a",
  water: "#2a7fae",
  waterDeep: "#1d5f8a",
  road: "#3a3a40",
  sidewalk: "#9a9a92",
  park: "#3f7a3a",
  lane: "#e8d44d",
  gold: "#ffd700",
  roofColors: ["#b0483e", "#4a6b8a", "#7a6a4a", "#5a4a7a", "#3e7a5a", "#8a6a3e"],
};

// Vehicle types: top speed, acceleration, grip, brakes, hit points, paint jobs
export const VEHICLES = {
  sedan:  { name: "Comet Sedan",      top: 300, accel: 190, grip: 3.4, brake: 320, hp: 100, colors: ["#c0392b", "#2980b9", "#ecf0f1", "#2c3e50"] },
  sports: { name: "Vortex GT",        top: 420, accel: 280, grip: 4.4, brake: 380, hp: 80,  colors: ["#e74c3c", "#f1c40f", "#1abc9c", "#e67e22"] },
  taxi:   { name: "Bay Cab",          top: 290, accel: 180, grip: 3.3, brake: 300, hp: 100, colors: ["#f7dc6f"] },
  truck:  { name: "Hauler 2500",      top: 240, accel: 130, grip: 2.6, brake: 260, hp: 160, colors: ["#7f8c8d", "#5d6d7e", "#935116"] },
  van:    { name: "Courier Van",      top: 260, accel: 150, grip: 2.9, brake: 280, hp: 130, colors: ["#aeb6bf", "#5499c7", "#f5b041"] },
  police: { name: "VCPD Interceptor", top: 380, accel: 260, grip: 4.2, brake: 360, hp: 120, colors: ["#1a1a2e"] },
  bike:   { name: "Rebel 900",        top: 360, accel: 300, grip: 4.8, brake: 340, hp: 50,  colors: ["#c0392b", "#2c3e50"] },
};

// Weapons: damage per hit, shots per second, range, starting ammo, auto-fire, spread
export const WEAPONS = {
  fists:   { name: "Fists",   damage: 12, rate: 2.6, range: 34,  ammo: Infinity, auto: false, spread: 0,    kick: 0 },
  pistol:  { name: "Pistol",  damage: 22, rate: 3.2, range: 460, ammo: 60,       auto: false, spread: 0.02, kick: 1.2 },
  smg:     { name: "SMG",     damage: 13, rate: 9.0, range: 400, ammo: 180,      auto: true,  spread: 0.07, kick: 0.7 },
  shotgun: { name: "Shotgun", damage: 14, rate: 1.4, range: 260, ammo: 32,       auto: false, spread: 0.16, kick: 3.2, pellets: 6 },
};

// City districts (name, bounds, building style)
export const DISTRICTS = [
  { name: "Downtown",     x: 900,  y: 500,  w: 800, h: 600, kind: "downtown" },
  { name: "Marina Beach", x: 0,    y: 1300, w: 2600, h: 700, kind: "beach" },
  { name: "Palm Heights", x: 0,    y: 0,    w: 900, h: 600, kind: "residential" },
  { name: "Old Town",     x: 0,    y: 600,  w: 900, h: 700, kind: "residential" },
  { name: "Portside",     x: 1700, y: 0,    w: 900, h: 500, kind: "industrial" },
  { name: "North Hills",  x: 900,  y: 0,    w: 800, h: 500, kind: "hills" },
];
