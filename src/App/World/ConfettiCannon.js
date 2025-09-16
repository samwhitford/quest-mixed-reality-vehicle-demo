import * as THREE from 'three';
import App from "../App.js";

export class ConfettiCannon extends THREE.Object3D {
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
            spreadAngle: 30,
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
        this.dummy = new THREE.Object3D();
        this.tempPosition = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();
        this.tempScale = new THREE.Vector3(1, 1, 1);
        this.tempMatrix = new THREE.Matrix4();
        this.burstDuration = this.options.duration;
        this.resetCannon();
    }

    initRaycaster() {
      this.raycaster = new THREE.Raycaster(this.options.rayOrigin, this.options.rayDirectionWorld, 0, 0.1);
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
        const positionCount = geometry.attributes.position.count;
        const colors = new Float32Array(positionCount * 3);
        for (let i = 0; i < positionCount; i++) {
            colors[i * 3] = 1;
            colors[i * 3 + 1] = 1;
            colors[i * 3 + 2] = 1;
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const material = new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide
        });
        const instanceColorsArray = [];
        const colorPalette = [
            new THREE.Color(0xff0000), new THREE.Color(0x00ff00),
            new THREE.Color(0x0000ff), new THREE.Color(0xffff00),
            new THREE.Color(0xff00ff), new THREE.Color(0x00ffff),
        ];
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
            instanceColorsArray.push(...colorPalette[i % colorPalette.length].toArray());
        }
        const instanceColorAttribute = new THREE.InstancedBufferAttribute(
            new Float32Array(instanceColorsArray),
            3
        );
        geometry.setAttribute('instanceColor', instanceColorAttribute);
        this.confettiMesh = new THREE.InstancedMesh(
            geometry,
            material,
            this.options.particleCount
        );
        this.confettiMesh.instanceColor = instanceColorAttribute;
        this.resetConfettiInstances();
        this.add(this.confettiMesh);
    }

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
            console.log("Confetti Cannon Fired!");
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
        p.position.set(0, this.options.cylinderHeight, 0);
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
        p.velocity.applyQuaternion(this.quaternion);
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
        p.scale = THREE.MathUtils.randFloat(0.5, 1.2);
    }

    update(delta) {
        this.meshPhysicsSync();
        const intersects = this.raycaster.intersectObject(this.app.world.vehicle.chassisMesh, true);
        if (intersects.length > 0){
          this.fire();
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
                if (p.position.y < -1) {
                    p.active = false;
                    this.confettiMesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
                    continue;
                }
                this.dummy.position.copy(p.position);
                this.dummy.rotation.setFromVector3(p.rotation);
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
            let body = this.options.parentMesh;
            const position = new THREE.Vector3().copy(body.translation());
            const quaternion = new THREE.Quaternion().copy(body.rotation());
            const rotatedOffset = this.options.offsetFromParent.clone();
            rotatedOffset.applyQuaternion(quaternion);
            this.position.copy(position.add(rotatedOffset));
            this.quaternion.copy(quaternion);
            this.options.rayOrigin = this.position;
            this.options.rayDirectionWorld.set(0, 1, 0);
            this.options.rayDirectionWorld.applyQuaternion(this.quaternion);
            this.raycaster.set(this.options.rayOrigin, this.options.rayDirectionWorld);
        }
      }

}
