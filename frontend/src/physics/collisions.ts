import type { ParticleSystem } from "./ParticleSystem";

export interface Bounds {
  minPos: Float32Array;
  maxPos: Float32Array;
}

export function enforceBoundsClamp(ps: ParticleSystem, bounds: Bounds): void {
  const dim = ps.dim;
  const pos = ps.positions;
  for (let i = 0; i < ps.count; i++) {
    for (let d = 0; d < dim; d++) {
      const idx = i * dim + d;
      if (pos[idx] < bounds.minPos[d]) pos[idx] = bounds.minPos[d];
      if (pos[idx] > bounds.maxPos[d]) pos[idx] = bounds.maxPos[d];
    }
  }
}

export function enforceBoundsElastic(
  ps: ParticleSystem,
  bounds: Bounds,
  radii: Float32Array | null = null,
  restitution: number = 0.8,
): void {
  const dim = ps.dim;
  const pos = ps.positions;
  const vel = ps.velocities;

  for (let i = 0; i < ps.count; i++) {
    const r = radii ? radii[i] : 0;
    for (let d = 0; d < dim; d++) {
      const idx = i * dim + d;
      if (pos[idx] - r < bounds.minPos[d]) {
        pos[idx] = bounds.minPos[d] + r;
        vel[idx] *= -restitution;
      }
      if (pos[idx] + r > bounds.maxPos[d]) {
        pos[idx] = bounds.maxPos[d] - r;
        vel[idx] *= -restitution;
      }
    }
  }
}

export function floorCollision(
  ps: ParticleSystem,
  floorY: number,
  restitution: number = 0.3,
): void {
  const dim = ps.dim;
  const pos = ps.positions;
  const vel = ps.velocities;

  for (let i = 0; i < ps.count; i++) {
    const yIdx = i * dim + 1;
    if (pos[yIdx] < floorY) {
      pos[yIdx] = floorY;
      vel[yIdx] *= -restitution;
    }
  }
}

export function resolveElasticCollisions(
  ps: ParticleSystem,
  radii: Float32Array,
): void {
  const n = ps.count;
  if (n < 2) return;
  const dim = ps.dim;
  const pos = ps.positions;
  const vel = ps.velocities;
  const masses = ps.masses;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Distance between particles
      let distSq = 0;
      for (let d = 0; d < dim; d++) {
        const dd = pos[j * dim + d] - pos[i * dim + d];
        distSq += dd * dd;
      }
      const dist = Math.sqrt(distSq);
      const minDist = radii[i] + radii[j];

      if (dist >= minDist || dist < 1e-6) continue;

      const invDist = 1.0 / dist;

      // Relative velocity along normal
      let velAlongNormal = 0;
      for (let d = 0; d < dim; d++) {
        const normal = (pos[j * dim + d] - pos[i * dim + d]) * invDist;
        velAlongNormal += (vel[j * dim + d] - vel[i * dim + d]) * normal;
      }

      // Impulse
      const totalMass = masses[i] + masses[j];
      const impulseMag = (2.0 * velAlongNormal) / totalMass;

      // Overlap separation
      const overlap = minDist - dist;

      for (let d = 0; d < dim; d++) {
        const normal = (pos[j * dim + d] - pos[i * dim + d]) * invDist;
        const impulse = impulseMag * normal;

        vel[i * dim + d] += impulse * masses[j];
        vel[j * dim + d] -= impulse * masses[i];

        const sep = normal * overlap * 0.5;
        pos[i * dim + d] -= sep;
        pos[j * dim + d] += sep;
      }
    }
  }
}
