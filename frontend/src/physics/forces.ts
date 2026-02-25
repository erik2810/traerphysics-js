import type { ParticleSystem } from "./ParticleSystem";

export class SpringSystem {
  indicesA: Uint16Array;
  indicesB: Uint16Array;
  restLengths: Float32Array;
  stiffnesses: Float32Array;
  dampings: Float32Array;
  count: number;

  constructor() {
    this.indicesA = new Uint16Array(0);
    this.indicesB = new Uint16Array(0);
    this.restLengths = new Float32Array(0);
    this.stiffnesses = new Float32Array(0);
    this.dampings = new Float32Array(0);
    this.count = 0;
  }

  add(a: number, b: number, restLength: number, stiffness: number, damping: number): void {
    const i = this.count;
    this.count++;

    const grow = <T extends Uint16Array | Float32Array>(
      arr: T,
      val: number,
    ): T => {
      const Constructor = arr.constructor as { new (len: number): T };
      const next = new Constructor(this.count);
      next.set(arr);
      next[i] = val;
      return next;
    };

    this.indicesA = grow(this.indicesA, a);
    this.indicesB = grow(this.indicesB, b);
    this.restLengths = grow(this.restLengths, restLength);
    this.stiffnesses = grow(this.stiffnesses, stiffness);
    this.dampings = grow(this.dampings, damping);
  }
}

export function applySpringForces(ps: ParticleSystem, springs: SpringSystem): void {
  if (springs.count === 0) return;
  const dim = ps.dim;
  const pos = ps.positions;
  const vel = ps.velocities;
  const acc = ps.accelerations;
  const invM = ps.invMasses;

  for (let s = 0; s < springs.count; s++) {
    const a = springs.indicesA[s];
    const b = springs.indicesB[s];
    const ks = springs.stiffnesses[s];
    const kd = springs.dampings[s];
    const rest = springs.restLengths[s];

    // Displacement and distance
    let distSq = 0;
    for (let d = 0; d < dim; d++) {
      const dd = pos[b * dim + d] - pos[a * dim + d];
      distSq += dd * dd;
    }
    const dist = Math.sqrt(distSq);
    if (dist < 1e-6) continue;
    const invDist = 1.0 / dist;

    // Unit normal
    const deform = dist - rest;
    const fSpring = ks * deform;

    // Velocity-based damping along spring axis
    let vAlong = 0;
    for (let d = 0; d < dim; d++) {
      const n = (pos[b * dim + d] - pos[a * dim + d]) * invDist;
      vAlong += (vel[b * dim + d] - vel[a * dim + d]) * n;
    }
    const fDamp = kd * vAlong;
    const fTotal = fSpring + fDamp;

    // Apply forces: a gets +F, b gets -F
    for (let d = 0; d < dim; d++) {
      const n = (pos[b * dim + d] - pos[a * dim + d]) * invDist;
      const f = fTotal * n;
      acc[a * dim + d] += f * invM[a];
      acc[b * dim + d] -= f * invM[b];
    }
  }
}

export class AttractionSystem {
  indicesA: Uint16Array;
  indicesB: Uint16Array;
  strengths: Float32Array;
  minDists: Float32Array;
  maxDists: Float32Array;
  count: number;

  constructor() {
    this.indicesA = new Uint16Array(0);
    this.indicesB = new Uint16Array(0);
    this.strengths = new Float32Array(0);
    this.minDists = new Float32Array(0);
    this.maxDists = new Float32Array(0);
    this.count = 0;
  }

  add(a: number, b: number, strength: number, minDist: number, maxDist: number): void {
    const i = this.count;
    this.count++;

    const grow = <T extends Uint16Array | Float32Array>(
      arr: T,
      val: number,
    ): T => {
      const Constructor = arr.constructor as { new (len: number): T };
      const next = new Constructor(this.count);
      next.set(arr);
      next[i] = val;
      return next;
    };

    this.indicesA = grow(this.indicesA, a);
    this.indicesB = grow(this.indicesB, b);
    this.strengths = grow(this.strengths, strength);
    this.minDists = grow(this.minDists, minDist);
    this.maxDists = grow(this.maxDists, maxDist);
  }
}

export function applyAttractions(ps: ParticleSystem, attractions: AttractionSystem): void {
  if (attractions.count === 0) return;
  const dim = ps.dim;
  const pos = ps.positions;
  const acc = ps.accelerations;
  const invM = ps.invMasses;

  for (let s = 0; s < attractions.count; s++) {
    const a = attractions.indicesA[s];
    const b = attractions.indicesB[s];

    let distSq = 0;
    for (let d = 0; d < dim; d++) {
      const dd = pos[b * dim + d] - pos[a * dim + d];
      distSq += dd * dd;
    }
    const dist = Math.sqrt(distSq);
    if (dist < 1e-3) continue;
    if (dist < attractions.minDists[s] || dist > attractions.maxDists[s]) continue;

    const strength = attractions.strengths[s] / Math.max(distSq, 1e-6);

    for (let d = 0; d < dim; d++) {
      const direction = (pos[b * dim + d] - pos[a * dim + d]) / dist;
      const f = direction * strength;
      acc[a * dim + d] += f * invM[a];
      acc[b * dim + d] -= f * invM[b];
    }
  }
}

export function applyViscousDrag(ps: ParticleSystem, coefficient: number): void {
  if (coefficient <= 0) return;
  const dim = ps.dim;
  for (let i = 0; i < ps.count; i++) {
    const im = ps.invMasses[i];
    for (let d = 0; d < dim; d++) {
      ps.accelerations[i * dim + d] += -coefficient * ps.velocities[i * dim + d] * im;
    }
  }
}

export function applyGravity(ps: ParticleSystem, gravity: Float32Array): void {
  const dim = ps.dim;
  for (let i = 0; i < ps.count; i++) {
    if (ps.invMasses[i] <= 0) continue;
    for (let d = 0; d < dim; d++) {
      ps.accelerations[i * dim + d] += gravity[d];
    }
  }
}

export function applyWind(ps: ParticleSystem, windStrength: number): void {
  if (windStrength <= 0) return;
  const dim = ps.dim;
  for (let i = 0; i < ps.count; i++) {
    const im = ps.invMasses[i];
    if (im <= 0) continue;
    ps.accelerations[i * dim] += windStrength * (Math.random() - 0.5) * im;
  }
}
