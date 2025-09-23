import * as THREE from "three";
import assetStore from "../Utils/AssetStore.js";
import { inputStore } from "../Utils/Store.js";
import { AntennaRig } from "./Antenna.js";

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

    this.chassis.scene.scale.set(0.25,0.25,0.25)
    this.wheel.scene.scale.set(0.27,0.27,0.27)

    this.centerGeometry(this.chassis);
    this.chassisBoundingBox = this.getBoundingBox(this.chassis.scene);

    this.world = this.app.world
    this.physics = this.app.world.physics;

    // Config defaults
    this.config = {
      wheelRestLength: options.wheelRestLength || 0.101,
      suspensionStiffness: options.suspensionStiffness || 100.0,
      frictionSlip: options.frictionSlip || 15.0,
      maxSuspensionTravel: 0.5,
      suspensionDamping: 20.0,
      chassisMass: options.chassisMass || 8,
      position: options.position || [0, 2, 0], // spawn point
    };

    // --- Chassis physics body ---
    const chassisDesc = this.world.physics.rapier.RigidBodyDesc.dynamic().setTranslation(
      this.config.position[0],
      this.config.position[1],
      this.config.position[2]
    )
    .setCanSleep(false);

    this.chassisBody = this.physics.world.createRigidBody(chassisDesc);

    const chassisCollider = this.world.physics.rapier.ColliderDesc.cuboid(
      this.chassisBoundingBox.x * 0.5,
      this.chassisBoundingBox.y * 0.5,
      this.chassisBoundingBox.z * 0.5
    )
    .setMass(this.config.chassisMass);
    this.physics.world.createCollider(chassisCollider, this.chassisBody);

    // --- Chassis mesh (Three.js) ---
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

    this.chassisMesh.rotation.y = Math.PI;
    this.chassisMesh.castShadow = true;
    this.scene.add(this.chassisMesh);

    this.chassisMesh.add(this.chassis.scene);
    this.chassisMesh.children[0].position.y += 0.02;
    this.chassisMesh.children[0].position.z -= 0.02;

    this.antenna = new AntennaRig({
      boneCount: 5,
      length: 0.25,
      topradius: 0.004,
      radius: 0.006,
      stiffness: 1.0,
      damping: 0.1
    });
    this.antenna.object3d.position.set(-0.06, 0, 0.2);
    this.chassisMesh.add(this.antenna.object3d);

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
    let posx = 0.13;
    let posy = 0.05;
    let posz = 0.15;
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

      // --- Three.js Mesh for wheel ---
      const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelBoundingBox.x, 16);
      wheelGeom.rotateZ(Math.PI / 2);
      const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        wireframe: true,
        visible: false,
      });
      const wheelMesh = new THREE.Mesh(wheelGeom, wheelMat);
      wheelMesh.add(this.wheel.scene.clone());
      if (i === 0 || i === 2) {
        wheelMesh.children[0].rotation.y = Math.PI;
      }
      // console.log(wheelMesh);
      scene.add(wheelMesh);
      this.wheelMeshes.push(wheelMesh);
    });
  }

loop(dt) {
    this.controller.updateVehicle(dt);

    if(this.debug && ! this.debugCoolDown){
      this.debugCoolDown  = true;
      this.chassisMesh.material.visible = ! this.chassisMesh.material.visible
      this.wheelMeshes.forEach((mesh) => {
        mesh.material.visible = ! mesh.material.visible;
      });
      setTimeout(() => {
        this.debugCoolDown = false;
      }, 300);
    }
    this.syncPhysicsAndMesh();
    this.antennaUpdate(dt);
  }

  antennaUpdate(dt){
      const vel = this.chassisBody.linvel();
      const carVel = new THREE.Vector3(vel.x, vel.y, vel.z);

      // Calculate instantaneous acceleration
      const instantaneousAccel = carVel.clone().sub(this.prevVel).divideScalar(dt);

      // Use a simple smoothing filter for a more stable acceleration value
      const alpha = 0.5; // A value between 0 and 1, adjust as needed
      this.smoothedAccel.lerp(instantaneousAccel, alpha);

      this.prevVel.copy(carVel);

      // Use the smoothed value for the update
      const carQuat = new THREE.Quaternion();
      this.chassisMesh.getWorldQuaternion(carQuat);
      this.antenna.update(dt, this.smoothedAccel, carQuat);
  }

  syncPhysicsAndMesh() {
    // Sync chassis mesh to the physics body
    const chassisTransform = this.chassisBody.translation();
    const chassisRotation = this.chassisBody.rotation();
    this.chassisMesh.position.set(chassisTransform.x, chassisTransform.y, chassisTransform.z);
    this.chassisMesh.quaternion.set(chassisRotation.x, chassisRotation.y, chassisRotation.z, chassisRotation.w);

    // Sync wheels to meshes
    this.wheelMeshes.forEach((mesh, i) => {
        const chassisPosition = this.chassisBody.translation();
        const chassisQuaternion = this.chassisBody.rotation();

        const wheelSuspensionLength = this.controller.wheelSuspensionLength(i);
        const wheelChassisConnectionPointCs = this.controller.wheelChassisConnectionPointCs(i);
        const wheelSteering = this.controller.wheelSteering(i);
        const wheelRotation = this.controller.wheelRotation(i);
        const wheelAxleCs = this.controller.wheelAxleCs(i);

        // Position
        const wheelPosition = new THREE.Vector3(wheelChassisConnectionPointCs.x, wheelChassisConnectionPointCs.y, wheelChassisConnectionPointCs.z);
        const suspensionOffset = new THREE.Vector3(0, -wheelSuspensionLength, 0);
        wheelPosition.add(suspensionOffset);

        // Apply chassis rotation to the wheel's local position and add chassis world position
        const chassisQuaternionThree = new THREE.Quaternion(chassisRotation.x, chassisRotation.y, chassisRotation.z, chassisRotation.w);
        wheelPosition.applyQuaternion(chassisQuaternionThree);
        wheelPosition.add(new THREE.Vector3(chassisPosition.x, chassisPosition.y, chassisPosition.z));
        mesh.position.copy(wheelPosition);

        // Rotation
        // The final quaternion for the wheel mesh
        const finalQuaternion = new THREE.Quaternion();

        // 1. Start with the chassis's world rotation
        finalQuaternion.copy(chassisQuaternionThree);

        // 2. Apply the steering rotation around the Y-axis (local to the chassis)
        const steeringQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wheelSteering);
        finalQuaternion.multiply(steeringQuaternion);

        //
        // TODO FIX rolling rotation for the wheel meshes (approach below not working correctly)
        //
        // 3. Apply the rolling rotation around the axle axis (local to the wheel).
        // The wheel's local axle is defined by the `wheelAxleCs` from Rapier.
        // This vector is pre-rotated by the steering and chassis quaternions.

        // const rollingQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(wheelAxleCs.x, wheelAxleCs.y, wheelAxleCs.z), wheelRotation);

        // Now, this is the most critical change: we multiply the final quaternion by the rolling quaternion.
        // This applies the rolling rotation after the chassis and steering rotations have been accounted for.

        // finalQuaternion.multiply(rollingQuaternion);

        // Apply the final computed quaternion to the mesh
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
    // rear wheels only
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
}
