// src/App/World/TyreTracks.js
import * as THREE from "three";
const UP = new THREE.Vector3(0, 1, 0);

class WheelTrack {
  constructor({ maxPoints, maxAge, halfWidth, color = 0x2b2b2b, baseAlpha = 0.55, fadeHeight = 0.25, gapDistance = 1.0 }) {
    Object.assign(this, { maxPoints, maxAge, halfWidth, baseAlpha, fadeHeight, gapDistance });
    this.color = new THREE.Color(color);
    this.points = []; // oldest → newest: { pos: Vector3, birth: number }
    this.posArray = new Float32Array(maxPoints * 2 * 3);
    this.colArray = new Float32Array(maxPoints * 2 * 4); // 4-component => per-vertex alpha
    this.idxArray = new Uint16Array((maxPoints - 1) * 6); // fixed; visible count set via drawRange
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.posArray, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("color",    new THREE.BufferAttribute(this.colArray, 4).setUsage(THREE.DynamicDrawUsage));
    this.indexAttr = new THREE.BufferAttribute(this.idxArray, 1).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setIndex(this.indexAttr);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(this.geometry, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this._last = new THREE.Vector3(Infinity, Infinity, Infinity);
    this._dir = new THREE.Vector3(); this._side = new THREE.Vector3(1,0,0);
    this._left = new THREE.Vector3(); this._right = new THREE.Vector3();
  }
  reset(){ this.points.length = 0; this._last.set(Infinity, Infinity, Infinity); }

  record(pos, now, surfaceDist){
    // surfaceDist = distance to the nearest up-facing collider (floor/table), or null
    this.points.push({ pos, birth: now, surfaceDist });
    if (this.points.length > this.maxPoints) this.points.shift();
    this._last.copy(pos);
  }

  update(now, lift){
    while (this.points.length && now - this.points[0].birth > this.maxAge) {
      this.points.shift();
      if (!this.points.length) this._last.set(Infinity, Infinity, Infinity);
    }
    this.build(now, lift);
  }

  build(now, lift){
    const n = this.points.length;
    if (n < 2){ this.geometry.setDrawRange(0, 0); return; }
    this.geometry.setDrawRange(0, (n - 1) * 6);
    let vi = 0, ci = 0;
    for (let i = 0; i < n; i++){
      const p = this.points[i];
      const prev = (i > 0)   ? this.points[i-1].pos : p.pos;
      const next = (i < n-1) ? this.points[i+1].pos : p.pos;
      this._dir.copy(next).sub(prev);
      if (this._dir.lengthSq() < 1e-8) this._dir.set(0,0,1);
      this._side.crossVectors(this._dir, UP);
      if (this._side.lengthSq() < 1e-8) this._side.set(1,0,0);
      this._side.normalize();
      this._left  .copy(p.pos).addScaledVector(this._side,  this.halfWidth).y += lift;
      this._right .copy(p.pos).addScaledVector(this._side, -this.halfWidth).y += lift;
      const ageFade = THREE.MathUtils.clamp(1 - (now - p.birth) / this.maxAge, 0, 1);
      let hFade = THREE.MathUtils.clamp(1 - p.pos.y / this.fadeHeight, 0, 1);
      hFade *= hFade;
      const a = this.baseAlpha * ageFade * hFade;
      this.posArray[vi++] = this._left.x;   this.posArray[vi++] = this._left.y;   this.posArray[vi++] = this._left.z;
      this.posArray[vi++] = this._right.x;  this.posArray[vi++] = this._right.y;  this.posArray[vi++] = this._right.z;
      for (const v of [this._left, this._right]){
        this.colArray[ci++] = this.color.r; this.colArray[ci++] = this.color.g; this.colArray[ci++] = this.color.b; this.colArray[ci++] = a;
      }
    }
    let k = 0;
    for (let i = 0; i < n-1; i++){
      const a0=i*2, a1=i*2+1, b0=i*2+2, b1=i*2+3;
      const gap = this.points[i].pos.distanceTo(this.points[i+1].pos) > this.gapDistance;
      if (gap){
        this.idxArray[k++]=a0; this.idxArray[k++]=a0; this.idxArray[k++]=a0;
        this.idxArray[k++]=a0; this.idxArray[k++]=a0; this.idxArray[k++]=a0;
      } else {
        this.idxArray[k++]=a0; this.idxArray[k++]=b0; this.idxArray[k++]=a1;
        this.idxArray[k++]=a1; this.idxArray[k++]=b0; this.idxArray[k++]=b1;
      }
    }
    this.indexAttr.needsUpdate = true;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

export default class TyreTracks {
  constructor(scene, opts = {}) {
    const o = Object.assign({ maxPoints: 240, maxAge: 4, halfWidth: 0.02, recordDistance: 0.02, lift: 0.002, trackColor: 0x2b2b2b, trackAlpha: 0.75, fadeHeight: 0.025, gapDistance: 1.0, maxSurfaceDist: 3.0, normalThreshold: 0.7 }, opts);
    this.o = o; this.time = 0; this.tracks = [];
    this.group = new THREE.Group(); scene.add(this.group);
    for (let i = 0; i < 4; i++){
      const t = new WheelTrack({ maxPoints: o.maxPoints, maxAge: o.maxAge, halfWidth: o.halfWidth, color: o.trackColor, baseAlpha: o.trackAlpha, fadeHeight: o.fadeHeight, gapDistance: o.gapDistance });
      this.tracks.push(t); this.group.add(t.mesh);
    }
  }
  update(dt, vehicle){
    this.time += dt;
    for (let i = 0; i < this.tracks.length; i++){
      const track = this.tracks[i];
      // wheel's true bottom position in world space — on the ground OR airborne
      const wp = vehicle.wheelMeshes[i].position;
      const r  = vehicle.controller.wheelRadius(i) || 0;
      const pos = new THREE.Vector3(wp.x, wp.y - r, wp.z);
      if (track._last.distanceTo(pos) >= this.o.recordDistance) {
        track.record(pos, this.time);
      }
      track.update(this.time, this.o.lift);
    }
  }

  clear() {
    this.tracks.forEach((t) => t.reset());
  }

  surfaceDistance(pos, vehicle){
    const phys = vehicle && vehicle.physics;
    if (!phys || !phys.world || !phys.rapier) return null;
    const R      = phys.rapier;
    const origin = new R.Vector3(pos.x, pos.y, pos.z);
    const dir    = new R.Vector3(0, -1, 0);
    const ray    = new R.Ray(origin, dir);
    const body   = vehicle.chassisBody || null;
    const hit = body
      ? phys.world.castRayAndGetNormal(ray, this.o.maxSurfaceDist, true, undefined, undefined, undefined, body)
      : phys.world.castRayAndGetNormal(ray, this.o.maxSurfaceDist, true);
    if (!hit || hit.normal.y < this.o.normalThreshold) return null;
    return hit.timeOfImpact;
  }
}