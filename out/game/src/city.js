// SOLMAR BAY — procedural city: a road grid, blocks of buildings, parks,
// parking lots, palm trees along the beach, and named landmark spawns.
// Placement uses hash2 so the city is identical on every load.
import { CFG, PAL, DISTRICTS } from "./config.js";
import { hash2, randInt, pick } from "./utils.js";

export const city = {
  roadsH: [],      // {y, x0, x1}
  roadsV: [],      // {x, y0, y1}
  buildings: [],   // {x,y,w,h,hgt,color,roof,kind}
  trees: [],       // {x,y,kind}
  lamps: [],       // {x,y}
  zones: [],       // {x,y,w,h,kind} parks and parking lots
  spawns: {},      // named landmark points
  beachY: 0,       // sand starts here; water a little further south
};

export function generateCity() {
  const W = CFG.WORLD_W, H = CFG.WORLD_H;
  city.beachY = H - CFG.BEACH_H;
  city.roadsH.length = 0; city.roadsV.length = 0;
  city.buildings.length = 0; city.trees.length = 0;
  city.lamps.length = 0; city.zones.length = 0;

  // --- Road grid, plus a coastal boulevard along the beach ---
  for (let x = CFG.MARGIN; x < W - CFG.MARGIN + 1; x += CFG.BLOCK) {
    city.roadsV.push({ x, y0: CFG.MARGIN, y1: city.beachY - 40 });
  }
  for (let y = CFG.MARGIN; y < city.beachY - 40; y += CFG.BLOCK) {
    city.roadsH.push({ y, x0: CFG.MARGIN, x1: W - CFG.MARGIN });
  }
  city.roadsH.push({ y: city.beachY - 60, x0: 0, x1: W });

  // --- Fill the blocks between roads ---
  for (let bx = CFG.MARGIN + CFG.ROAD_W / 2; bx < W - CFG.MARGIN - 60; bx += CFG.BLOCK) {
    for (let by = CFG.MARGIN + CFG.ROAD_W / 2; by < city.beachY - 120; by += CFG.BLOCK) {
      const district = districtAt(bx + 60, by + 60);
      const h = hash2(bx, by);
      if (h < 0.12) {
        // park block
        city.zones.push({ x: bx + 8, y: by + 8, w: 120, h: 120, kind: "park" });
        for (let i = 0; i < 7; i++) {
          city.trees.push({ x: bx + 20 + hash2(bx + i, by) * 100, y: by + 20 + hash2(bx, by + i) * 100, kind: "oak" });
        }
        continue;
      }
      if (h < 0.2) {
        city.zones.push({ x: bx + 8, y: by + 8, w: 120, h: 120, kind: "parking" });
        continue;
      }
      const n = district.kind === "downtown" ? randInt(1, 2) : randInt(1, 3);
      for (let i = 0; i < n; i++) {
        const bw = district.kind === "downtown" ? randInt(50, 90) : randInt(36, 70);
        const bh = district.kind === "downtown" ? randInt(50, 90) : randInt(30, 60);
        const px = bx + 10 + (i % 2) * 70 + hash2(bx + i * 7, by) * 14;
        const py = by + 10 + Math.floor(i / 2) * 70 + hash2(bx, by + i * 7) * 14;
        if (px + bw > bx + 130 || py + bh > by + 130) continue;
        city.buildings.push({
          x: px, y: py, w: bw, h: bh,
          hgt: district.kind === "downtown" ? randInt(24, 60) : district.kind === "industrial" ? randInt(14, 26) : randInt(10, 22),
          color: pick(PAL.roofColors),
          roof: hash2(px, py) < 0.4 ? "flat" : "peaked",
          kind: district.kind,
        });
      }
    }
  }

  // --- Palms along the beach, oaks along the streets ---
  for (let x = 30; x < W; x += 55) {
    city.trees.push({ x: x + hash2(x, 1) * 20, y: city.beachY - 110 + hash2(x, 2) * 30, kind: "palm" });
    city.trees.push({ x: x + hash2(x, 3) * 20, y: city.beachY - 20 + hash2(x, 4) * 40, kind: "palm" });
  }
  for (const r of city.roadsV) {
    for (let y = CFG.MARGIN + 100; y < city.beachY - 100; y += 200) {
      if (hash2(r.x, y) < 0.5) city.trees.push({ x: r.x + CFG.ROAD_W / 2 + 12, y, kind: "oak" });
    }
  }

  // --- Street lamps at intersections ---
  for (const rv of city.roadsV) {
    for (const rh of city.roadsH) {
      if (rh.y < city.beachY - 40) city.lamps.push({ x: rv.x + CFG.ROAD_W / 2 + 6, y: rh.y - CFG.ROAD_W / 2 - 6 });
    }
  }

  // --- Named landmarks (missions, shops, services) ---
  city.spawns = {
    playerStart: { x: 1300, y: 1100 },
    safehouse:   { x: 340,  y: 340 },
    paynspray:   { x: 2100, y: 900 },
    ammunation:  { x: 1500, y: 300 },
    hospital:    { x: 700,  y: 1500 },
    marina:      { x: 1300, y: city.beachY - 100 },
    docks:       { x: 2300, y: 300 },
    airfield:    { x: 2200, y: 1500 },
  };
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

// True when a point lies on any road surface.
export function onRoad(x, y) {
  const hw = CFG.ROAD_W / 2;
  for (const r of city.roadsH) if (Math.abs(y - r.y) <= hw && x >= r.x0 && x <= r.x1) return true;
  for (const r of city.roadsV) if (Math.abs(x - r.x) <= hw && y >= r.y0 && y <= r.y1) return true;
  return false;
}

// Closest point on the road network, with the road's orientation.
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

// Circle vs buildings: returns a push-out vector, or null when clear.
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
