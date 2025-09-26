import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { sizesStore } from "./Utils/Store.js";

import App from "./App.js";

export default class Camera {
  constructor() {
    this.app = new App();
    this.canvas = this.app.canvas;

    this.sizesStore = sizesStore;

    this.sizes = this.sizesStore.getState();

    this.setInstance();
    this.setControls();
    this.setPlayer();
    this.setResizeLister();
  }

  setInstance() {
    this.instance = new THREE.PerspectiveCamera(
      50,
      this.sizes.width / this.sizes.height,
      0.1,
      1000
    );
    this.instance.position.z = 2;
    this.instance.position.y = 1;
    this.instance.position.x = 1;
  }

  setControls() {
    this.controls = new OrbitControls(this.instance, this.canvas);
    this.controls.maxPolarAngle = Math.PI/2;
    this.controls.enableDamping = true;
  }

  setPlayer(){
    const player = new THREE.Group();
	  this.app.scene.add(player);
	  player.add(this.instance);
  }

  setResizeLister() {
    this.sizesStore.subscribe((sizes) => {
      this.instance.aspect = sizes.width / sizes.height;
      this.instance.updateProjectionMatrix();
    });
  }

  loop() {
    this.controls.update();
  }
}
