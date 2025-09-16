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
      if (document.visibilityState === 'hidden') {
        this.paused = true;
      } else {
        setTimeout(() => {
          this.paused = false;
        }, 200);
      }
    });
  }

  start() {
    this.clock.start();
    this.renderer.instance.setAnimationLoop((time,frame) => this.loop(time,frame))
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
