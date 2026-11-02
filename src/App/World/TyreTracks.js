// src/App/World/TyreTracks.js
import * as THREE from "three";
const UP = new THREE.Vector3(0, 1, 0);

const TREAD_VERTEX = `
attribute vec4 color;
attribute vec2 aTrack;
varying vec4 vColor;
varying vec2 vTrack;

void main() {
  vColor = color;
  vTrack = aTrack;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const TREAD_FRAGMENT = `
varying vec4 vColor;
varying vec2 vTrack;

uniform float uTreadPitch;     // distance between transverse tread grooves (world units)
uniform float uSipeWidth;      // transverse groove width (world units)
uniform float uSipeStrength;   // how strongly the transverse grooves reveal the ground (0..1)
uniform float uChevronSkew;    // chevron arm skew as a fraction of the pitch (0 = straight sipes)
uniform float uGrooveWidth;    // circumferential groove width (fraction of track width)
uniform float uGrooveStrength; // how strongly grooves reveal the ground (0..1)

void main() {
  float u = vTrack.x; // arc length along the track
  float v = vTrack.y; // 0..1 across the track width

  // Transverse tread element: a chevron (V) groove at each tread pitch.
  // The vertex of the V sits on the centre line at each pitch and the arms
  // trail back toward the outer edges. uChevronSkew = 0 gives straight sipes.
  float phase = fract( u / uTreadPitch );
  float b = abs( 2.0 * v - 1.0 );
  float dChev = min( fract( phase + uChevronSkew * b ), 1.0 - fract( phase + uChevronSkew * b ) );
  float sipe = 1.0 - smoothstep( 0.0, max( uSipeWidth, 1e-5 ), dChev * uTreadPitch );

  // Two circumferential grooves at 1/3 and 2/3 of the track width.
  float dGroove = min( abs( v - 1.0 / 3.0 ), abs( v - 2.0 / 3.0 ) );
  float groove = 1.0 - smoothstep( 0.0, max( uGrooveWidth, 1e-5 ), dGroove );

  // Soften the outer edges of the track so it reads as a tread print.
  float edge = smoothstep( 0.0, 0.12, v ) * ( 1.0 - smoothstep( 0.88, 1.0, v ) );

  float coverage = ( 1.0 - uSipeStrength * sipe ) * ( 1.0 - uGrooveStrength * groove );

  gl_FragColor = vec4( vColor.rgb, vColor.a * coverage * edge );
  #include <colorspace_fragment>
}
`;

class WheelTrack {
  constructor({ maxPoints, maxAge, halfWidth, color = 0x2b2b2b, baseAlpha = 0.55, fadeHeight = 0.25, gapDistance = 1.0, tread = {} }) {
    Object.assign(this, { maxPoints, maxAge, halfWidth, baseAlpha, fadeHeight, gapDistance, tread });
    this.color = new THREE.Color(color);
    this.points = []; // oldest → newest: { pos: Vector3, birth: number }
    this.posArray = new Float32Array(maxPoints * 2 * 3);
    this.colArray = new Float32Array(maxPoints * 2 * 4); // 4-component => per-vertex alpha
    this.trackArray = new Float32Array(maxPoints * 2 * 2); // per-vertex (arc length, lateral 0..1) for the tread pattern
    this.idxArray = new Uint16Array((maxPoints - 1) * 6); // fixed; visible count set via drawRange
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(this.posArray, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("color",    new THREE.BufferAttribute(this.colArray, 4).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute("aTrack",   new THREE.BufferAttribute(this.trackArray, 2).setUsage(THREE.DynamicDrawUsage));
    this.indexAttr = new THREE.BufferAttribute(this.idxArray, 1).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setIndex(this.indexAttr);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTreadPitch:     { value: tread.pitch ?? 0.012 },
        uSipeWidth:      { value: tread.sipeWidth ?? 0.004 },
        uSipeStrength:   { value: tread.sipeStrength ?? 0.85 },
        uChevronSkew:    { value: tread.chevronSkew ?? 0.35 },
        uGrooveWidth:    { value: tread.grooveWidth ?? 0.08 },
        uGrooveStrength: { value: tread.grooveStrength ?? 0.8 },
      },
      vertexShader: TREAD_VERTEX,
      fragmentShader: TREAD_FRAGMENT,
    });
    this.mesh = new THREE.Mesh(this.geometry, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this._last = new THREE.Vector3(Infinity, Infinity, Infinity);
    this._arc = 0; // absolute arc length along this run (world units) — a stable tread anchor that doesn't move as old points fade out
    this._arcWrap = (tread.pitch ?? 0.012) * 1024; // integer multiple of the pitch, so wrapping preserves fract(u / pitch) while keeping the value float32-friendly
    this._dir = new THREE.Vector3(); this._side = new THREE.Vector3(1,0,0);
    this._left = new THREE.Vector3(); this._right = new THREE.Vector3();
  }
  reset(){ this.points.length = 0; this._last.set(Infinity, Infinity, Infinity); this._arc = 0; }

  record(pos, now, surfaceDist){
    const d = this._last.distanceTo(pos);
    if (d > this.gapDistance) this._arc = 0; else this._arc += d;
    this.points.push({ pos, birth: now, surfaceDist, arc: this._arc % this._arcWrap });
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
    let vi = 0, ci = 0, ti = 0;
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
      for (const lateral of [0, 1]){
        this.colArray[ci++] = this.color.r; this.colArray[ci++] = this.color.g; this.colArray[ci++] = this.color.b; this.colArray[ci++] = a;
        this.trackArray[ti++] = p.arc;
        this.trackArray[ti++] = lateral;
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
    this.geometry.attributes.aTrack.needsUpdate = true;
  }
}

export default class TyreTracks {
  constructor(scene, opts = {}) {
    const o = Object.assign({ maxPoints: 240, maxAge: 4, halfWidth: 0.02, recordDistance: 0.02, lift: 0.002, trackColor: 0x2b2b2b, trackAlpha: 0.75, fadeHeight: 0.025, gapDistance: 1.0, maxSurfaceDist: 3.0, normalThreshold: 0.7, tread: {} }, opts);
    this.o = o; this.time = 0; this.tracks = [];
    this.group = new THREE.Group(); scene.add(this.group);
    for (let i = 0; i < 4; i++){
      const t = new WheelTrack({ maxPoints: o.maxPoints, maxAge: o.maxAge, halfWidth: o.halfWidth, color: o.trackColor, baseAlpha: o.trackAlpha, fadeHeight: o.fadeHeight, gapDistance: o.gapDistance, tread: o.tread });
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