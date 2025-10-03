import * as THREE from "three";

export class AntennaRig {
  /**
   * @param {Object} options
   *   boneCount: number of segments (default 3)
   *   length: total antenna length (default 1.0)
   *   radius: antenna thickness (default 0.02)
   *   stiffness, damping, maxAngle, followSpeed: sway tuning
   */
  constructor(options = {}) {
    this.boneCount   = options.boneCount   ?? 3;
    this.length      = options.length      ?? 1.0;
    this.topradius   = options.topradius   ?? 0.02;
    this.radius      = options.radius      ?? 0.02;

    this.stiffness   = options.stiffness   ?? 2.0;
    this.damping     = options.damping     ?? 0.05;
    this.maxAngle    = options.maxAngle    ?? 0.5;   // radians (~28°)
    this.followSpeed = options.followSpeed ?? 250.0;
    this.swayMultiplier = options.swayMultiplier ?? 200.0;
    // Add these lines to the constructor
    this.returnToCenterX = options.returnToCenterX ?? 30.0;
    this.returnToCenterY = options.returnToCenterY ?? 30.0;

    // --- Geometry: cylinder subdivided along height ---
    const geo = new THREE.CylinderGeometry(
      this.topradius, this.topradius, this.length,
      8, this.boneCount, false
    );
    geo.translate(0, this.length / 2, 0); // base at y=0

    // --- Bones ---
    this.bones = [];
    const rootBone = new THREE.Bone();
    rootBone.position.y = 0;
    this.bones.push(rootBone);

    let prevBone = rootBone;
    const segmentHeight = this.length / this.boneCount;

    for (let i = 0; i < this.boneCount; i++) {
      const bone = new THREE.Bone();
      bone.position.y = segmentHeight;
      prevBone.add(bone);
      this.bones.push(bone);
      prevBone = bone;
    }

    // --- add ball to end of antenna ---
    // Get the very last bone, which represents the tip of the antenna
    const tipBone = this.bones[this.bones.length - 1];

    // Define the size and create the sphere geometry
    const sphereRadius = this.topradius * 2.5; // Make the sphere a bit larger than the antenna tip
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 16, 16);

    // Create a material for the sphere
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xff2800 }); // e.g., bright red

    // Create the mesh
    this.sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.sphereMesh.position.set(0, 0, 0);

    // Attach the sphere mesh to the tip bone
    tipBone.add(this.sphereMesh);

    // ---

    const skeleton = new THREE.Skeleton(this.bones);

    // --- Skin indices & weights ---
    const skinIndices = [];
    const skinWeights = [];
    const posAttr = geo.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);

      let boneIndex = Math.floor((y / this.length) * this.boneCount);
      boneIndex = THREE.MathUtils.clamp(boneIndex, 0, this.bones.length - 2);
      const nextBoneIndex = boneIndex + 1;

      const boneY = (boneIndex / this.boneCount) * this.length;
      const nextBoneY = ((boneIndex + 1) / this.boneCount) * this.length;
      const t = (nextBoneY > boneY) ? (y - boneY) / (nextBoneY - boneY) : 0;

      const w0 = 1 - THREE.MathUtils.clamp(t, 0, 1);
      const w1 = 1 - w0;

      skinIndices.push(boneIndex, nextBoneIndex, 0, 0);
      skinWeights.push(w0, w1, 0, 0);
    }

    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
    geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));

    // --- 4. Material & Mesh ---
    const mat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    mat.skinning = true; // IMPORTANT
    mat.side = THREE.DoubleSide;

    this.mesh = new THREE.SkinnedMesh(geo, mat);
    this.mesh.add(rootBone);
    this.mesh.bind(skeleton);

    this.object3d = this.mesh;

    // --- 5. Sway state ---
    this.baseRot = new THREE.Vector2();
    this.baseVel = new THREE.Vector2();
  }

  /**
   * Update the antenna sway
   * @param {number} dt - delta time in seconds
   * @param {THREE.Vector3} carAcceleration - world-space acceleration
   * @param {THREE.Quaternion} carQuat - car’s world orientation
   */
  update(dt, carAcceleration, carQuat) {

    if (this.bones.length === 0) return;

    // Convert accel into car-local space
    const localAccel = carAcceleration.clone()
      .applyQuaternion(carQuat.clone().invert());

    // Stronger tilt multiplier so motion is visible

    const targetTilt = new THREE.Vector2(
      -localAccel.z * this.swayMultiplier, // forward/back
       localAccel.x * (this.swayMultiplier / 2)  // side-to-side
    );

    // --- Base spring physics ---
    const force = targetTilt.clone().sub(this.baseRot).multiplyScalar(this.stiffness);
    this.baseVel.addScaledVector(force, dt);

    this.baseVel.x -= this.baseRot.x * this.returnToCenterX;
    this.baseVel.y -= this.baseRot.y * this.returnToCenterY;

    this.baseVel.multiplyScalar(this.damping);
    this.baseRot.addScaledVector(this.baseVel, dt);

    // Clamp
    this.baseRot.x = THREE.MathUtils.clamp(this.baseRot.x, -this.maxAngle, this.maxAngle);
    this.baseRot.y = THREE.MathUtils.clamp(this.baseRot.y, -this.maxAngle, this.maxAngle);

    // --- Apply progressively down the bones ---
    let prevRot = this.baseRot.clone();

    this.bones.forEach((bone, i) => {
      if (i === 0) return; // root stays fixed

      const lagFactor = 0.005 + i / this.bones.length;

      const lerpFactor = 1.0 - Math.exp(-this.followSpeed * dt * lagFactor);

      const nextRot = prevRot.clone().lerp(
        new THREE.Vector2(bone.rotation.x, bone.rotation.z),
        lerpFactor
      );

      // Apply the new rotation to the bone
      bone.rotation.x = nextRot.x;
      bone.rotation.z = nextRot.y;

      prevRot = nextRot.clone();
    });

    // Make sure GPU bone matrices update
    this.mesh.skeleton.update();
  }
}
