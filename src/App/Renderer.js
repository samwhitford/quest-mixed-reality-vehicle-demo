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
    // antialias must stay false: three's XR projection-layer path turns
    // antialias into a 4x-MSAA render target on the full headset
    // framebuffer (~2160x1620x2). On Quest's mobile GPU that allocation is
    // large enough to OOM-kill the browser tab when the session starts
    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: true,
      multiviewStereo: true,
    });
    this.instance.setSize(this.sizes.width, this.sizes.height);
    this.instance.setPixelRatio(this.sizes.pixelRatio);
    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    this.instance.xr.enabled = true;
  }

  getXRSessionInit() {
    return {
      requiredFeatures: ['local-floor'],
      optionalFeatures: [
        'anchors',
        'plane-detection',
        'hit-test',
        'mesh-detection',
        'layers',
      ],
    };
  }

  createXRButton() {
    document.body.appendChild(
      XRButton.createButton(this.instance, this.getXRSessionInit())
    );
    document.body.appendChild(this.instance.domElement);
    appStateStore.setState({ xrButtonExists: true });
  }

  async startXRSession() {
    const state = appStateStore.getState();
    if (!navigator.xr || state.xrButtonExists || state.xrStartRequested) {
      return false;
    }

    appStateStore.setState({ xrStartRequested: true });

    const metaFeatures = [
      'anchors',
      'plane-detection',
      'hit-test',
      'mesh-detection',
      'layers',
    ];
    const attempts = [
      {
        mode: 'immersive-ar',
        init: {
          requiredFeatures: ['local-floor'],
          optionalFeatures: metaFeatures,
        },
      },
      {
        mode: 'immersive-ar',
        init: { requiredFeatures: ['local-floor'], optionalFeatures: ['layers'] },
      },
      {
        mode: 'immersive-vr',
        init: { requiredFeatures: ['local-floor'], optionalFeatures: ['layers'] },
      },
    ];

    let session = null;
    for (const { mode, init } of attempts) {
      try {
        console.log('XR startXRSession: requesting', mode, init);
        session = await navigator.xr.requestSession(mode, init);
        console.log('XR startXRSession: session granted, handing to renderer');
        await this.instance.xr.setSession(session);
        console.log('XR startXRSession: session active');
        appStateStore.setState({ xrButtonExists: true }); // suppress the button
        return true;
      } catch (err) {
        console.warn('XR startXRSession: attempt failed', mode, init, err);
        if (session) {
          session.end().catch(() => {});
          session = null;
        }
      }
    }

    appStateStore.setState({ xrStartRequested: false }); // fall back to button
    return false;
  }

  setResizeLister() {
    this.sizesStore.subscribe((sizes) => {
      this.instance.setSize(sizes.width, sizes.height);
      this.instance.setPixelRatio(sizes.pixelRatio);
    });
  }

  loop() {
    const state = appStateStore.getState();
    if (
      state.pressedStart &&
      !state.xrButtonExists &&
      !state.xrStartRequested
    ) {
      this.createXRButton();
    }
    this.instance.render(this.scene, this.camera.instance);
  }
}
