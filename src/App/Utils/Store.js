import { createStore } from "zustand";

export const sizesStore = createStore(() => ({
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: Math.min(window.devicePixelRatio, 2),
}));

export const appStateStore = createStore(() => ({
  physicsReady: false,
  assetsReady: false,
  pressedStart: false,
  xrButtonExists: false,
  xrActive: false,
}));

export const inputStore = createStore(() => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  reset: false,
  resetObjects: false,
  brake: false,
  debug: false,
  leftSqueeze: false,
  rightSqueeze: false,
}));
