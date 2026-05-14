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
      gravity_y: 0,
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

    const cx = p.canvas_width / 2;
    const cy = p.canvas_height / 2;
    const n = Math.floor(p.num_particles);

    const positions: number[][] = [[cx, cy]];
    const masses = [10];
    const pinned = [true];

    const orbitRadius = 150;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const r = orbitRadius + (Math.random() - 0.5) * 80;
      positions.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
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

    // Initial tangential velocity for orbital motion
    const dt = engine.dt;
    const ps = engine.particles;
    for (let i = 1; i <= n; i++) {
      const dx = ps.positions[i * 2] - cx;
      const dy = ps.positions[i * 2 + 1] - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      // Tangential velocity (perpendicular to radial direction)
      const speed = 100 + Math.random() * 60;
      const vx = (-dy / dist) * speed;
      const vy = (dx / dist) * speed;
      ps.prevPositions[i * 2] = ps.positions[i * 2] - vx * dt;
      ps.prevPositions[i * 2 + 1] = ps.positions[i * 2 + 1] - vy * dt;
    }
  },
};
