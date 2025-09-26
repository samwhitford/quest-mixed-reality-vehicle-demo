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
    this.loop();
  }

  loop(time,frame) {
    const elapsedTime = this.clock.getElapsedTime();
    const deltaTime = elapsedTime - this.previousElapsedTime;
    this.previousElapsedTime = elapsedTime;

    this.world.loop(deltaTime, elapsedTime);
    this.camera.loop();
    this.renderer.loop();
    if(this.ratk.ratk) this.ratk.loop(frame);

    this.renderer.instance.setAnimationLoop((time,frame) => this.loop(time,frame))
  }
}
