import * as THREE from "three";
import App from "./App.js";
import { RealityAccelerator } from 'ratk';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { GamepadWrapper, XR_BUTTONS, AXES } from 'gamepad-wrapper';
import { inputStore } from "./Utils/Store.js";

export default class RATK {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.physics = this.app.world.physics;
    this.roomScanMesh = null;
    this.instance = this.app.renderer.instance;
    this.controllers = {
      left: null,
      right: null,
    };

    inputStore.subscribe((state) => {
      this.debug = state.debug;
      this.forward = state.forward;
      this.backward = state.backward;
      this.right = state.right;
      this.left = state.left;
    });
    this.debugCoolDown = false;

    this.ratk = new RealityAccelerator(this.instance.xr);
    this.setupRATK()
    this.addControllers()
    console.log(this.ratk)
  }

  setupRATK() {
    this.ratk.onPlaneAdded = (plane) => {
      const mesh = plane.planeMesh;
      mesh.material = new THREE.MeshBasicMaterial({
        wireframe: true,
        visible: false,
        color: Math.random() * 0xffffff,
	    });
    }
    this.ratk.onMeshAdded = (mesh) => {
      const meshMesh = mesh.meshMesh;
      if(meshMesh.geometry.getAttribute('position').count > 8){ // detailed room scan mesh
        meshMesh.material = new THREE.MeshBasicMaterial({
          wireframe: true,
          visible: false,
          color: Math.random() * 0xffffff,
        });
        this.roomScanMesh = meshMesh;
        this.physics.add(meshMesh, "fixed", "trimesh");
      }else{
        meshMesh.material = new THREE.MeshBasicMaterial({
          wireframe: true,
          visible: false,
          color: Math.random() * 0xffffff,
        });
      }
    }
    this.ratk.root.visible = true;
    this.scene.add(this.ratk.root);
    this.instance.xr.addEventListener('sessionstart', () => {
      setTimeout(() => {
        if (this.ratk.planes.size == 0) {
          this.instance.xr.getSession().initiateRoomCapture();
        }
      }, 5000);
    });
    const environment = new RoomEnvironment(this.instance);
    const pmremGenerator = new THREE.PMREMGenerator(this.instance);
    this.scene.environment = pmremGenerator.fromScene(environment).texture;
    this.scene.environmentIntensity = 0.2;
  }

  addControllers() {
    const controllerModelFactory = new XRControllerModelFactory();
    for (let i = 0; i < 2; i++) {
      const raySpace = this.instance.xr.getController(i);
      const gripSpace = this.instance.xr.getControllerGrip(i);
      const mesh = controllerModelFactory.createControllerModel(gripSpace);
      gripSpace.add(mesh);
      this.scene.add(raySpace, gripSpace);
      raySpace.visible = false;
      gripSpace.visible = false;
      gripSpace.addEventListener('connected', (e) => {
        raySpace.visible = true;
        gripSpace.visible = true;
        const handedness = e.data.handedness;
        this.controllers[handedness] = {
          raySpace,
          gripSpace,
          mesh,
          gamepad: new GamepadWrapper(e.data.gamepad),
        };
      });
      gripSpace.addEventListener('disconnected', (e) => {
        raySpace.visible = false;
        gripSpace.visible = false;
        const handedness = e.data.handedness;
        this.controllers[handedness] = null;
      });
    }
  }

  loop(frame) {
    let refspace = this.instance.xr.getReferenceSpace;
    if (frame && refspace){
      this.ratk.update(frame, refspace);
    }
    this.handleControllers();
  }

  handleControllers() {
    Object.values(this.controllers).forEach((controller) => {
      if (controller?.gamepad) {
        controller.gamepad.update();
			}
		});
    if(this.controllers.right){ // RIGHT HAND
      const {gamepad, raySpace} = this.controllers.right;
      if(gamepad.getButtonClick(XR_BUTTONS.BUTTON_1)){ // A button
        inputStore.setState({ reset: true });
      }
      if(gamepad.getButtonUp(XR_BUTTONS.BUTTON_1)){
        inputStore.setState({ reset: false });
      }
      if(gamepad.getButtonClick(XR_BUTTONS.BUTTON_2)){ // B button
        console.log('clicked B')
      }
      const thumbstickValueY = gamepad.getAxis(
        AXES.XR_STANDARD.THUMBSTICK_Y,
      );
      if (thumbstickValueY > 0.5){
        inputStore.setState({forward: false})
        inputStore.setState({backward: true})
      }
      if (thumbstickValueY < - 0.5){
        inputStore.setState({backward: false})
        inputStore.setState({forward: true})
      }
      if (thumbstickValueY == 0 && (this.forward || this.backward)){
        inputStore.setState({backward: false})
        inputStore.setState({forward: false})
      }
    }
    if(this.controllers.left){ // LEFT HAND
      const {gamepad, raySpace} = this.controllers.left;
      if(gamepad.getButtonClick(XR_BUTTONS.BUTTON_1)){ // A button
        inputStore.setState({ debug: true });
      }
      if(gamepad.getButtonUp(XR_BUTTONS.BUTTON_1)){
        inputStore.setState({ debug: false });
      }
      if(gamepad.getButtonClick(XR_BUTTONS.BUTTON_2)){ // Y button
        console.log('clicked Y')
      }
      const thumbstickValueX = gamepad.getAxis(
        AXES.XR_STANDARD.THUMBSTICK_X,
      );
      if (thumbstickValueX > 0.5){
        inputStore.setState({left: false})
        inputStore.setState({right: true})
      }
      if (thumbstickValueX < - 0.5){
        inputStore.setState({right: false})
        inputStore.setState({left: true})
      }
      if (thumbstickValueX == 0 && (this.left || this.right)){
        inputStore.setState({right: false})
        inputStore.setState({left: false})
      }
    }
    if (this.debug && ! this.debugCoolDown && this.roomScanMesh){
      this.debugCoolDown = true;
      this.roomScanMesh.material.visible = ! this.roomScanMesh.material.visible;
      setTimeout(() => {
        this.debugCoolDown = false;
      }, 300);
    }
  }
}
