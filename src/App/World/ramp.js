import * as THREE from "three";
import assetStore from "../Utils/AssetStore.js";
import { inputStore } from "../Utils/Store.js";

import App from "../App.js";

export default class Ramp {
  constructor(options = {}) {
    this.app = new App();
    this.scene = this.app.scene;
    this.assetStore = assetStore.getState();
    this.ramp = this.assetStore.loadedAssets.ramp;
    this.mesh = this.ramp.scene;
    console.log(this.mesh)
    this.world = this.app.world
    this.physics = this.app.world.physics;
    this.meshArray = []

    inputStore.subscribe((state) => {
      this.debug = state.debug;
    });

    this.config = {
      scaleFactor: 0.2,
      quantity: 1
    };
    this.scale = new THREE.Vector3().setScalar(this.config.scaleFactor)
    this.mesh.scale.copy(this.scale)
    this.mesh.updateMatrixWorld(true);
    this.mesh.traverse(function(child){
      child.castShadow = true;
    })

    this.position = new THREE.Vector3(-0.2, 3, -3);
    let meshClone = this.mesh.clone();
    meshClone.position.copy(this.position);
    meshClone.rotateY(THREE.MathUtils.degToRad(180));
    meshClone.updateMatrixWorld(true);
    this.scene.add(meshClone);
    for (const child of meshClone.children) {
      child.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          this.meshArray.push(obj);
          this.physics.add(obj, "dynamic", "trimesh");
        }
      });
    }
  }
}
