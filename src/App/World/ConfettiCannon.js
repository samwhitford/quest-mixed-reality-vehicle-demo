import * as THREE from 'three';

export class ConfettiCannon extends THREE.Object3D {
    constructor(app, options = {}) {
        super();
        this.app = app;
        this.scene = app.scene;
        this.options = {
            parentMesh: null,
            offsetFromParent: new THREE.Vector3(0, 0.16, 0.25),
            particleCount: 500,
            cylinderRadius: 0.15,
            cylinderHeight: 0.3,
            initialSpeed: 5,
            spreadAngle: 20,
            gravity: -8,
            drag: 0.4,
            duration: 0.22,
            killPlaneY: -1,
            ...options
        };

        this.particlesData = [];
        this.gravityVector = new THREE.Vector3(0, this.options.gravity, 0);
        this.dummy = new THREE.Object3D();
        this._hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
        this._syncPos = new THREE.Vector3();
        this._syncQuat = new THREE.Quaternion();
        this._rotatedOffset = new THREE.Vector3();
        this._launchPos = new THREE.Vector3();
        this._worldQuat = new THREE.Quaternion();
        this._worldScale = new THREE.Vector3();
        this._rayOrigin = new THREE.Vector3();
        this._rayDirection = new THREE.Vector3(0, 1, 0);
        this.initEmitterVisuals();
        this.initRaycaster();
        this.initConfettiParticles();
        this.burstDuration = this.options.duration;
        this.resetCannon();
    }

    initRaycaster() {
      this.raycaster = new THREE.Raycaster(this._rayOrigin, this._rayDirection, 0, 0.1);
    }

    initEmitterVisuals() {
        const geometry = new THREE.CylinderGeometry(
            this.options.cylinderRadius,
            this.options.cylinderRadius,
            this.options.cylinderHeight,
            32
        );
        const material = new THREE.MeshPhongMaterial({ color: 0x555555 });
        this.emitterMesh = new THREE.Mesh(geometry, material);
        this.emitterMesh.position.y = this.options.cylinderHeight / 2;
        this.add(this.emitterMesh);
    }

    initConfettiParticles() {
        const planeSize = 0.15;
        const geometry = new THREE.PlaneGeometry(planeSize, planeSize * 1.5);
        const material = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide
        });
        const colorPalette = [
            new THREE.Color(0xff0000), new THREE.Color(0x00ff00),
            new THREE.Color(0x0000ff), new THREE.Color(0xffff00),
            new THREE.Color(0xff00ff), new THREE.Color(0x00ffff),
        ];
        const instanceColorsArray = new Float32Array(this.options.particleCount * 3);
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
            const c = colorPalette[i % colorPalette.length];
            instanceColorsArray[i * 3] = c.r;
            instanceColorsArray[i * 3 + 1] = c.g;
            instanceColorsArray[i * 3 + 2] = c.b;
        }
        const instanceColorAttribute = new THREE.InstancedBufferAttribute(instanceColorsArray, 3);
        this.confettiMesh = new THREE.InstancedMesh(
            geometry,
            material,
            this.options.particleCount
        );
        this.confettiMesh.instanceColor = instanceColorAttribute;
        this.confettiMesh.frustumCulled = false;
        this.resetConfettiInstances();
        this.scene.add(this.confettiMesh);
    }

    resetConfettiInstances() {
        for (let i = 0; i < this.options.particleCount; i++) {
            this.confettiMesh.setMatrixAt(i, this._hiddenMatrix);
        }
        this.confettiMesh.instanceMatrix.needsUpdate = true;
    }

    resetCannon() {
        this.isFiring = false;
        this.fireTime = 0;
        this.burstDuration = this.options.duration;
        this.particleIndex = 0;
        this.particleLaunchRate = this.options.particleCount / this.burstDuration;
        this.particlesData.forEach(p => {
            p.active = false;
            p.time = 0;
        });
        this.resetConfettiInstances();
    }

    fire() {
        if (!this.isFiring) {
            this.isFiring = true;
            this.fireTime = 0;
            this.particleIndex = 0;
        }
    }

    launchParticle(index) {
        if (index >= this.options.particleCount) return;

        const p = this.particlesData[index];
        p.active = true;
        p.time = 0;
        // Launch position in world space
        this._launchPos.set(0, this.options.cylinderHeight, 0);
        this.localToWorld(this._launchPos);
        p.position.copy(this._launchPos);
        const baseSpeed = this.options.initialSpeed;
        const spreadRad = THREE.MathUtils.degToRad(this.options.spreadAngle);
        const halfSpread = spreadRad / 2;
        const speed = baseSpeed + (Math.random() * baseSpeed * 0.5 - baseSpeed * 0.25);
        const theta = Math.random() * Math.PI * 2;
        const u = Math.random();
        const phi = Math.acos(1 - u * (1 - Math.cos(halfSpread)));
        p.velocity.x = speed * Math.sin(phi) * Math.cos(theta);
        p.velocity.y = speed * Math.cos(phi);
        p.velocity.z = speed * Math.sin(phi) * Math.sin(theta);
        this.getWorldQuaternion(this._worldQuat);
        p.velocity.applyQuaternion(this._worldQuat);
        p.angularVelocity.set(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        p.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );
        // Bake in world scale so confetti size is preserved
        this.getWorldScale(this._worldScale);
        p.scale = THREE.MathUtils.randFloat(0.5, 1.2) * this._worldScale.x;
    }

    update(delta) {
        this.meshPhysicsSync();
        if (!this.isFiring && this.particleIndex === 0) {
            const intersects = this.raycaster.intersectObject(this.app.world.vehicle.chassisMesh, true);
            if (intersects.length > 0) {
                this.fire();
            }
        }
        if (this.isFiring) {
            this.fireTime += delta;
            const particlesToLaunch = Math.floor(this.fireTime * this.particleLaunchRate) - this.particleIndex;
            for (let i = 0; i < particlesToLaunch; i++) {
                if (this.particleIndex < this.options.particleCount) {
                    this.launchParticle(this.particleIndex);
                    this.particleIndex++;
                }
            }
            if (this.fireTime >= this.burstDuration) {
                this.isFiring = false;
            }
        }
        let allInactive = true;
        const inverseDrag = 1 - this.options.drag * delta;
        for (let i = 0; i < this.options.particleCount; i++) {
            const p = this.particlesData[i];

            if (p.active) {
                allInactive = false;
                p.time += delta;
                p.velocity.addScaledVector(this.gravityVector, delta);
                p.velocity.multiplyScalar(inverseDrag);
                p.position.addScaledVector(p.velocity, delta);
                p.rotation.x += p.angularVelocity.x * delta;
                p.rotation.y += p.angularVelocity.y * delta;
                p.rotation.z += p.angularVelocity.z * delta;
                if (p.position.y < this.options.killPlaneY) {
                    p.active = false;
                    this.confettiMesh.setMatrixAt(i, this._hiddenMatrix);
                    continue;
                }
                this.dummy.position.copy(p.position);
                this.dummy.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z);
                this.dummy.scale.set(p.scale, p.scale, p.scale);
                this.dummy.updateMatrix();
                this.confettiMesh.setMatrixAt(i, this.dummy.matrix);
            }
        }

        if (!allInactive) {
            this.confettiMesh.instanceMatrix.needsUpdate = true;
        }

        if (allInactive && !this.isFiring && this.fireTime > 0) {
            this.resetCannon();
        }
    }

    meshPhysicsSync() {
        if (this.options.parentMesh) {
            const body = this.options.parentMesh;
            this._syncPos.copy(body.translation());
            this._syncQuat.copy(body.rotation());
            this._rotatedOffset.copy(this.options.offsetFromParent).applyQuaternion(this._syncQuat);
            this.position.copy(this._syncPos.add(this._rotatedOffset));
            this.quaternion.copy(this._syncQuat);
            this._rayOrigin.copy(this.position);
            this._rayDirection.set(0, 1, 0).applyQuaternion(this.quaternion);
            this.raycaster.set(this._rayOrigin, this._rayDirection);
        }
    }

    dispose() {
        this.confettiMesh.geometry.dispose();
        this.confettiMesh.material.dispose();
        this.emitterMesh.geometry.dispose();
        this.emitterMesh.material.dispose();
        this.scene.remove(this.confettiMesh);
        this.remove(this.emitterMesh);
    }
}
