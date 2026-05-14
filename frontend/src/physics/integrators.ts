import type { ParticleSystem } from "./ParticleSystem";

/**
 * Verlet integration matching traerphysics.js Particle.integrate():
 *   vel = pos - prev
 *   next = pos + vel + acc * dt²
 *   prev = pos
 */
export function verletIntegrate(ps: ParticleSystem, dt: number): void {
  const dim = ps.dim;
  const pos = ps.positions;
  const prev = ps.prevPositions;
  const acc = ps.accelerations;
  const dtSq = dt * dt;

  for (let i = 0; i < ps.count; i++) {
    if (ps.pinned[i]) {
      for (let d = 0; d < dim; d++) {
        acc[i * dim + d] = 0;
      }
      continue;
    }
    for (let d = 0; d < dim; d++) {
      const idx = i * dim + d;
      const current = pos[idx];
      const velocity = current - prev[idx];
      pos[idx] = current + velocity + acc[idx] * dtSq;
      prev[idx] = current;
      acc[idx] = 0;
    }
  }
}

/**
 * Explicit Euler integration (for mesh3d where explicit velocity is needed for collisions).
 *   v += a * dt
 *   x += v * dt
 */
export function eulerIntegrate(ps: ParticleSystem, dt: number): void {
  const dim = ps.dim;
  const pos = ps.positions;
  const vel = ps.velocities;
  const acc = ps.accelerations;

  for (let i = 0; i < ps.count; i++) {
    if (ps.pinned[i]) {
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
