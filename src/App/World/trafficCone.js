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
    this.meshArray = []

    inputStore.subscribe((state) => {
      this.debug = state.debug;
    });

    this.config = {
      scaleFactor: 0.1,
      quantity: 6
    };
    this.scale = new THREE.Vector3().setScalar(this.config.scaleFactor)
    this.mesh.scale.copy(this.scale)
    this.mesh.updateMatrixWorld(true);
    this.mesh.traverse(function(child){
      child.castShadow = true;
    })

    for (let i = 0; i < this.config.quantity; i++) {
      const randomPosX = this.getRandomIntInRange(0.2,1.5);
      const randomPosZ = this.getRandomIntInRange(0.2,1.5);
      this.position = new THREE.Vector3(randomPosX, 3, randomPosZ);
      let meshClone = this.mesh.clone();
      meshClone.position.copy(this.position);
      this.scene.add(meshClone);
      this.physics.add(meshClone, "dynamic", "convexHull");
      this.meshArray.push(meshClone);
    }
  }

  getRandomIntInRange(min, max) {
      let pick = Math.floor(Math.random() * (max - min + 1)) + min;
      let plusOrMinus = Math.random() < 0.5 ? -1 : 1;
      let output = pick * plusOrMinus
      return output
  }
}
