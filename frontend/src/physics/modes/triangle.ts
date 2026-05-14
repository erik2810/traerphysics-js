import type { PhysicsEngine } from "../PhysicsEngine";
import { ParticleSystem } from "../ParticleSystem";

export const triangleMode = {
  name: "triangle" as const,
  dim: 2 as const,

  defaultParams(): Record<string, number> {
    return {
      side_length: 100,
      spring_k: 0.3,
      angle_stiffness: 0.3,
      target_angle: Math.PI / 3,
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

    const cx = p.canvas_width / 2;
    const cy = p.canvas_height / 2;
    const side = p.side_length;

    const h = side * Math.sqrt(3) / 2;
    const p0 = [cx, cy - h * 2 / 3];
    const p1 = [cx + side / 2, cy + h / 3];
    const p2 = [cx - side / 2, cy + h / 3];

    engine.particles = ParticleSystem.create([p0, p1, p2]);

    const k = p.spring_k;
    engine.springs.add(0, 1, side, k);
    engine.springs.add(0, 2, side, k);
    engine.springs.add(1, 2, side, k);

    engine.angleConstraints.add(1, 0, 2, p.target_angle, p.angle_stiffness);

    engine.bounds = {
      minPos: new Float32Array([0, 0]),
      maxPos: new Float32Array([p.canvas_width, p.canvas_height]),
    };
    engine.boundsMode = "elastic";

    // Initial rotational velocity (counter-clockwise spin + drift)
    const dt = engine.dt;
    const ps = engine.particles;
    const spin = 80; // angular velocity → tangential speed
    // Centroid
    const centX = (p0[0] + p1[0] + p2[0]) / 3;
    const centY = (p0[1] + p1[1] + p2[1]) / 3;
    const drift = 40;
    const verts = [p0, p1, p2];
    for (let i = 0; i < 3; i++) {
      const dx = verts[i][0] - centX;
      const dy = verts[i][1] - centY;
      // Tangential velocity: perpendicular to radius, scaled by spin
      const vx = -dy / side * spin + drift;
      const vy = dx / side * spin;
      ps.prevPositions[i * 2] = ps.positions[i * 2] - vx * dt;
      ps.prevPositions[i * 2 + 1] = ps.positions[i * 2 + 1] - vy * dt;
    }
  },
};
