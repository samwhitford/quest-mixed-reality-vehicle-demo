import * as THREE from "three";

import App from "../App.js";
import Physics from "./Physics.js";
import Environment from "./Environment.js";
import Vehicle from "./Vehicle.js";
import VehicleController from "./VehicleController.js";
import TrafficCone from "./Cone.js";
import Ramp from "./Ramp.js";

import { appStateStore } from "../Utils/Store.js";

export default class World {
  constructor() {
    this.app = new App();
    this.physics = new Physics();
    this.grabbableObject = [];

    const unsub = appStateStore.subscribe((state) => {
      if (state.physicsReady && state.assetsReady) {
        this.trafficCone = new TrafficCone({
          scaleFactor: 0.06,
          position: new THREE.Vector3(0, 1, -0.5)
        });
        this.grabbableObject.push(...this.trafficCone.meshArray);
        this.Ramp = new Ramp({
          scaleFactor: 0.12,
          position: new THREE.Vector3(0, 1, -2.2)
        });
        this.grabbableObject.push(...this.Ramp.meshArray);
        this.vehicle = new Vehicle();
        this.grabbableObject.push(this.vehicle.chassisMesh);
        this.vehicleController = new VehicleController();
        this.environment = new Environment();
        unsub();
      }
    });
  }

  loop(deltaTime) {
    this.physics.loop(deltaTime);
    if (this.environment) this.environment.loop();
    if (this.vehicleController) this.vehicleController.loop(deltaTime);
    if (this.vehicle) this.vehicle.loop(deltaTime);
    if (this.Ramp) this.Ramp.confetti.update(deltaTime);
  }
}
