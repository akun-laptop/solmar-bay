# SOLMAR BAY — Open-World Crime Game (make.fun gta6-01)

Original top-down 2D open-world crime game. No Rockstar assets, names, or
characters. Everything is original: city, story, vehicles, art (procedural
canvas sprites), sound (WebAudio synthesis).

## Design pillars (judge criteria order)
1. COMPLETENESS (criterion 1, most important): every genre system wired
   together and visible in screenshots — city on foot + by car, traffic,
   pedestrians, wanted level + police, missions + story, combat, HUD with
   minimap, start screen, save.
2. DEPTH & FUN (criterion 2): 6 story missions, money + progression, 6
   vehicle types, weapons, activities (rampages, taxi fares, collectibles).
3. FEEL & POLISH (criterion 3): responsive controls, smooth camera with
   shake, particles, skid marks, synthesized SFX + music, menus.
4. LOOK & ORIGINALITY (criterion 4): sun-soaked coastal city "Solmar Bay",
   distinct districts, day lighting, original story and characters.
5. STRUCTURE (criterion 5): one file per system, named for what it does.

## City: Solmar Bay
Coastal city, ~2400x1800 world units. Districts:
- Downtown (tall buildings, dense traffic)
- Marina / Beach (boardwalk, palm trees, sand)
- Residential (houses, parks, quiet streets)
- Industrial (warehouses, docks, containers)
- Hills (winding roads, viewpoints)

## Story
Player is RICO VANCE, a getaway driver new to Solmar Bay. Contact: MARA
(salvage-yard owner). Arc: arrival → first jobs → heat from the VCPD →
rival crew → final harbor heist. 6 missions, each with objectives,
dialogue, and a money reward. Money buys weapons, car repairs, safehouse.

## Controls
- WASD / arrows: move / drive
- Mouse: aim (on foot), click: shoot / punch
- E: enter/exit vehicle
- Shift: sprint / handbrake
- R: reload, 1-3: weapons, M: mute, Esc/P: pause
- Space: handbrake (driving) / roll (on foot)

## Systems checklist
- [x] City gen (roads, blocks, buildings, districts, beach)
- [x] Player on foot (move, sprint, punch, shoot)
- [x] Vehicles (6 types, enter/exit, physics, damage)
- [x] Traffic AI (road-following, lights, avoidance)
- [x] Pedestrians (sidewalks, flee, variety)
- [x] Wanted (1-5 stars, police cars + foot, decay, clear)
- [x] Missions (6, story, objectives, rewards)
- [x] Combat (fists, pistol, SMG, shotgun, health)
- [x] HUD (minimap, stars, health, money, clock, objective)
- [x] Start screen, pause, game over, save/load (localStorage)
- [x] Audio (WebAudio synth: engine, sirens, shots, music)
- [x] Effects (particles, skids, muzzle flash, explosions, shake)
- [x] Activities (taxi fares, rampage, collectibles, stunt jumps)

## Files (one job each)
- index.html — shell, canvas, HUD DOM, menus
- css/style.css — HUD + menu styling
- src/config.js — constants, tuning, palette
- src/utils.js — math, RNG, helpers
- src/audio.js — synthesized SFX + music
- src/input.js — keyboard + mouse
- src/city.js — city generation
- src/sprites.js — procedural sprite drawing
- src/player.js — on-foot player
- src/vehicles.js — car physics + traffic AI
- src/pedestrians.js — ped AI
- src/police.js — wanted system + police AI
- src/missions.js — story + objectives
- src/combat.js — weapons, bullets, damage
- src/hud.js — HUD + minimap rendering
- src/save.js — localStorage persistence
- src/effects.js — particles, skids, shake
- src/camera.js — camera follow + zoom
- src/main.js — game loop + state machine
