import * as THREE from "three";

export class AntennaRig {

  constructor(options = {}) {
    this.boneCount   = options.boneCount   || 3;
    this.length      = options.length      || 1.0;
    this.topradius   = options.topradius   || 0.02;
    this.radius      = options.radius      || 0.02;
    this.stiffness   = options.stiffness   || 2.0;
    this.damping     = options.damping     || 0.05;
    this.maxAngle    = options.maxAngle    || 0.5;
    this.followSpeed = options.followSpeed || 250.0;
    this.swayMultiplier = options.swayMultiplier || 200.0;
    this.returnToCenterX = options.returnToCenterX || 30.0;
    this.returnToCenterY = options.returnToCenterY || 30.0;

    const geo = new THREE.CylinderGeometry(
      this.topradius, this.topradius, this.length,
      8, this.boneCount, false
    );
    geo.translate(0, this.length / 2, 0);
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
    const tipBone = this.bones[this.bones.length - 1];
    const sphereRadius = this.topradius * 2.5;
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 16, 16);
    const sphereMat = new THREE.MeshStandardMaterial({ color: 0xff2800 });
    this.sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.sphereMesh.position.set(0, 0, 0);
    tipBone.add(this.sphereMesh);
    const skeleton = new THREE.Skeleton(this.bones);
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
    const mat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    mat.skinning = true;
    mat.side = THREE.DoubleSide;
    this.mesh = new THREE.SkinnedMesh(geo, mat);
    this.mesh.add(rootBone);
    this.mesh.bind(skeleton);
    this.object3d = this.mesh;
    this.baseRot = new THREE.Vector2();
    this.baseVel = new THREE.Vector2();
  }

  update(dt, carAcceleration, carQuat) {
    if (this.bones.length === 0) return;
    const localAccel = carAcceleration.clone()
      .applyQuaternion(carQuat.clone().invert());
    const targetTilt = new THREE.Vector2(
      -localAccel.z * this.swayMultiplier, // forward/back
       localAccel.x * (this.swayMultiplier / 2)  // side-to-side
    );
    const force = targetTilt.clone().sub(this.baseRot).multiplyScalar(this.stiffness);
    this.baseVel.addScaledVector(force, dt);
    this.baseVel.x -= this.baseRot.x * this.returnToCenterX;
    this.baseVel.y -= this.baseRot.y * this.returnToCenterY;
    this.baseVel.multiplyScalar(this.damping);
    this.baseRot.addScaledVector(this.baseVel, dt);
    this.baseRot.x = THREE.MathUtils.clamp(this.baseRot.x, -this.maxAngle, this.maxAngle);
    this.baseRot.y = THREE.MathUtils.clamp(this.baseRot.y, -this.maxAngle, this.maxAngle);
    let prevRot = this.baseRot.clone();

    this.bones.forEach((bone, i) => {
      if (i === 0) return;
      const lagFactor = 0.005 + i / this.bones.length;
      const lerpFactor = 1.0 - Math.exp(-this.followSpeed * dt * lagFactor);
      const nextRot = prevRot.clone().lerp(
        new THREE.Vector2(bone.rotation.x, bone.rotation.z),
        lerpFactor
      );
      bone.rotation.x = nextRot.x;
      bone.rotation.z = nextRot.y;
      prevRot = nextRot.clone();
    });
    this.mesh.skeleton.update();
  }
}
