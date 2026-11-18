// SOLMAR BAY — procedural city: roads, blocks, buildings, districts, beach
import { CFG, PAL, DISTRICTS } from "./config.js";
import { hash2, randInt, pick } from "./utils.js";

export const city = {
  roadsH: [],      // horizontal roads: {y, x0, x1}
  roadsV: [],      // vertical roads: {x, y0, y1}
  buildings: [],   // {x,y,w,h,hgt,color,roof,kind}
  trees: [],       // {x,y,kind}
  lamps: [],       // {x,y}
  zones: [],       // {x,y,w,h,kind,name} parks, parking lots, docks
  spawns: {},      // named spawn points
  beachY: 0,       // water starts below this y
};

const ROAD_SPACING = CFG.BLOCK; // 200
const MARGIN = 120;

export function generateCity() {
  const W = CFG.WORLD_W, H = CFG.WORLD_H;
  city.beachY = H - 260;

  // --- Roads: regular grid, with a coastal road along the beach ---
  for (let x = MARGIN; x < W - MARGIN + 1; x += ROAD_SPACING) {
    city.roadsV.push({ x, y0: MARGIN, y1: city.beachY - 40 });
  }
  for (let y = MARGIN; y < city.beachY - 40; y += ROAD_SPACING) {
    city.roadsH.push({ y, x0: MARGIN, x1: W - MARGIN });
  }
  // Coastal boulevard
  city.roadsH.push({ y: city.beachY - 60, x0: 0, x1: W });

  // --- Buildings: fill blocks between roads ---
  const rng = (x, y) => hash2(x, y);
  for (let bx = MARGIN + CFG.ROAD_W / 2; bx < W - MARGIN - 60; bx += ROAD_SPACING) {
    for (let by = MARGIN + CFG.ROAD_W / 2; by < city.beachY - 120; by += ROAD_SPACING) {
      const district = districtAt(bx + 60, by + 60);
      const h = rng(bx, by);
      // Some blocks are parks / parking instead of buildings
      if (h < 0.12) {
        city.zones.push({ x: bx + 8, y: by + 8, w: 120, h: 120, kind: "park", name: "Park" });
        for (let i = 0; i < 7; i++) city.trees.push({ x: bx + 20 + rng(bx + i, by) * 100, y: by + 20 + rng(bx, by + i) * 100, kind: "oak" });
        continue;
      }
      if (h < 0.2) {
        city.zones.push({ x: bx + 8, y: by + 8, w: 120, h: 120, kind: "parking", name: "Parking" });
        continue;
      }
      const n = district.kind === "downtown" ? randInt(1, 2) : randInt(1, 3);
      for (let i = 0; i < n; i++) {
        const bw = district.kind === "downtown" ? randInt(50, 90) : randInt(36, 70);
        const bh = district.kind === "downtown" ? randInt(50, 90) : randInt(30, 60);
        const px = bx + 10 + (i % 2) * 70 + rng(bx + i * 7, by) * 14;
        const py = by + 10 + Math.floor(i / 2) * 70 + rng(bx, by + i * 7) * 14;
        if (px + bw > bx + 130 || py + bh > by + 130) continue;
        city.buildings.push({
          x: px, y: py, w: bw, h: bh,
          hgt: district.kind === "downtown" ? randInt(24, 60) : district.kind === "industrial" ? randInt(14, 26) : randInt(10, 22),
          color: pick(PAL.buildingRoof),
          roof: rng(px, py) < 0.4 ? "flat" : "peaked",
          kind: district.kind,
        });
      }
    }
  }

  // --- Palm trees along the beach + street trees ---
  for (let x = 30; x < W; x += 55) {
    city.trees.push({ x: x + rng(x, 1) * 20, y: city.beachY - 110 + rng(x, 2) * 30, kind: "palm" });
    city.trees.push({ x: x + rng(x, 3) * 20, y: city.beachY - 20 + rng(x, 4) * 40, kind: "palm" });
  }
  for (const r of city.roadsV) {
    for (let y = MARGIN + 100; y < city.beachY - 100; y += 200) {
      if (rng(r.x, y) < 0.5) city.trees.push({ x: r.x + CFG.ROAD_W / 2 + 12, y, kind: "oak" });
    }
  }

  // --- Street lamps at intersections ---
  for (const rv of city.roadsV) for (const rh of city.roadsH) {
    if (rh.y < city.beachY - 40) city.lamps.push({ x: rv.x + CFG.ROAD_W / 2 + 6, y: rh.y - CFG.ROAD_W / 2 - 6 });
  }

  // --- Named spawns ---
  city.spawns = {
    playerStart: { x: 1300, y: 1100 },
    safehouse: { x: 340, y: 340 },
    paynspray: { x: 2100, y: 900 },
    ammunation: { x: 1500, y: 300 },
    hospital: { x: 700, y: 1500 },
    marina: { x: 1300, y: city.beachY - 100 },
    docks: { x: 2300, y: 300 },
    airport: { x: 2200, y: 1500 },
  };
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return DISTRICTS[0];
}

// Is a point on a road? (for traffic/ped placement + minimap)
export function onRoad(x, y) {
  const hw = CFG.ROAD_W / 2;
  for (const r of city.roadsH) if (Math.abs(y - r.y) <= hw && x >= r.x0 && x <= r.x1) return true;
  for (const r of city.roadsV) if (Math.abs(x - r.x) <= hw && y >= r.y0 && y <= r.y1) return true;
  return false;
}

// Nearest road point (for spawning traffic)
export function nearestRoadPoint(x, y) {
  let best = null, bd = Infinity;
  for (const r of city.roadsH) {
    const cx = Math.max(r.x0, Math.min(r.x1, x));
    const d = Math.hypot(cx - x, r.y - y);
    if (d < bd) { bd = d; best = { x: cx, y: r.y, horiz: true }; }
  }
  for (const r of city.roadsV) {
    const cy = Math.max(r.y0, Math.min(r.y1, y));
    const d = Math.hypot(r.x - x, cy - y);
    if (d < bd) { bd = d; best = { x: r.x, y: cy, horiz: false }; }
  }
  return best;
}

// Circle vs building collision; returns push-out vector or null
export function collideBuildings(x, y, r) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.01;
      return { x: (dx / d) * (r - d), y: (dy / d) * (r - d) };
    }
  }
  return null;
}
export function inWater(x, y) { return y > city.beachY + 40; }
