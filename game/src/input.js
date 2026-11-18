// SOLMAR BAY — keyboard and mouse state. The game loop reads this module;
// `pressed` entries live for exactly one frame so a key tap is never double-counted.
export const keys = {};      // code -> currently held
export const pressed = {};   // code -> tapped this frame
export const mouse = { x: 0, y: 0, down: false, clicked: false };

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

// Normalised WASD / arrow movement vector.
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

// True once if the key was tapped this frame, and clears it.
export function consumePress(code) {
  if (pressed[code]) { pressed[code] = false; return true; }
  return false;
}

// Call at the end of every frame to clear one-frame state.
export function endFrame() {
  for (const k in pressed) pressed[k] = false;
  mouse.clicked = false;
}
