import * as THREE from "three";
import App from "../App";

export default class Loop {
  constructor() {
    console.log("Loop Init");
    this.app = new App();
    this.camera = this.app.camera;
    this.renderer = this.app.renderer;
    this.ratk = this.app.ratk;
    this.world = this.app.world;
    this.clock = new THREE.Clock();
    this.previousElapsedTime = 0;
    this.start();
    this.paused = false;
     document.addEventListener('visibilitychange', () => {
      const presenting = this.app.renderer.instance.xr.isPresenting;
      if (document.visibilityState === 'hidden' && !presenting) {
        this.paused = true;
      } else if (document.visibilityState === 'visible') {
        setTimeout(() => {
          this.paused = false;
        }, 200);
      }
    });
  }

  start() {
    this.clock.start();
    this.renderer.instance.setAnimationLoop((time, frame) => {
      try {
        this.loop(time, frame);
      } catch (err) {
        console.error('XR frame loop error', err);
      }
    });
  }

  stop() {
    this.clock.stop();
  }

  loop(_time,frame) {
    const elapsedTime = this.clock.getElapsedTime();
    const deltaTime = elapsedTime - this.previousElapsedTime;
    this.previousElapsedTime = elapsedTime;

    if (!this.paused) {
      this.world.loop(deltaTime);
    }
    this.camera.loop();
    this.renderer.loop();
    if(this.ratk.ratk) this.ratk.loop(frame);
  }
}
