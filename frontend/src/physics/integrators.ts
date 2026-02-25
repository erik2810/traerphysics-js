import type { ParticleSystem } from "./ParticleSystem";

export function eulerIntegrate(ps: ParticleSystem, dt: number): void {
  const dim = ps.dim;
  const pos = ps.positions;
  const vel = ps.velocities;
  const acc = ps.accelerations;

  for (let i = 0; i < ps.count; i++) {
    if (ps.pinned[i]) {
      // Clear accelerations for pinned particles
      for (let d = 0; d < dim; d++) {
        acc[i * dim + d] = 0;
        vel[i * dim + d] = 0;
      }
      continue;
    }
    for (let d = 0; d < dim; d++) {
      const idx = i * dim + d;
      vel[idx] += acc[idx] * dt;
      pos[idx] += vel[idx] * dt;
      acc[idx] = 0;
    }
  }
}

export function clampVelocities(ps: ParticleSystem, maxSpeed: number): void {
  if (maxSpeed <= 0) return;
  const dim = ps.dim;
  const vel = ps.velocities;

  for (let i = 0; i < ps.count; i++) {
    let speedSq = 0;
    for (let d = 0; d < dim; d++) {
      speedSq += vel[i * dim + d] * vel[i * dim + d];
    }
    if (speedSq > maxSpeed * maxSpeed) {
      const scale = maxSpeed / Math.sqrt(speedSq);
      for (let d = 0; d < dim; d++) {
        vel[i * dim + d] *= scale;
      }
    }
  }
}
