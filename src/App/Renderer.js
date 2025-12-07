import * as THREE from "three";
import App from "./App.js";
import { sizesStore, appStateStore } from "./Utils/Store.js";
import { XRButton } from 'three/addons/webxr/XRButton.js';

export default class Renderer {
  constructor() {
    this.app = new App();
    this.canvas = this.app.canvas;
    this.camera = this.app.camera;
    this.scene = this.app.scene;
    this.sizesStore = sizesStore;
    this.sizes = this.sizesStore.getState();

    this.setInstance()
    this.setResizeLister();
  }

  setInstance() {
    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      multiviewStereo: true,
    });
    this.instance.setSize(this.sizes.width, this.sizes.height);
    this.instance.setPixelRatio(this.sizes.pixelRatio);
    this.instance.outputEncoding = THREE.sRGBEncoding;
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    this.instance.xr.enabled = true;
  }

  createXRButton() {
    document.body.appendChild( XRButton.createButton( this.instance, {
      requiredFeatures: [
        'anchors',
        'plane-detection',
        'hit-test',
        'mesh-detection',
        'local-floor',
      ]
    } ) );
    document.body.appendChild(this.instance.domElement);
    appStateStore.setState({ xrButtonExists: true });
  }

  setResizeLister() {
    this.sizesStore.subscribe((sizes) => {
      this.instance.setSize(sizes.width, sizes.height);
      this.instance.setPixelRatio(sizes.pixelRatio);
    });
  }

  loop() {
    if (appStateStore.getState().pressedStart && ! appStateStore.getState().xrButtonExists){
      this.createXRButton()
    }
    this.instance.render(this.scene, this.camera.instance);
  }
}
