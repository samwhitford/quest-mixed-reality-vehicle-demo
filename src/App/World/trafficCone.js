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
    console.log(this.mesh)
    this.world = this.app.world
    this.physics = this.app.world.physics;
    this.meshArray = []

    inputStore.subscribe((state) => {
      this.debug = state.debug;
    });

    this.config = {
      scaleFactor: 0.1,
      quantity: 6,
      position: new THREE.Vector3(), // spawn point
      rotation: new THREE.Quaternion()
    };
    this.scale = new THREE.Vector3().setScalar(this.config.scaleFactor)
    this.mesh.scale.copy(this.scale)
    this.mesh.updateMatrixWorld(true);
    this.mesh.traverse(function(child){
      child.castShadow = true;
    })

    for (let i = 0; i < this.config.quantity; i++) {
      this.position = new THREE.Vector3();
      let check = i + 1;
      if (check % 2 !== 0) {
        this.position.setX(-0.5);
        this.position.setY(2);
        this.position.setZ(-0.5 * (check + 0.25));
      } else {
        this.position.setX(0.5);
        this.position.setY(2);
        this.position.setZ(-0.5 * ((check - 1 ) + 0.25));
      }
      let meshClone = this.mesh.clone();
      meshClone.position.copy(this.position);
      meshClone.userData.originalPos = this.position;
      meshClone.userData.originalRot = this.config.rotation;
      this.scene.add(meshClone);
      this.physics.add(meshClone, "dynamic", "convexHull");
      this.physics.meshMap.get(meshClone).setSoftCcdPrediction(1);
      this.meshArray.push(meshClone);
    }
  }
}
