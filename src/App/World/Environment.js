import * as THREE from "three";
import App from "../App.js";
import { appStateStore, inputStore } from "../Utils/Store.js";
import  {InfiniteGridHelper} from "../Utils/InfiniteGrid.js";

export default class Environment {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.physics = this.app.world.physics;

    inputStore.subscribe((state) => {
      this.debug = state.debug;
    });
    appStateStore.subscribe((state) => {
      this.xrActive = state.xrActive;
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
        color: 0x212121,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      })
    )
    this.floorMesh.position.y = 5
    this.floorMesh.receiveShadow = true
    this.scene.add(this.floorMesh)
    this.physics.add(this.floorMesh, "fixed", "trimesh");
    this.gridHelper = new InfiniteGridHelper(
      0.25,
      10,
      new THREE.Color(0x4f4f4f),
      50
    );
    this.gridHelper.position.setY(-0.001)
    this.scene.add(this.gridHelper);
    console.log(this.physics.world)
  }

  setupLighting() {
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 10, 3).normalize();
    light.name = "Directional Light";
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.near = 0;
    light.shadow.camera.far = 500;
    this.scene.add(light);
  }

  loop() {
    if (this.debug && ! this.debugCoolDown){
      this.debugCoolDown = true;
      if (! this.xrActive){
        this.floorMesh.material.visible = ! this.floorMesh.material.visible;
        this.gridHelper.visible = ! this.gridHelper.visible;
      }
      setTimeout(() => {
        this.debugCoolDown = false;
      }, 300);
    }
  }
}
