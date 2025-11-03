import * as THREE from 'three';
import App from "../App.js";

/**
 * A class to create and manage a cylinder-based particle emitter
 * for confetti in a Three.js scene.
 */
export class ConfettiCannon extends THREE.Object3D {
    /**
     * @param {object} options - Configuration options for the cannon and particles.
     * @param {number} [options.particleCount=1000] - The total number of confetti particles.
     * @param {number} [options.cylinderRadius=0.5] - The radius of the emitter cylinder.
     * @param {number} [options.cylinderHeight=2] - The height of the emitter cylinder.
     * @param {number} [options.initialSpeed=10] - The base initial launch speed of the confetti.
     * @param {number} [options.spreadAngle=45] - The vertical angle in degrees for the confetti spread.
     * @param {number} [options.gravity=-9.8] - The gravity force (y-axis acceleration).
     * @param {number} [options.drag=0.1] - A simple air resistance factor.
     */
    constructor(options = {}) {
        super();

        this.app = new App();
        this.scene = this.app.scene;

        this.options = {
            parentMesh: null,
            offsetFromParent: new THREE.Vector3(0,0.16,0.25),
            rayOrigin: new THREE.Vector3(),
            rayDirectionWorld: new THREE.Vector3(0, 1, 0),
            particleCount: 1000,
            cylinderRadius: 0.15,
            cylinderHeight: 0.3,
            initialSpeed: 20,
            spreadAngle: 30, // Vertical spread
            gravity: -10,
            drag: 0.1,
            duration: 0.5,
            ...options
        };

        this.particlesData = [];
        this.gravityVector = new THREE.Vector3(0, this.options.gravity, 0);

        this.initEmitterVisuals();
        this.initRaycaster();
        this.initConfettiParticles();

        // Transformation matrix and position/rotation vectors for instance manipulation
        this.dummy = new THREE.Object3D();
        this.tempPosition = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();
        this.tempScale = new THREE.Vector3(1, 1, 1);
        this.tempMatrix = new THREE.Matrix4();
        this.burstDuration = this.options.duration;

        // Start the cannon in a 'ready' state
        this.resetCannon();
    }

    /**
     * Creates the raycaster for the cannon/emitter.
     */
    initRaycaster() {
      this.raycaster = new THREE.Raycaster(this.options.rayOrigin, this.options.rayDirectionWorld, 0, 0.1);
    }

    /**
     * Creates the visual representation of the cannon/emitter.
     */
    initEmitterVisuals() {
        const geometry = new THREE.CylinderGeometry(
            this.options.cylinderRadius,
            this.options.cylinderRadius,
            this.options.cylinderHeight,
            32
        );
        const material = new THREE.MeshPhongMaterial({ color: 0x555555 });
        this.emitterMesh = new THREE.Mesh(geometry, material);

        // Position the cylinder so its top face is at y=0 (convenient for emission)
        this.emitterMesh.position.y = this.options.cylinderHeight / 2;

        this.add(this.emitterMesh);
    }
    /**
     * Creates the InstancedMesh for the confetti particles (FINAL FIX for color).
     */
    initConfettiParticles() {
        // Plane Geometry for the Confetti
        const planeSize = 0.15;
        const geometry = new THREE.PlaneGeometry(planeSize, planeSize * 1.5);

        // Create a default color attribute (white) for the base geometry.
        const positionCount = geometry.attributes.position.count;
        const colors = new Float32Array(positionCount * 3);

        // Set all vertices of the base geometry to white (1, 1, 1)
        for (let i = 0; i < positionCount; i++) {
            colors[i * 3] = 1;     // R
            colors[i * 3 + 1] = 1; // G
            colors[i * 3 + 2] = 1; // B
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        // -------------------------------------------------------------------

        // Confetti Material
        const material = new THREE.MeshBasicMaterial({
            vertexColors: true, // Tells the material to use the color attributes
            side: THREE.DoubleSide
        });

        // Data for Instance Colors
        const instanceColorsArray = [];
        const colorPalette = [
            new THREE.Color(0xff0000), new THREE.Color(0x00ff00),
            new THREE.Color(0x0000ff), new THREE.Color(0xffff00),
            new THREE.Color(0xff00ff), new THREE.Color(0x00ffff),
        ];

        // Initialize particles data and collect instance color data
        for (let i = 0; i < this.options.particleCount; i++) {
            this.particlesData.push({
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                rotation: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
                angularVelocity: new THREE.Vector3(),
                scale: 1,
                time: 0,
                active: false,
            });

            // Set instance color data
            instanceColorsArray.push(...colorPalette[i % colorPalette.length].toArray());
        }

        // --- ADD INSTANCE COLOR ATTRIBUTE TO GEOMETRY ---
        const instanceColorAttribute = new THREE.InstancedBufferAttribute(
            new Float32Array(instanceColorsArray),
            3
        );

        // Attach the attribute to the geometry with the name 'instanceColor'
        geometry.setAttribute('instanceColor', instanceColorAttribute);
        // --------------------------------------------------------------

        // The Instanced Mesh
        this.confettiMesh = new THREE.InstancedMesh(
            geometry,
            material,
            this.options.particleCount
        );

        // Keep a reference to the attribute for potential future updates
        this.confettiMesh.instanceColor = instanceColorAttribute;

        // Hide all particles initially
        this.resetConfettiInstances();

        this.add(this.confettiMesh);
    }

    /**
     * Resets the transformation matrix of all confetti instances to a hidden state.
     */
    resetConfettiInstances() {
        const hideMatrix = new THREE.Matrix4().makeScale(0, 0, 0); // Zero scale = hidden
        for (let i = 0; i < this.options.particleCount; i++) {
            this.confettiMesh.setMatrixAt(i, hideMatrix);
        }
        this.confettiMesh.instanceMatrix.needsUpdate = true;
        if (this.confettiMesh.instanceColor) {
             this.confettiMesh.instanceColor.needsUpdate = true;
        }
    }


    /**
     * Resets the cannon state, making it ready to fire.
     */
    resetCannon() {
        this.isFiring = false;
        this.fireTime = 0;
        this.burstDuration = this.options.duration; // The time over which particles are launched
        this.particleIndex = 0;
        this.particleLaunchRate = this.options.particleCount / this.burstDuration;

        // Hide all particles and reset data
        this.particlesData.forEach(p => {
            p.active = false;
            p.time = 0;
        });
        this.resetConfettiInstances();
    }

    /**
     * Initiates the confetti launch sequence.
     */
    fire() {
        if (!this.isFiring) {
            console.log("Confetti Cannon Fired!");
            this.isFiring = true;
            this.fireTime = 0;
            this.particleIndex = 0;
        }
    }

    /**
     * Launches a single particle with random velocity.
     * @param {number} index - The index of the particle to launch.
     */
    launchParticle(index) {
        if (index >= this.options.particleCount) return;

        const p = this.particlesData[index];
        p.active = true;
        p.time = 0;
        p.position.set(0, this.options.cylinderHeight, 0); // Launch point (top of cannon)

        // Generate a random vector within the spread cone
        const baseSpeed = this.options.initialSpeed;
        const spreadRad = THREE.MathUtils.degToRad(this.options.spreadAngle);
        const halfSpread = spreadRad / 2;

        // Random polar coordinates within the cone
        const speed = baseSpeed + (Math.random() * baseSpeed * 0.5 - baseSpeed * 0.25);
        const theta = Math.random() * Math.PI * 2; // Azimuthal angle (0 to 360 deg)
        // Cosine-weighted random distribution for a conical spread
        const u = Math.random();
        const phi = Math.acos(1 - u * (1 - Math.cos(halfSpread))); // Polar angle (0 to halfSpread)

        // Convert spherical to Cartesian velocity (base direction is positive Y)
        // Standard spherical: x=rsin(phi)cos(theta), y=rcos(phi), z=rsin(phi)sin(theta)
        p.velocity.x = speed * Math.sin(phi) * Math.cos(theta);
        p.velocity.y = speed * Math.cos(phi);
        p.velocity.z = speed * Math.sin(phi) * Math.sin(theta);

        // Apply cannon's world rotation to the velocity vector
        p.velocity.applyQuaternion(this.quaternion);

        // Random rotation speed for 'fluttering'
        p.angularVelocity.set(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );

        // Random small initial rotation
        p.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );

        // Random scale variation
        p.scale = THREE.MathUtils.randFloat(0.5, 1.2);
    }

    /**
     * The main update loop for the particles.
     * @param {number} delta - The time elapsed since the last frame (in seconds).
     */
    update(delta) {
        this.meshPhysicsSync();
        const intersects = this.raycaster.intersectObject(this.app.world.vehicle.chassisMesh, true);
        if (intersects.length > 0){
          this.fire();
        }
        // --- Handle Firing Sequence ---
        if (this.isFiring) {
            this.fireTime += delta;

            // Launch new particles
            const particlesToLaunch = Math.floor(this.fireTime * this.particleLaunchRate) - this.particleIndex;

            for (let i = 0; i < particlesToLaunch; i++) {
                if (this.particleIndex < this.options.particleCount) {
                    this.launchParticle(this.particleIndex);
                    this.particleIndex++;
                }
            }

            // Stop firing after the burst duration
            if (this.fireTime >= this.burstDuration) {
                this.isFiring = false;
            }
        }

        let allInactive = true;
        const inverseDrag = 1 - this.options.drag * delta;

        // --- Update Active Particles Physics and State ---
        for (let i = 0; i < this.options.particleCount; i++) {
            const p = this.particlesData[i];

            if (p.active) {
                allInactive = false;
                p.time += delta;

                // Simple Physics Integration (Euler)
                // Apply Gravity: v += g * dt
                p.velocity.addScaledVector(this.gravityVector, delta);

                // Apply Air Resistance/Drag: v *= (1 - drag * dt)
                p.velocity.multiplyScalar(inverseDrag);

                // Update Position: p += v * dt
                p.position.addScaledVector(p.velocity, delta);

                // Update Rotation
                p.rotation.x += p.angularVelocity.x * delta;
                p.rotation.y += p.angularVelocity.y * delta;
                p.rotation.z += p.angularVelocity.z * delta;

                // Deactivate if below a certain point (e.g., ground)
                if (p.position.y < -1) {
                    p.active = false;
                    // Reset to hidden state in the instanced mesh immediately
                    this.confettiMesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
                    continue; // Skip matrix update for this particle
                }

                // --- Update Instanced Mesh Matrix ---
                // Set the local transformation for the instance
                this.dummy.position.copy(p.position);
                this.dummy.rotation.setFromVector3(p.rotation);
                this.dummy.scale.set(p.scale, p.scale, p.scale);

                // Get the instance's matrix
                this.dummy.updateMatrix();

                // Apply the matrix to the InstancedMesh at the correct index
                this.confettiMesh.setMatrixAt(i, this.dummy.matrix);
            }
        }

        // --- Finalize Updates ---
        // Flag the instance matrix as needing an update for Three.js rendering
        if (!allInactive) {
            this.confettiMesh.instanceMatrix.needsUpdate = true;
        }

        // Auto-reset the cannon if all particles are inactive and it's not currently firing
        if (allInactive && !this.isFiring && this.fireTime > 0) {
            this.resetCannon();
        }
      }

      meshPhysicsSync() {
        if (this.options.parentMesh) {
            let body = this.options.parentMesh; // Assuming this is the mesh whose transform you want to track

            // Get the target mesh's World Position and Rotation
            const position = new THREE.Vector3().copy(body.translation());
            const quaternion = new THREE.Quaternion().copy(body.rotation());

            // Apply the offset (crucial fix)
            // Create a temporary vector for the offset
            const rotatedOffset = this.options.offsetFromParent.clone();

            // Rotate the offset vector by the body's world rotation before adding it
            rotatedOffset.applyQuaternion(quaternion);

            // Apply the rotation and position to the cannon
            this.position.copy(position.add(rotatedOffset)); // Apply rotated offset to the world position
            this.quaternion.copy(quaternion);                // Apply the rotation

            // Synchronize Raycaster (Corrections applied here)
            // The ray origin is the cannon's new world position
            this.options.rayOrigin = this.position;

            // The ray direction must be a WORLD-SPACE VECTOR derived from the rotation (quaternion),
            // not the quaternion itself. We use the local UP vector (0, 1, 0) and rotate it.
            this.options.rayDirectionWorld.set(0, 1, 0);
            this.options.rayDirectionWorld.applyQuaternion(this.quaternion); // Transform local UP to world direction

            // Set the raycaster
            this.raycaster.set(this.options.rayOrigin, this.options.rayDirectionWorld);
        }
      }

}
