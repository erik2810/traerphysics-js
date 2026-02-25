import type { PhysicsEngine } from "../PhysicsEngine";
import { ParticleSystem } from "../ParticleSystem";

export const attractionMode = {
  name: "attraction" as const,
  dim: 2 as const,

  defaultParams(): Record<string, number> {
    return {
      num_particles: 20,
      attraction_strength: 5000,
      min_dist: 20,
      max_dist: 500,
      mass: 1,
      drag: 2,
      gravity_x: 0,
      gravity_y: 50,
      max_speed: 300,
      canvas_width: 800,
      canvas_height: 600,
    };
  },

  setup(engine: PhysicsEngine, params: Record<string, number>): void {
    const p = { ...this.defaultParams(), ...params };
    engine.reset();
    engine.dim = 2;
    engine.gravity = new Float32Array([p.gravity_x, p.gravity_y]);
    engine.dragCoefficient = p.drag;
    engine.maxSpeed = p.max_speed;

    const cx = p.canvas_width / 2;
    const cy = p.canvas_height / 2;
    const n = Math.floor(p.num_particles);

    const positions: number[][] = [[cx, cy]];
    const masses = [10];
    const pinned = [true];

    for (let i = 0; i < n; i++) {
      positions.push([Math.random() * p.canvas_width, Math.random() * p.canvas_height]);
      masses.push(p.mass);
      pinned.push(false);
    }

    engine.particles = ParticleSystem.create(positions, masses, pinned);

    for (let i = 1; i <= n; i++) {
      engine.attractions.add(0, i, p.attraction_strength, p.min_dist, p.max_dist);
    }

    engine.bounds = {
      minPos: new Float32Array([0, 0]),
      maxPos: new Float32Array([p.canvas_width, p.canvas_height]),
    };
    engine.boundsMode = "elastic";
  },
};
