// import * as THREE from "three";

import App from "../App.js";
import Physics from "./Physics.js";
import Environment from "./Environment.js";
import Vehicle from "./Vehicle.js";
import VehicleController from "./VehicleController.js";
import TrafficCone from "./trafficCone.js";
import Ramp from "./ramp.js";

import { appStateStore } from "../Utils/Store.js";

export default class World {
  constructor() {
    this.app = new App();
    this.physics = new Physics();
    this.grabbableObject = [];

    const unsub = appStateStore.subscribe((state) => {
      if (state.physicsReady && state.assetsReady) {
        this.trafficCone = new TrafficCone();
        this.grabbableObject.push(...this.trafficCone.meshArray);
        this.Ramp = new Ramp();
        this.grabbableObject.push(...this.Ramp.meshArray);
        this.vehicle = new Vehicle();
        this.grabbableObject.push(this.vehicle.chassisMesh);
        this.vehicleController = new VehicleController();
        this.environment = new Environment();
        unsub();
      }
    });

    this.loop();
  }


  loop(deltaTime) {
    this.physics.loop(deltaTime);
    if (this.environment) this.environment.loop();
    if (this.vehicleController) this.vehicleController.loop(deltaTime);
    if (this.vehicle) this.vehicle.loop(deltaTime);
    if (this.Ramp) this.Ramp.confetti.update(deltaTime);
  }
}
