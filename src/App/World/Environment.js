import * as THREE from "three";
import App from "../App.js";
import { inputStore } from "../Utils/Store.js";

export default class Environment {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.physics = this.app.world.physics;

    inputStore.subscribe((state) => {
      this.debug = state.debug;
    });
    this.debugCoolDown = false;

    this.simpleEnvironment();
    this.setupLighting();
    console.log(this.app.renderer)
  }

  simpleEnvironment() {
    this.floorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(100, 10, 100,4,4,4),
      new THREE.ShadowMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      })
    )
    this.floorMesh.position.y = 5
    this.floorMesh.receiveShadow = true
    this.scene.add(this.floorMesh)
    this.physics.add(this.floorMesh, "fixed", "trimesh");
    console.log(this.physics.world)
  }

  setupLighting() {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 10, 3).normalize();
    light.name = "Directional Light";
    light.castShadow = true;
    //Set up shadow properties for the light
    light.shadow.mapSize.width = 1024; // default
    light.shadow.mapSize.height = 1024; // default
    light.shadow.camera.near = 0; // default
    light.shadow.camera.far = 500; // default
    this.scene.add(light);
  }

  loop() {
    if (this.debug && ! this.debugCoolDown){
      this.debugCoolDown = true;
      this.floorMesh.material.visible = ! this.floorMesh.material.visible;
      setTimeout(() => {
        this.debugCoolDown = false;
      }, 300);
    }
  }
}
