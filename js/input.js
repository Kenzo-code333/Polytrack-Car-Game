// Keyboard state plus on-screen touch buttons.
const down = new Set();
const pressed = new Set();

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  // While racing, Enter fires the power-up instead of pressing a focused button.
  const hud = document.getElementById('hud');
  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    if (hud && !hud.classList.contains('hidden')) e.preventDefault();
  }
  if (!down.has(e.code)) pressed.add(e.code);
  down.add(e.code);
});
window.addEventListener('keyup', (e) => down.delete(e.code));
window.addEventListener('blur', () => down.clear());

export const input = {
  isDown: (...codes) => codes.some((c) => down.has(c)),
  // True once per key press.
  consume(...codes) {
    for (const c of codes) {
      if (pressed.has(c)) {
        pressed.delete(c);
        return true;
      }
    }
    return false;
  },
  clearPressed() {
    pressed.clear();
  },
  drive() {
    const left = this.isDown('ArrowLeft', 'KeyA', 'TouchLeft');
    const right = this.isDown('ArrowRight', 'KeyD', 'TouchRight');
    return {
      throttle: this.isDown('ArrowUp', 'KeyW', 'TouchGas') ? 1 : 0,
      brake: this.isDown('ArrowDown', 'KeyS', 'TouchBrake') ? 1 : 0,
      steer: (right ? 1 : 0) - (left ? 1 : 0),
    };
  },
};

// Touch controls: elements with data-key act like held keys.
export function bindTouchControls(root) {
  for (const el of root.querySelectorAll('[data-key]')) {
    const code = el.dataset.key;
    const on = (e) => {
      e.preventDefault();
      if (!down.has(code)) pressed.add(code);
      down.add(code);
      el.classList.add('active');
    };
    const off = (e) => {
      e.preventDefault();
      down.delete(code);
      el.classList.remove('active');
    };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }
}
