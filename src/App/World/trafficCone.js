import * as THREE from "three";
import assetStore from "../Utils/AssetStore.js";
import { inputStore } from "../Utils/Store.js";

import App from "../App.js";

export default class TrafficCone {
  constructor(options = {}) {
    this.app = new App();
    this.scene = this.app.scene;
    this.assetStore = assetStore.getState();
    this.trafficCone = this.assetStore.loadedAssets.traffic_cone;
    this.mesh = this.trafficCone.scene;
    this.world = this.app.world
    this.physics = this.app.world.physics;

    inputStore.subscribe((state) => {
      this.debug = state.debug;
    });

    this.config = {
      // position: options.position || [1, 1, 1], // spawn point
      scaleFactor: 0.1,
      quantity: 5
    };
    this.scale = new THREE.Vector3().setScalar(this.config.scaleFactor)
    this.mesh.scale.copy(this.scale)
    this.mesh.updateMatrixWorld(true);

    this.meshArray = []

    for (let i = 0; i < this.config.quantity; i++) {
      const randomPosX = this.getRandomIntInRange(1,4) - 2
      const randomPosZ = this.getRandomIntInRange(1,4) - 2
      this.position = new THREE.Vector3(randomPosX, 0, randomPosZ);
      let meshClone = this.mesh.clone();
      meshClone.position.copy(this.position);
      this.scene.add(meshClone)
      this.physics.add(meshClone, "dynamic", "convexHull");
    }
  }

// loop(dt) {

//   }
  getRandomIntInRange(min, max) {
      min = Math.ceil(min); // Ensure min is an integer
      max = Math.floor(max); // Ensure max is an integer
      return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getBoundingBox(item){
    const bb = new THREE.Box3().setFromObject(item)
    const minPoint = bb.min;
    const maxPoint = bb.max;
    const bbSize = new THREE.Vector3();
    bb.getSize(bbSize);
    return bbSize;
  }

  centerGeometry(item) {
    const boundingBox = new THREE.Box3().setFromObject(item.scene);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    item.scene.position.sub(center);
  }
}
