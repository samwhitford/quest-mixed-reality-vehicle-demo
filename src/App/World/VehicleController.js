// import * as THREE from "three";
import App from "../App.js";
import { inputStore } from "../Utils/Store.js";

export default class VehicleController {
  constructor(options = {}) {
    this.app = new App();
    this.scene = this.app.scene;
    this.physics = this.app.world.physics;
    this.vehicle = this.app.world.vehicle;

    inputStore.subscribe((state) => {
      this.forward = state.forward;
      this.backward = state.backward;
      this.left = state.left;
      this.right = state.right;
      this.reset = state.reset;
      this.braking = state.brake;
    });

    this.config = {
      maxEngineForce: options.maxEngineForce || 10,
      maxBrakeForce: options.maxBrakeForce || 10,
      maxSteering: options.maxSteering || 0.4,
      forward: 0,
      right: 0,
      brake: 0,
      reset: false,
      accelerateForce: { value: 0, min: -10, max: 10, step: 0.25 },
      brakeForce: { value: 0.05, min: 0, max: 1, step: 0.002 },
      steerAngle: { value: Math.PI / 24, min: 0, max: Math.PI / 12 },
    };

  }

  loop(dt) {
    this.engine = 0;
    this.steering = 0;
    this.brake = 0;
    this.accelerateForce = 0;
    this.brakeForce = 0.05;
    this.config.forward = 0;
    this.config.brake = 0;

    if (this.forward) {
      this.accelerateForce = this.config.accelerateForce.value + this.config.accelerateForce.step
      if (this.accelerateForce > this.config.accelerateForce.max){
        this.accelerateForce = this.config.accelerateForce.max
      }
      this.config.accelerateForce.value = this.accelerateForce;
    } else if (this.backward) {
      this.accelerateForce = this.config.accelerateForce.value - this.config.accelerateForce.step
      if (this.accelerateForce < this.config.accelerateForce.min){
        this.accelerateForce = this.config.accelerateForce.min
      }
      this.config.accelerateForce.value = this.accelerateForce;
    } else {
      this.config.accelerateForce.value = 0;
    }
    if (this.left) {
      this.steering = this.config.maxSteering;
    }
    if (this.right) {
      this.steering = - this.config.maxSteering;
    }
    if (this.braking) {
      this.brakeForce = this.config.brakeForce.value + this.config.brakeForce.step
      if (this.brakeForce > this.config.brakeForce.max){
        this.brakeForce = this.config.brakeForce.max
      }
      this.config.brakeForce.value = this.brakeForce;
    } else {
      this.config.brakeForce.value = 0.05;
    }

    if (this.reset){
      this.app.world.physics.rapier.Vector3
      this.vehicle.chassisBody.setTranslation( new this.app.world.physics.rapier.Vector3( 0, 1, 0 ), true );
      this.vehicle.chassisBody.setRotation( new this.app.world.physics.rapier.Quaternion( 0, 0, 0, 1 ), true );
      this.vehicle.chassisBody.setLinvel( new this.app.world.physics.rapier.Vector3( 0, 0, 0 ), true );
      this.vehicle.chassisBody.setAngvel( new this.app.world.physics.rapier.Vector3( 0, 0, 0 ), true );

      this.vehicle.setEngineForce(0);
      this.vehicle.setBrake(0);
    }

    this.engine = this.accelerateForce;
    this.brake = this.brakeForce

    this.vehicle.setEngineForce(this.engine);
    this.vehicle.setSteering(this.steering);
    this.vehicle.setBrake(this.brake);
  }
}
