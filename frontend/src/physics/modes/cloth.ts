import type { PhysicsEngine } from "../PhysicsEngine";
import { ParticleSystem } from "../ParticleSystem";

export const clothMode = {
  name: "cloth" as const,
  dim: 2 as const,

  defaultParams(): Record<string, number | string | null> {
    return {
      rows: 12,
      cols: 12,
      spacing: 25,
      start_x: 200,
      start_y: 50,
      structural_stiffness: 300,
      shear_stiffness: 150,
      bending_stiffness: 50,
      spring_damping: 8,
      mass: 1,
      constraint_iterations: 5,
      drag: 3,
      gravity_x: 0,
      gravity_y: 120,
      wind_strength: 0,
      max_speed: 400,
      floor_y: null,
      floor_restitution: 0.3,
      pin_mode: "all_top",
      canvas_width: 800,
      canvas_height: 600,
    };
  },

  setup(engine: PhysicsEngine, params: Record<string, unknown>): void {
    const defaults = this.defaultParams();
    const p = { ...defaults, ...params } as Record<string, unknown>;
    engine.reset();
    engine.dim = 2;
    engine.gravity = new Float32Array([p.gravity_x as number, p.gravity_y as number]);
    engine.dragCoefficient = p.drag as number;
    engine.constraintIterations = Math.floor(p.constraint_iterations as number);
    engine.windStrength = p.wind_strength as number;
    engine.maxSpeed = p.max_speed as number;

    if (p.floor_y != null) {
      engine.floorY = p.floor_y as number;
      engine.floorRestitution = p.floor_restitution as number;
    }

    const rows = Math.floor(p.rows as number);
    const cols = Math.floor(p.cols as number);
    const spacing = p.spacing as number;
    const sx = p.start_x as number;
    const sy = p.start_y as number;
    const pinMode = p.pin_mode as string;

    const positions: number[][] = [];
    const pinned: boolean[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        positions.push([sx + x * spacing, sy + y * spacing]);
        if (pinMode === "all_top") {
          pinned.push(y === 0);
        } else {
          pinned.push(y === 0 && x % 3 === 0);
        }
      }
    }

    engine.particles = ParticleSystem.create(positions, undefined, pinned);

    const diag = spacing * Math.SQRT2;
    const kd = p.spring_damping as number;
    const structK = p.structural_stiffness as number;
    const shearK = p.shear_stiffness as number;
    const bendK = p.bending_stiffness as number;

    const idx = (r: number, c: number) => r * cols + c;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Structural
        if (x < cols - 1) engine.springs.add(idx(y, x), idx(y, x + 1), spacing, structK, kd);
        if (y < rows - 1) engine.springs.add(idx(y, x), idx(y + 1, x), spacing, structK, kd);

        // Shear
        if (x < cols - 1 && y < rows - 1) {
          engine.springs.add(idx(y, x), idx(y + 1, x + 1), diag, shearK, kd);
          engine.springs.add(idx(y + 1, x), idx(y, x + 1), diag, shearK, kd);
        }

        // Bending
        if (x < cols - 2) engine.springs.add(idx(y, x), idx(y, x + 2), spacing * 2, bendK, kd);
        if (y < rows - 2) engine.springs.add(idx(y, x), idx(y + 2, x), spacing * 2, bendK, kd);
      }
    }

    engine.bounds = {
      minPos: new Float32Array([0, 0]),
      maxPos: new Float32Array([p.canvas_width as number, p.canvas_height as number]),
    };
    engine.boundsMode = "clamp";
  },
};
