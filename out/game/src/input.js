// SOLMAR BAY — keyboard + mouse input state
export const keys = {};          // key code -> held
export const pressed = {};       // key code -> pressed this frame (consumed by game)
export const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };

const CODE_ALIAS = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right" };

export function initInput(canvas) {
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener("mousedown", (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  window.addEventListener("mouseup", (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}

// Movement vector from held keys (-1..1 each axis)
export function moveVector() {
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}
export function isDown(code) { return !!keys[code]; }
export function wasPressed(code) { return !!pressed[code]; }
export function consumePress(code) { if (pressed[code]) { pressed[code] = false; return true; } return false; }

// Clear per-frame press state; call at end of each frame
export function endFrame() {
  for (const k in pressed) pressed[k] = false;
  mouse.clicked = false;
}
