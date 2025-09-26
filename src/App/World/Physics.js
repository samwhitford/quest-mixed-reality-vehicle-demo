import * as THREE from "three";
import App from "../App.js";
import { appStateStore } from "../Utils/Store.js";
import { RapierHelper } from 'three/addons/helpers/RapierHelper.js';


export default class Physics {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.meshMap = new Map();

    appStateStore.subscribe((state) => {
      this.xrActive = state.xrActive;
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

  // mesh.geometry.boundingBox is initially null until you run the computeBoundingBox() function.
  // The getSize function is a bit unusual: it requires a vector as an argument and then returns the updated vector.
  // It would be more convenient if it directly returned the result, but it needs a Vector input.
  // We need getWorldScale because scaling the geometry directly can cause incorrect physics behavior.
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

    this.meshMap.forEach((rigidBody, mesh) => {
      const position = new THREE.Vector3().copy(rigidBody.translation());
      const rotation = new THREE.Quaternion().copy(rigidBody.rotation());

      // for position
      mesh.parent.worldToLocal(position);

      // for rotation
      const inverseParentMatrix = new THREE.Matrix4()
        .extractRotation(mesh.parent.matrixWorld)
        .invert();
      const inverseParentRotation =
        new THREE.Quaternion().setFromRotationMatrix(inverseParentMatrix);

      rotation.premultiply(inverseParentRotation);

      mesh.position.copy(position);
      mesh.quaternion.copy(rotation);
    });
  }
}
