import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { sizesStore } from "./Utils/Store.js";

import App from "./App.js";

export default class Camera {
  constructor(options = {}) {
    this.app = new App();
    this.canvas = this.app.canvas;

    
    this.sizesStore = sizesStore;
    this.sizes = this.sizesStore.getState();

    this.options = {
      fov: 50,
      aspect: this.sizes.width / this.sizes.height,
      near: 0.1,
      far: 1000,
      position: new THREE.Vector3(1,1,2)
    }

    this.setInstance();
    this.setControls();
    this.setPlayer();
    this.setResizeLister();
  }

  setInstance() {
    this.instance = new THREE.PerspectiveCamera(
      this.options.fov,
      this.options.aspect,
      this.options.near,
      this.options.far
    );
    this.instance.position.copy(this.options.position);
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

  reset(){
    this.instance.fov = this.options.fov;
    this.instance.aspect = this.options.aspect;
    this.instance.near = this.options.near;
    this.instance.far = this.options.far;
    this.instance.position.copy(this.options.position);
    this.instance.updateProjectionMatrix();
  }

  loop() {
    this.controls.update();
  }
}
