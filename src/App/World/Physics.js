import * as THREE from "three";
import App from "../App.js";
import { appStateStore, inputStore } from "../Utils/Store.js";
import { RapierHelper } from 'three/addons/helpers/RapierHelper.js';
import { element } from "three/tsl";


export default class Physics {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.meshMap = new Map();
    this.debugCoolDown = false;

    this.previousPosition = new THREE.Vector3();
    this.linearVelocity = new THREE.Vector3();
    this.angularVelocity = new THREE.Vector3();

    appStateStore.subscribe((state) => {
      this.xrActive = state.xrActive;
    });
    inputStore.subscribe((state) => {
      this.debug = state.debug;
      this.rightSqueeze = state.rightSqueeze;
      this.leftSqueeze = state.leftSqueeze;
      this.resetObjects = state.resetObjects;
    });

    import("@dimforge/rapier3d").then((RAPIER) => {
      const gravity = { x: 0, y: -9.81, z: 0 };
      this.world = new RAPIER.World(gravity);
      this.rapier = RAPIER;

      this.rapierLoaded = true;
      appStateStore.setState({ physicsReady: true });
      this.physicsHelper = new RapierHelper(this.world);
      this.physicsHelper.visible = false;
      this.scene.add(this.physicsHelper);
    });
  }

  add(mesh, type, collider) {
    // Define Rigid Body
    let rigidBodyType;

    switch (type) {
      case "dynamic":
        rigidBodyType = this.rapier.RigidBodyDesc.dynamic();
        break;
      case "fixed":
        rigidBodyType = this.rapier.RigidBodyDesc.fixed();
        break;
      case "kinematic":
        rigidBodyType = this.rapier.RigidBodyDesc.kinematicVelocityBased();
        break;
      case "kinematicPosition":
        rigidBodyType = this.rapier.RigidBodyDesc.kinematicPositionBased();
        break;
    }

    this.rigidBody = this.world.createRigidBody(rigidBodyType);

    // Define Collider Type
    let colliderType;
    switch (collider) {
      case "cuboid":
        const dimensions = this.computeCuboidDimensions(mesh);
        colliderType = this.rapier.ColliderDesc.cuboid(
          dimensions.x / 2,
          dimensions.y / 2,
          dimensions.z / 2
        );
        break;
      case "ball":
        const radius = this.computeBallDimensions(mesh);
        colliderType = this.rapier.ColliderDesc.ball(radius);
        break;
      case "trimesh":
        const { scaledVertices, indices } = this.computeTrimeshDimensions(mesh);
        colliderType = this.rapier.ColliderDesc.trimesh(
          scaledVertices,
          indices
        );
        break;
      case "convexHull":
        const vertices = this.computeConvexHullDimensions(mesh);
        colliderType = this.rapier.ColliderDesc.convexHull(vertices);
        break;
    }
    this.world.createCollider(colliderType, this.rigidBody);

    // Setting the rigidbody position and rotation
    const worldPosition = mesh.getWorldPosition(new THREE.Vector3());
    const worldRotation = mesh.getWorldQuaternion(new THREE.Quaternion());
    this.rigidBody.setTranslation(worldPosition);
    this.rigidBody.setRotation(worldRotation);

    this.meshMap.set(mesh, this.rigidBody);

    return this.rigidBody;
  }

computeConvexHullDimensions(item) {
    const vertices = [];
    // Temporary vector to perform transformations
    const tempVector = new THREE.Vector3();
    // This function recursively traverses the item to find all meshes
    function getMeshVertices(object) {
      if (object.isMesh) {
        // Get the position attribute of the mesh's geometry
        const positionAttribute = object.geometry.getAttribute('position');
        // Traverse all vertices in the mesh
        for (let i = 0; i < positionAttribute.count; i++) {
          tempVector.x = positionAttribute.getX(i);
          tempVector.y = positionAttribute.getY(i);
          tempVector.z = positionAttribute.getZ(i);
          // Set the temporary vector with the local vertex position
          // Apply the mesh's world transformation to the temporary vector
          tempVector.applyMatrix4(object.matrixWorld);
          // Push the transformed vertex coordinates to the main array
          vertices.push(tempVector.x, tempVector.y, tempVector.z);
        }
      }
      // Recurse through the object's children
      for (const child of object.children) {
        getMeshVertices(child);
      }
    }
    // Start the traversal from the top-level item
    getMeshVertices(item);
    // Return the combined vertices as a Float32Array
    return new Float32Array(vertices);
  }

  computeCuboidDimensions(mesh) {
    mesh.geometry.computeBoundingBox();
    const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
    const worldScale = mesh.getWorldScale(new THREE.Vector3());
    size.multiply(worldScale);
    return size;
  }

  computeBallDimensions(mesh) {
    mesh.geometry.computeBoundingSphere();
    const radius = mesh.geometry.boundingSphere.radius;
    const worldScale = mesh.getWorldScale(new THREE.Vector3());
    const maxScale = Math.max(worldScale.x, worldScale.y, worldScale.z);
    return radius * maxScale;
  }

  computeTrimeshDimensions(mesh) {
    const vertices = mesh.geometry.attributes.position.array;
    const indices = mesh.geometry.index.array;
    const worldScale = mesh.getWorldScale(new THREE.Vector3());
    const scaledVertices = vertices.map((vertex, index) => {
      return vertex * worldScale.getComponent(index % 3);
    });

    return { scaledVertices, indices };
  }

  loop(deltaTime) {
    // Update the ThreeJS Mesh According to Physics World Object
    if (!this.rapierLoaded) return;

    this.world.timestep = deltaTime;
    this.world.step();

    if ( this.physicsHelper && ! this.xrActive ) {
      this.physicsHelper.update();
    }

    if (this.xrActive) this.physicsHelper.visible = false;

    if(this.debug && ! this.debugCoolDown && ! this.xrActive){
      this.debugCoolDown  = true;
      this.physicsHelper.visible = ! this.physicsHelper.visible;
      setTimeout(() => {
        this.debugCoolDown = false;
      }, 300);
    }
    this.meshPhysicsSync();
  }

  meshPhysicsSync(){
    this.meshMap.forEach((body, mesh) => {
      if (this.resetObjects && body.bodyType() == this.rapier.RigidBodyType.Dynamic){
        body.setTranslation(
          new this.rapier.Vector3(
            mesh.userData.originalPos.x,
            mesh.userData.originalPos.y,
            mesh.userData.originalPos.z,
          ),
          true
        );
        body.setRotation(
          new this.rapier.Quaternion(
            mesh.userData.originalRot.x,
            mesh.userData.originalRot.y,
            mesh.userData.originalRot.z,
            mesh.userData.originalRot.w,
          ), true
        );
        return;
      }
      // Swapped Synchronization for a Grabbed Object
      if (mesh.userData.isGrabbed){
        this.handleGrabPhysics(mesh, body)
      } else {
        const position = new THREE.Vector3().copy(body.translation());
        const rotation = new THREE.Quaternion().copy(body.rotation());
        // for position
        mesh.parent.worldToLocal(position);
        // for rotation
        const inverseParentMatrix = new THREE.Matrix4()
        .extractRotation(mesh.parent.matrixWorld)
        .invert();
        const inverseParentRotation = new THREE.Quaternion().setFromRotationMatrix(inverseParentMatrix);
        rotation.premultiply(inverseParentRotation);
        mesh.position.copy(position);
        mesh.quaternion.copy(rotation);
      }
    });
  }

  handleGrabPhysics(mesh, body) {
    let isGrabbing = false;
    const controller = mesh.parent; // The controller is the current parent (either left or right)
    if (this.leftSqueeze && controller.userData.hand === "left"){
      isGrabbing = true;
    }
    if (this.rightSqueeze && controller.userData.hand === "right"){
      isGrabbing = true;
    }
    if (isGrabbing) {
      console.log("grabbing")
      // A. GRAB MODE (Holding the object)
      // 1. Ensure body is Kinematic
      if (body.bodyType() !== this.rapier.RigidBodyType.KinematicPositionBased) {
          body.setBodyType(this.rapier.RigidBodyType.KinematicPositionBased);
      }
      // 2. Swap Synchronization (Mesh -> Body)
      this.updateGrabbedObjectPhysics(mesh, body);
      // 3. Track velocity for throwing
      this.trackControllerVelocity(controller);
    } else {
      console.log("releasing")
      // B. RELEASE MODE (isGrabbing is false, but grabbedObject is still set for cleanup)
      // 1. Ensure body is Dynamic
      if (body.bodyType() !== this.rapier.RigidBodyType.Dynamic) {
        body.setEnabled(false);
        body.setBodyType(this.rapier.RigidBodyType.Dynamic);
        body.setEnabled(true);
      }
      this.meshMap.set(mesh, body);
      // 2. Apply Throw Impulse
      this.applyThrowImpulse(body);
      // re-parent mesh
      this.scene.attach(mesh);
      // 3. Cleanup State (The final step)
      mesh.userData.isGrabbed = false;
    }
  }

  updateGrabbedObjectPhysics(mesh, body) {
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    // Get the final world pose of the mesh (which is following the controller)
    mesh.getWorldPosition(worldPosition);
    mesh.getWorldQuaternion(worldQuaternion);
    // Write the world position/rotation back to the Rapier rigid body.
    // Update Position (Translation)
    body.setTranslation(
        new this.rapier.Vector3(worldPosition.x, worldPosition.y, worldPosition.z),
        true // Wake up the body
    );
    // Update Rotation
    body.setRotation(
        {
            x: worldQuaternion.x,
            y: worldQuaternion.y,
            z: worldQuaternion.z,
            w: worldQuaternion.w
        },
        true // Wake up the body
    );
    // Stop physics forces from moving it
    const zeroVector = new this.rapier.Vector3(0, 0, 0);
    body.setLinvel(zeroVector, true);
    body.setAngvel(zeroVector, true);
  }

  trackControllerVelocity(controller) {
    const currentPosition = new THREE.Vector3();
    const currentQuaternion = new THREE.Quaternion();

    // Get current world position and rotation of the controller
    controller.getWorldPosition(currentPosition);
    controller.getWorldQuaternion(currentQuaternion);

    // 1. Calculate Linear Velocity (Position Delta / Time Delta)
    if (!this.previousPosition.equals(new THREE.Vector3())) {
        this.linearVelocity.subVectors(currentPosition, this.previousPosition)
            .divideScalar(this.world.timestep);
    }

    // 2. Simple Angular Velocity (Just track the current rotation)
    // A more accurate method uses delta rotation, but this is a simple proxy for the release direction.
    // For throwing, we often only need the linear velocity.
    // We'll set the angular velocity to the final rotation difference here for simplicity.
    this.angularVelocity.set(currentQuaternion.x, currentQuaternion.y, currentQuaternion.z);

    // 3. Store current position for the next frame
    this.previousPosition.copy(currentPosition);
  }

  applyThrowImpulse(body) {
    const throwFactor = 1.5;
    // Apply Linear Impulse (Throw speed/direction)
    // Impulse = Mass * Velocity
    body.applyImpulse(
        new this.rapier.Vector3(
            this.linearVelocity.x * body.mass() * throwFactor,
            this.linearVelocity.y * body.mass() * throwFactor,
            this.linearVelocity.z * body.mass() * throwFactor
        ),
        true // Wake up the body
    );
    // Apply Angular Impulse (Spin/Toss)
    body.applyTorqueImpulse(
        new this.rapier.Vector3(
            this.angularVelocity.x * body.mass() * 0.01,
            this.angularVelocity.y * body.mass() * 0.01,
            this.angularVelocity.z * body.mass() * 0.01
        ),
        true
    );
    // Reset velocity trackers after the throw
    this.previousPosition.set(0, 0, 0);
    this.linearVelocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
  }

}
