import type { ParticleSystem } from "./ParticleSystem";

export class DistanceConstraintSystem {
  indicesA: Uint16Array;
  indicesB: Uint16Array;
  restLengths: Float32Array;
  stiffnesses: Float32Array;
  count: number;

  constructor() {
    this.indicesA = new Uint16Array(0);
    this.indicesB = new Uint16Array(0);
    this.restLengths = new Float32Array(0);
    this.stiffnesses = new Float32Array(0);
    this.count = 0;
  }

  add(a: number, b: number, restLength: number, stiffness: number = 1.0): void {
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
  }
}

export function solveDistanceConstraints(
  ps: ParticleSystem,
  constraints: DistanceConstraintSystem,
): void {
  if (constraints.count === 0) return;
  const dim = ps.dim;
  const pos = ps.positions;

  // Gauss-Seidel: process one constraint at a time, immediately update positions
  for (let c = 0; c < constraints.count; c++) {
    const a = constraints.indicesA[c];
    const b = constraints.indicesB[c];
    const rest = constraints.restLengths[c];
    const stiffness = constraints.stiffnesses[c];

    let distSq = 0;
    for (let d = 0; d < dim; d++) {
      const dd = pos[b * dim + d] - pos[a * dim + d];
      distSq += dd * dd;
    }
    const dist = Math.sqrt(distSq);
    if (dist < 1e-6) continue;

    const diff = (dist - rest) / dist;
    const halfCorr = stiffness * 0.5 * diff;

    const pinnedA = ps.pinned[a];
    const pinnedB = ps.pinned[b];

    for (let d = 0; d < dim; d++) {
      const delta = pos[b * dim + d] - pos[a * dim + d];
      const correction = halfCorr * delta;
      if (!pinnedA) pos[a * dim + d] += correction;
      if (!pinnedB) pos[b * dim + d] -= correction;
    }
  }
}

export class AngleConstraintSystem {
  indicesA: Uint16Array;
  indicesB: Uint16Array; // pivot
  indicesC: Uint16Array;
  targetAngles: Float32Array;
  stiffnesses: Float32Array;
  count: number;

  constructor() {
    this.indicesA = new Uint16Array(0);
    this.indicesB = new Uint16Array(0);
    this.indicesC = new Uint16Array(0);
    this.targetAngles = new Float32Array(0);
    this.stiffnesses = new Float32Array(0);
    this.count = 0;
  }

  add(a: number, b: number, c: number, targetAngle: number, stiffness: number = 0.5): void {
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
    this.indicesC = grow(this.indicesC, c);
    this.targetAngles = grow(this.targetAngles, targetAngle);
    this.stiffnesses = grow(this.stiffnesses, stiffness);
  }
}

export function solveAngleConstraints(
  ps: ParticleSystem,
  constraints: AngleConstraintSystem,
): void {
  if (constraints.count === 0) return;
  const pos = ps.positions;
  const dim = ps.dim;

  for (let c = 0; c < constraints.count; c++) {
    const a = constraints.indicesA[c];
    const b = constraints.indicesB[c]; // pivot
    const ci = constraints.indicesC[c];
    const target = constraints.targetAngles[c];
    const stiffness = constraints.stiffnesses[c];

    // Vectors from pivot b
    const abx = pos[a * dim] - pos[b * dim];
    const aby = pos[a * dim + 1] - pos[b * dim + 1];
    const cbx = pos[ci * dim] - pos[b * dim];
    const cby = pos[ci * dim + 1] - pos[b * dim + 1];

    const angleAB = Math.atan2(aby, abx);
    const angleCB = Math.atan2(cby, cbx);
    const currentAngle = angleCB - angleAB;

    // Wrap diff to [-pi, pi]
    let diff = currentAngle - target;
    diff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
    // Handle negative modulo
    if (diff < -Math.PI) diff += 2 * Math.PI;

    const correction = diff * stiffness;

    const lenAB = Math.sqrt(abx * abx + aby * aby);
    const lenCB = Math.sqrt(cbx * cbx + cby * cby);
    if (lenAB < 1e-6 || lenCB < 1e-6) continue;

    // Rotate endpoints around pivot
    const newAngleA = angleAB - correction * 0.5;
    const newAngleC = angleCB + correction * 0.5;

    const newAx = pos[b * dim] + Math.cos(newAngleA) * lenAB;
    const newAy = pos[b * dim + 1] + Math.sin(newAngleA) * lenAB;
    const newCx = pos[b * dim] + Math.cos(newAngleC) * lenCB;
    const newCy = pos[b * dim + 1] + Math.sin(newAngleC) * lenCB;

    if (!ps.pinned[a]) {
      pos[a * dim] = newAx;
      pos[a * dim + 1] = newAy;
    }
    if (!ps.pinned[ci]) {
      pos[ci * dim] = newCx;
      pos[ci * dim + 1] = newCy;
    }
  }
}
