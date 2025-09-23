import * as THREE from "three";
import App from "../App.js";
import assetStore from "../Utils/AssetStore.js";
import { inputStore } from "../Utils/Store.js";

export default class Environment {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.physics = this.app.world.physics;
    this.assetStore = assetStore.getState();
    this.environment = this.assetStore.loadedAssets.environment;

    inputStore.subscribe((state) => {
      this.debug = state.debug;
    });
    this.debugCoolDown = false;

    this.simpleEnvironment();
    console.log(this.app.renderer)
  }

  simpleEnvironment() {
    this.floorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(100, 10, 100,4,4,4),
      new THREE.ShadowMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.5,
      })
    )
    this.floorMesh.position.y = 5
    this.floorMesh.receiveShadow = true
    this.scene.add(this.floorMesh)
    this.physics.add(this.floorMesh, "fixed", "trimesh");
    console.log(this.physics.world)
  }

  addPortals() {
    const portalMesh1 =
      this.environment.scene.getObjectByName("noticeportal001");
    const portalMesh2 =
      this.environment.scene.getObjectByName("noticeportal002");
    const portalMesh3 =
      this.environment.scene.getObjectByName("noticeportal003");

    const modalContentProvider = new ModalContentProvider();

    this.portal1 = new Portal(
      portalMesh1,
      modalContentProvider.getModalInfo("aboutMe")
    );
    this.portal2 = new Portal(
      portalMesh2,
      modalContentProvider.getModalInfo("projects")
    );
    this.portal3 = new Portal(
      portalMesh3,
      modalContentProvider.getModalInfo("contactMe")
    );
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
