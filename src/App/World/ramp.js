import * as THREE from "three";
import assetStore from "../Utils/AssetStore.js";
import App from "../App.js";

import { inputStore } from "../Utils/Store.js";
import { ConfettiCannon } from "./confettiCannon.js";

export default class Ramp {
  constructor(options = {}) {
    this.app = new App();
    this.scene = this.app.scene;
    this.assetStore = assetStore.getState();
    this.ramp = this.assetStore.loadedAssets.ramp;
    this.mesh = this.ramp.scene;
    this.world = this.app.world
    this.physics = this.app.world.physics;
    this.meshArray = []

    inputStore.subscribe((state) => {
      this.debug = state.debug;
    });

    this.options = {
      scaleFactor: 1,
      quantity: 1,
      position: new THREE.Vector3(-0.2, 1, -3), // spawn point
      rotation: new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0), // Y-axis
        Math.PI                      // 180 degrees
      ),
      ...options
    };
    this.rampGroup = new THREE.Group();
    this.scale = new THREE.Vector3().setScalar(this.options.scaleFactor)
    this.mesh.scale.copy(this.scale)
    this.mesh.updateMatrixWorld(true);
    this.mesh.traverse(function(child){
      child.castShadow = true;
    })
    let meshClone = this.mesh.clone();
    console.log(meshClone)
    meshClone.position.copy(this.options.position);
    meshClone.applyQuaternion(this.options.rotation);
    this.rampGroup.add(meshClone);
    this.confetti = new ConfettiCannon({
      particleCount: 500,
      cylinderRadius: 0.5 * this.options.scaleFactor,
      cylinderHeight: 0.2 * this.options.scaleFactor,
      initialSpeed: 15,
      spreadAngle: 30, // Vertical spread
      gravity: -20,
      drag: 0.5,
      duration: 0.25,
      offsetFromParent: new THREE.Vector3(0,1,1.1).multiplyScalar(this.options.scaleFactor),
    });
    for (const child of meshClone.children) {
      child.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          this.meshArray.push(obj);
          this.physics.add(obj, "dynamic", "convexHull");
          this.physics.meshMap.get(obj).setSoftCcdPrediction(2);
          obj.userData.originalPos = this.options.position;
          obj.userData.originalPos.setX(-0.05);
          obj.userData.originalRot = this.options.rotation;
          obj.material.side = THREE.FrontSide;
          this.confetti.options.parentMesh = this.physics.meshMap.get(obj);
        }
      });
    }
    this.confetti.scale.setScalar(0.25);
    this.rampGroup.add(this.confetti);
    this.scene.add(this.rampGroup);

  }
}
