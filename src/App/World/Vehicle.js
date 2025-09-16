import * as THREE from "three";
import assetStore from "../Utils/AssetStore.js";
import { inputStore } from "../Utils/Store.js";
import { AntennaRig } from "./antenna.js";

import App from "../App.js";

export default class Vehicle {
  constructor(options = {}) {
    this.app = new App();
    this.scene = this.app.scene;
    this.assetStore = assetStore.getState();
    this.chassis = this.assetStore.loadedAssets.chassis;
    this.wheel = this.assetStore.loadedAssets.wheel;
    this.debugCoolDown = false;
    this.prevVel = new THREE.Vector3();
    this.smoothedAccel = new THREE.Vector3();
    inputStore.subscribe((state) => {
      this.debug = state.debug;
    });
    this.applyMaterial(this.chassis);
    this.applyMaterial(this.wheel);
    this.world = this.app.world
    this.physics = this.app.world.physics;

    this.config = {
      scaleFactor: 0.125,
      position: options.position || [0, 1, -1], // spawn point
      rotation: new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        Math.PI
      ),
      wheelRestLength: 0.03,
      suspensionStiffness: 110,
      frictionSlip: 15,
      maxSuspensionTravel: 0.4,
      suspensionDamping: 20,
      chassisMass: 9,
    };

    this.chassis.scene.scale.setScalar(this.config.scaleFactor)
    this.wheel.scene.scale.setScalar(this.config.scaleFactor + 0.002)
    this.centerGeometry(this.chassis);
    this.chassisBoundingBox = this.getBoundingBox(this.chassis.scene);
    const chassisDesc = this.world.physics.rapier.RigidBodyDesc.dynamic()
      .setTranslation(
        this.config.position[0],
        this.config.position[1],
        this.config.position[2]
      )
      .setRotation({
        x: this.config.rotation.x,
        y: this.config.rotation.y,
        z: this.config.rotation.z,
        w: this.config.rotation.w,
      })
      .setCanSleep(false);

    this.chassisBody = this.physics.world.createRigidBody(chassisDesc);

    const chassisCollider = this.world.physics.rapier.ColliderDesc.cuboid(
      this.chassisBoundingBox.x * 0.5,
      this.chassisBoundingBox.y * 0.5,
      this.chassisBoundingBox.z * 0.5
    )
    .setMass(this.config.chassisMass);
    this.physics.world.createCollider(chassisCollider, this.chassisBody);

    // --- Chassis ---
    const chassisGeom = new THREE.BoxGeometry(
      this.chassisBoundingBox.x - 0.05,
      0.1,
      this.chassisBoundingBox.z
    );
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      wireframe: true,
      visible: false,
    });
    this.chassisMesh = new THREE.Mesh(chassisGeom, chassisMat);
    this.chassisMesh.name = 'vehicle';
    this.chassisMesh.rotation.y = Math.PI;
    this.chassisMesh.castShadow = true;
    this.scene.add(this.chassisMesh);
    this.chassisMesh.add(this.chassis.scene);
    this.chassisMesh.children[0].position.y += 0.02;
    this.chassisMesh.children[0].position.z -= 0.015;
    this.antenna = new AntennaRig({
      boneCount: 5,
      length: 0.2,
      topradius: 0.004,
      radius: 0.006,
      stiffness: 1.0,
      damping: 0.1
    });
    this.antennaGroup = new THREE.Group();
    this.antennaGroup.add(this.antenna.object3d);
    this.antennaGroup.position.set(-0.25, 0.45, 0.85)
    this.antennaGroup.scale.setScalar(3)
    this.chassis.scene.add(this.antennaGroup);

    // --- Vehicle Controller ---
    this.controller = this.world.physics.world.createVehicleController(
      this.chassisBody
    );

    // --- Wheels ---
    this.wheelMeshes = [];
    this.addWheels(this.scene);
  }

  addWheels(scene) {
    const restLength = this.config.wheelRestLength;
    let posx = 0.45 * this.config.scaleFactor;
    let posy = 0.25 * this.config.scaleFactor;
    let posz = 0.545 * this.config.scaleFactor;
    const positions = [
      [ posx, - posy,  posz], // front-left
      [- posx, - posy,  posz], // front-right
      [ posx, - posy, - posz], // rear-left
      [- posx, - posy, - posz], // rear-right
    ];
    const wheelBoundingBox = this.getBoundingBox(this.wheel.scene);
    const wheelRadius = wheelBoundingBox.y / 2;
    positions.forEach((pos, i) => {
      this.controller.addWheel(
        { x: pos[0], y: pos[1], z: pos[2] },   // connection point
        { x: 0, y: -1, z: 0 },                 // direction
        { x: -1, y: 0, z: 0 },                 // axle
        restLength,
        wheelRadius
      );
      this.controller.setWheelSuspensionStiffness(i, this.config.suspensionStiffness);
      this.controller.setWheelMaxSuspensionTravel(i, this.config.maxSuspensionTravel);
      this.controller.setWheelSuspensionCompression(i, this.config.suspensionDamping);
      this.controller.setWheelFrictionSlip(i, this.config.frictionSlip);

      // --- Wheel mesh ---
      const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelBoundingBox.x, 16);
      wheelGeom.rotateZ(Math.PI / 2);
      const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        wireframe: true,
        visible: false,
      });
      const wheelMesh = new THREE.Mesh(wheelGeom, wheelMat);
      const wheelModel = this.wheel.scene.clone();
      if (i === 0 || i === 2) {
        wheelModel.rotation.y = Math.PI;
      }
      wheelMesh.add(wheelModel);
      scene.add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
    });
  }

  antennaUpdate(dt){
      const vel = this.chassisBody.linvel();
      const carVel = new THREE.Vector3(vel.x, vel.y, vel.z);
      const instantaneousAccel = carVel.clone().sub(this.prevVel).divideScalar(dt);
      const alpha = 0.5;
      this.smoothedAccel.lerp(instantaneousAccel, alpha);
      this.prevVel.copy(carVel);
      const carQuat = new THREE.Quaternion();
      this.chassisMesh.getWorldQuaternion(carQuat);
      this.antenna.update(dt, this.smoothedAccel, carQuat);
  }

  syncPhysicsAndMesh(dt) {
    if (this.chassisMesh.userData.isGrabbed){
      this.physics.handleGrabPhysics(this.chassisMesh, this.chassisBody);
    }else{
      this.controller.updateVehicle(dt);
      const chassisTransform = this.chassisBody.translation();
      const chassisRotation = this.chassisBody.rotation();
      this.chassisMesh.position.set(chassisTransform.x, chassisTransform.y, chassisTransform.z);
      this.chassisMesh.quaternion.set(chassisRotation.x, chassisRotation.y, chassisRotation.z, chassisRotation.w);
    }
    const chassisRotation = this.chassisBody.rotation();
    const chassisVelocity = new THREE.Vector3(
      this.chassisBody.linvel().x,
      this.chassisBody.linvel().y,
      this.chassisBody.linvel().z
    )
    const localForward = new THREE.Vector3(0, 0, 1);
    localForward.applyQuaternion(chassisRotation);
    const forwardSpeed = chassisVelocity.dot(localForward);
    // Sync wheels to meshes
    this.wheelMeshes.forEach((mesh, i) => {
        const chassisPosition = this.chassisBody.translation();
        const chassisQuaternion = this.chassisBody.rotation();
        const wheelSuspensionLength = this.controller.wheelSuspensionLength(i) || 0;
        const wheelChassisConnectionPointCs = this.controller.wheelChassisConnectionPointCs(i);
        const wheelSteering = this.controller.wheelSteering(i) || 0;
        let wheelRotation;

        // Position
        const wheelPosition = new THREE.Vector3(wheelChassisConnectionPointCs.x, wheelChassisConnectionPointCs.y, wheelChassisConnectionPointCs.z);
        const suspensionOffset = new THREE.Vector3(0, -wheelSuspensionLength, 0);
        wheelPosition.add(suspensionOffset);
        wheelPosition.applyQuaternion(chassisQuaternion);
        wheelPosition.add(new THREE.Vector3(chassisPosition.x, chassisPosition.y, chassisPosition.z));
        mesh.position.copy(wheelPosition);

        // Rotation
        const finalQuaternion = new THREE.Quaternion();
        const steeringQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wheelSteering);
        const deltaRotation = (Math.abs(forwardSpeed) * (dt * 10)) / this.controller.wheelRadius(i);
        wheelRotation =+ deltaRotation
        const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 0, 0), -wheelRotation);
        finalQuaternion
        .copy(chassisQuaternion)
        .multiply(steeringQuaternion)
        .multiply(rotationQuaternion)

        mesh.quaternion.copy(finalQuaternion);
    });
  }

  // --- Controls ---
  setSteering(value) {
    // front wheels only
    this.controller.setWheelSteering(0, value);
    this.controller.setWheelSteering(1, value);
  }

  setEngineForce(force) {
    this.controller.setWheelEngineForce(0, force);
    this.controller.setWheelEngineForce(1, force);
    this.controller.setWheelEngineForce(2, force);
    this.controller.setWheelEngineForce(3, force);
  }

  setBrake(force) {
    this.wheelMeshes.forEach((_, i) => {
      this.controller.setWheelBrake(i, force);
    });
  }

  getSpeed() {
    return this.controller.currentVehicleSpeed();
  }

  applyMaterial(item) {
    const materials = {
        'pureRed': new THREE.MeshStandardMaterial({ color: 0xff2800 }),
        'pureWhite': new THREE.MeshStandardMaterial({ color: 0xfffffc }),
        'pureBlack': new THREE.MeshStandardMaterial({ color: 0x160000 }),
        'pureYellow': new THREE.MeshStandardMaterial({ color: 0xffe889 }),
        'shadeWhite': new THREE.MeshStandardMaterial({ color: 0xfffffc }),
        'shadeBlack': new THREE.MeshStandardMaterial({ color: 0x160000 }),
        'shadeRed': new THREE.MeshStandardMaterial({ color: 0xff2800 }),
    }

    item.scene.traverse(function(object){
        if(object.isMesh)
        {
            object.castShadow = true
            let materialName = Object.keys(materials).find((_materialName) => object.name.startsWith(_materialName));
            if (typeof materialName === 'undefined') {
                materialName = 'pureWhite';
            }
            object.material = materials[materialName].clone();
        }
    })
  }

  getBoundingBox(item){
    const bb = new THREE.Box3().setFromObject(item)
    const minPoint = bb.min;
    const maxPoint = bb.max;
    const bbSize = new THREE.Vector3();
    bb.getSize(bbSize);
    return bbSize;
  }

  centerGeometry(item) {
    const boundingBox = new THREE.Box3().setFromObject(item.scene);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    item.scene.position.sub(center);
  }

  loop(dt) {
    if(this.debug && ! this.debugCoolDown){
      this.debugCoolDown  = true;
      this.chassisMesh.material.visible = ! this.chassisMesh.material.visible;
      this.wheelMeshes.forEach((mesh) => {
        mesh.material.visible = ! mesh.material.visible;
      });
      setTimeout(() => {
        this.debugCoolDown = false;
      }, 300);
    }
    this.syncPhysicsAndMesh(dt);
    this.antennaUpdate(dt);
  }

}
