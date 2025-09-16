import * as THREE from "three";
import App from "../App.js";
import assetStore from "../Utils/AssetStore.js";
import { inputStore } from "../Utils/Store.js";
// import Portal from "./Portal.js";
// import ModalContentProvider from "../UI/ModalContentProvider.js";

export default class Environment {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.physics = this.app.world.physics;
    // this.pane = this.app.gui.pane;

    this.assetStore = assetStore.getState();
    this.environment = this.assetStore.loadedAssets.environment;

    inputStore.subscribe((state) => {
      this.debug = state.debug;
    });
    this.debugCoolDown = false;

    // this.loadEnvironment();
    this.simpleEnvironment();
    this.addLights();
    console.log(this.app.renderer)
    // this.addPortals();
  }

  simpleEnvironment() {
    this.floorMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 10, 100,4,4,4), new THREE.MeshStandardMaterial({wireframe: true, visible: false}))
    this.floorMesh.position.y = 5
    // this.floorMesh.receiveShadow = true
    this.scene.add(this.floorMesh)
    this.physics.add(this.floorMesh, "fixed", "trimesh");
    console.log(this.physics.world)
  }

  addLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    this.directionalLight.position.set(1, 1, 1);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.camera.top = 30;
    this.directionalLight.shadow.camera.right = 30;
    this.directionalLight.shadow.camera.left = -30;
    this.directionalLight.shadow.camera.bottom = -30;
    this.directionalLight.shadow.bias = -0.002;
    this.directionalLight.shadow.normalBias = 0.072;
    this.scene.add(this.directionalLight);
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
