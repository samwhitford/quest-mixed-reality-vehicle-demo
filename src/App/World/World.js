// import * as THREE from "three";

import App from "../App.js";
import Physics from "./Physics.js";
import Environment from "./Environment.js";
// import Character from "./Character.js";
// import CharacterController from "./CharacterController.js";
import Vehicle from "./Vehicle.js";
import VehicleController from "./VehicleController.js";
// import AnimationController from "./AnimationController.js";

import { appStateStore } from "../Utils/Store.js";


export default class World {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;

    this.physics = new Physics();

    // create world classes
    const unsub = appStateStore.subscribe((state) => {
      if (state.physicsReady && state.assetsReady) {
        this.vehicle = new Vehicle();
        this.vehicleController = new VehicleController();
        // this.character = new Character();
        // this.characterController = new CharacterController();
        // this.animationController = new AnimationController();
        this.environment = new Environment();
        unsub();
      }
    });

    this.loop();
  }

  // loop(deltaTime, elapsedTime) {
  loop(deltaTime) {
    this.physics.loop(deltaTime);
    if (this.environment) this.environment.loop();
    if (this.characterController) this.characterController.loop();
    if (this.vehicleController) this.vehicleController.loop(deltaTime);
    if (this.vehicle) this.vehicle.loop(deltaTime);
    if (this.animationController) this.animationController.loop(deltaTime);
  }
}
