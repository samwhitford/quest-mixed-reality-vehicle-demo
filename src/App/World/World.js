// import * as THREE from "three";

import App from "../App.js";
import Physics from "./Physics.js";
import Environment from "./Environment.js";
import Vehicle from "./Vehicle.js";
import VehicleController from "./VehicleController.js";

import { appStateStore } from "../Utils/Store.js";
import TrafficCone from "./trafficCone.js";


export default class World {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;

    this.physics = new Physics();

    // create world classes
    const unsub = appStateStore.subscribe((state) => {
      if (state.physicsReady && state.assetsReady) {
      this.trafficCone = new TrafficCone();
      this.vehicle = new Vehicle();
      this.vehicleController = new VehicleController();
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
    if (this.vehicleController) this.vehicleController.loop(deltaTime);
    if (this.vehicle) this.vehicle.loop(deltaTime);
  }
}
