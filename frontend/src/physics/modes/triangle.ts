import type { PhysicsEngine } from "../PhysicsEngine";
import { ParticleSystem } from "../ParticleSystem";

export const triangleMode = {
  name: "triangle" as const,
  dim: 2 as const,

  defaultParams(): Record<string, number> {
    return {
      side_length: 100,
      spring_k: 150,
      spring_damping: 12,
      angle_stiffness: 0.3,
      target_angle: Math.PI / 3,
      mass: 1,
      drag: 4,
      gravity_x: 0,
      gravity_y: 10,
      max_speed: 200,
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
    const side = p.side_length;

    const h = side * Math.sqrt(3) / 2;
    const p0 = [cx, cy - h * 2 / 3];
    const p1 = [cx + side / 2, cy + h / 3];
    const p2 = [cx - side / 2, cy + h / 3];

    engine.particles = ParticleSystem.create([p0, p1, p2]);

    const k = p.spring_k;
    const kd = p.spring_damping;
    engine.springs.add(0, 1, side, k, kd);
    engine.springs.add(0, 2, side, k, kd);
    engine.springs.add(1, 2, side, k, kd);

    engine.angleConstraints.add(1, 0, 2, p.target_angle, p.angle_stiffness);

    engine.bounds = {
      minPos: new Float32Array([0, 0]),
      maxPos: new Float32Array([p.canvas_width, p.canvas_height]),
    };
    engine.boundsMode = "elastic";
  },
};
