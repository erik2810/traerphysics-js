import type { PhysicsEngine } from "../PhysicsEngine";
import { ParticleSystem } from "../ParticleSystem";

export const ropeMode = {
  name: "rope" as const,
  dim: 2 as const,

  defaultParams(): Record<string, number> {
    return {
      num_segments: 15,
      segment_length: 25,
      start_x: 400,
      start_y: 50,
      spring_k: 0.5,
      mass: 1,
      drag: 0.5,
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

    const n = Math.floor(p.num_segments);
    const segLen = p.segment_length;
    const sx = p.start_x;
    const sy = p.start_y;

    const positions: number[][] = [];
    const masses: number[] = [];
    const pinned: boolean[] = [];

    for (let i = 0; i < n; i++) {
      positions.push([sx, sy + i * segLen]);
      masses.push(p.mass);
      pinned.push(i === 0);
    }

    engine.particles = ParticleSystem.create(positions, masses, pinned);

    const k = p.spring_k;
    for (let i = 0; i < n - 1; i++) {
      engine.springs.add(i, i + 1, segLen, k);
    }

    engine.bounds = {
      minPos: new Float32Array([0, 0]),
      maxPos: new Float32Array([p.canvas_width, p.canvas_height]),
    };
    engine.boundsMode = "clamp";

    // Initial whip velocity: increasing horizontal push down the chain
    const dt = engine.dt;
    const ps = engine.particles;
    for (let i = 1; i < n; i++) {
      const t = i / (n - 1); // 0 at top, 1 at bottom
      const vx = 120 * t;
      const vy = -30 * t;
      ps.prevPositions[i * 2] = ps.positions[i * 2] - vx * dt;
      ps.prevPositions[i * 2 + 1] = ps.positions[i * 2 + 1] - vy * dt;
    }
  },
};
