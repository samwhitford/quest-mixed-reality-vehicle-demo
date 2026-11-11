import { appStateStore, inputStore } from "../Utils/Store.js";

// Touch controls for mobile browsers.
//
// Two independent sticks:
//   • left  — throttle (up = forward, down = reverse)
//   • right — steering (left / right)
// plus quick-action buttons (RESET car / OBJECTS) in the top-right.
//
// Everything writes into the same inputStore used by the keyboard
// (InputController.js) and the XR controllers (RATK.js), so VehicleController
// and Physics don't care where the input came from.
//
// Only built on mobile touch devices (coarse primary pointer + touch
// support — this keeps it off desktop browsers, including touchscreen
// laptops where maxTouchPoints > 0) and only shown once the world has
// finished building (worldReady). Hidden while an XR session is active.

const isMobileTouchDevice = () => {
  const coarse =
    window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const touch =
    "ontouchstart" in window || (navigator.maxTouchPoints || 0) > 0;
  return coarse && touch;
};

export default class Joystick {
  constructor() {
    this.deadzone = 0.25;
    this.timers = {};
    this.sticks = {};

    if (isMobileTouchDevice()) this.buildDOM();

    const applyVisibility = (state) =>
      this.setVisible(Boolean(state.worldReady && !state.xrActive));
    appStateStore.subscribe(applyVisibility);
    applyVisibility(appStateStore.getState());
  }

  buildDOM() {
    const root = document.createElement("div");
    root.className = "mobile-controls";
    root.innerHTML = `
      <div class="joy-base throttle" aria-label="Throttle">
        <div class="joy-knob"></div>
      </div>
      <div class="joy-base steer" aria-label="Steering">
        <div class="joy-knob"></div>
      </div>
      <div class="mobile-buttons">
        <button class="m-btn" data-action="reset">RESET</button>
        <button class="m-btn" data-action="resetObjects">OBJECTS</button>
      </div>`;
    document.body.appendChild(root);

    this.root = root;
    this.bindStick("throttle", root.querySelector(".throttle"));
    this.bindStick("steer", root.querySelector(".steer"));
    this.bindButtons();
  }

  setVisible(value) {
    if (this.root) this.root.classList.toggle("visible", value);
  }

  /* ---------------- sticks ---------------- */

  bindStick(axis, base) {
    const knob = base.querySelector(".joy-knob");
    const stick = { active: false, base, knob };
    this.sticks[axis] = stick;

    base.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      stick.active = true;
      base.setPointerCapture(event.pointerId);
      this.updateStick(axis, event);
    });

    base.addEventListener("pointermove", (event) => {
      if (stick.active) this.updateStick(axis, event);
    });

    const release = () => {
      stick.active = false;
      knob.style.transform = "translate(0px, 0px)";
      this.releaseAxis(axis);
    };
    base.addEventListener("pointerup", release);
    base.addEventListener("pointercancel", release);
  }

  updateStick(axis, event) {
    const { base, knob } = this.sticks[axis];
    const rect = base.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);

    // Clamp the knob to 80% of the base radius so it reads as "inside" the pad.
    const travel = (rect.width / 2) * 0.8;
    const length = Math.hypot(dx, dy);
    if (length > travel) {
      knob.style.transform = `translate(${(dx / length) * travel}px, ${(dy / length) * travel}px)`;
    } else {
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    const x = dx / travel;
    const y = dy / travel;
    const dz = this.deadzone;

    if (axis === "throttle") {
      // Only the vertical axis matters — up = forward, down = reverse.
      inputStore.setState({
        forward: y < -dz,
        backward: y > dz,
      });
    } else {
      // Only the horizontal axis matters — left / right steering.
      inputStore.setState({
        left: x < -dz,
        right: x > dz,
      });
    }
  }

  releaseAxis(axis) {
    if (axis === "throttle") {
      inputStore.setState({ forward: false, backward: false });
    } else {
      inputStore.setState({ left: false, right: false });
    }
  }

  /* ---------------- buttons ---------------- */

  bindButtons() {
    this.root.querySelectorAll("[data-action]").forEach((btn) => {
      // Momentary pulse — same semantics as tapping R / T on the keyboard
      // (or the A / B buttons on the Quest controller).
      btn.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.pulse(btn.dataset.action);
      });
    });
  }

  pulse(key) {
    inputStore.setState({ [key]: true });
    clearTimeout(this.timers[key]);
    this.timers[key] = setTimeout(
      () => inputStore.setState({ [key]: false }),
      100
    );
  }
}
