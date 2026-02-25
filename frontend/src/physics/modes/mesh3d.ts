import type { PhysicsEngine } from "../PhysicsEngine";
import { ParticleSystem } from "../ParticleSystem";

export const mesh3dMode = {
  name: "mesh3d" as const,
  dim: 3 as const,

  defaultParams(): Record<string, number> {
    return {
      grid_size: 5,
      spacing: 60,
      stiffness: 20,
      spring_damping: 3,
      mass: 1.5,
      max_speed: 200,
      particle_mass: 1.5,
      particle_radius_factor: 5,
      bounds_margin: 250,
      drag: 2,
      gravity_x: 0,
      gravity_y: 0,
      gravity_z: 0,
    };
  },

  setup(engine: PhysicsEngine, params: Record<string, number>): void {
    const p = { ...this.defaultParams(), ...params };
    engine.reset();
    engine.dim = 3;
    engine.gravity = new Float32Array([p.gravity_x, p.gravity_y, p.gravity_z]);
    engine.dragCoefficient = p.drag;
    engine.maxSpeed = p.max_speed;
    engine.enableCollisions = true;

    const gs = Math.floor(p.grid_size);
    const spacing = p.spacing;
    const mass = p.particle_mass;
    const margin = p.bounds_margin;
    const k = p.stiffness;
    const kd = p.spring_damping;
    const diag = spacing * Math.SQRT2;

    const positions: number[][] = [];
    for (let x = 0; x < gs; x++) {
      for (let y = 0; y < gs; y++) {
        for (let z = 0; z < gs; z++) {
          positions.push([
            (x - gs / 2) * spacing,
            (y - gs / 2) * spacing,
            (z - gs / 2) * spacing,
          ]);
        }
      }
    }

    const n = positions.length;
    const masses = new Array(n).fill(mass);
    engine.particles = ParticleSystem.create(positions, masses);

    // Small random initial velocities
    const vel = engine.particles.velocities;
    for (let i = 0; i < n * 3; i++) {
      vel[i] = (Math.random() - 0.5) * 2.0;
    }

    // Collision radii
    engine.collisionRadii = new Float32Array(n);
    engine.collisionRadii.fill(mass * p.particle_radius_factor);

    // Bounds
    engine.bounds = {
      minPos: new Float32Array([-margin, -margin, -margin]),
      maxPos: new Float32Array([margin, margin, margin]),
    };
    engine.boundsMode = "elastic";

    const idx = (x: number, y: number, z: number) => x * gs * gs + y * gs + z;

    // Interior structural + diagonal springs
    for (let x = 0; x < gs - 1; x++) {
      for (let y = 0; y < gs - 1; y++) {
        for (let z = 0; z < gs - 1; z++) {
          engine.springs.add(idx(x, y, z), idx(x + 1, y, z), spacing, k, kd);
          engine.springs.add(idx(x, y, z), idx(x, y + 1, z), spacing, k, kd);
          engine.springs.add(idx(x, y, z), idx(x, y, z + 1), spacing, k, kd);
          engine.springs.add(idx(x, y, z), idx(x + 1, y + 1, z), diag, k, kd);
          engine.springs.add(idx(x, y + 1, z), idx(x + 1, y, z), diag, k, kd);
          engine.springs.add(idx(x, y, z), idx(x + 1, y, z + 1), diag, k, kd);
          engine.springs.add(idx(x, y, z + 1), idx(x + 1, y, z), diag, k, kd);
          engine.springs.add(idx(x, y, z), idx(x, y + 1, z + 1), diag, k, kd);
          engine.springs.add(idx(x, y, z + 1), idx(x, y + 1, z), diag, k, kd);
        }
      }
    }

    // Edge springs for faces not covered by interior loop
    for (let y = 0; y < gs - 1; y++) {
      for (let z = 0; z < gs - 1; z++) {
        engine.springs.add(idx(gs - 1, y, z), idx(gs - 1, y + 1, z), spacing, k, kd);
        engine.springs.add(idx(gs - 1, y, z), idx(gs - 1, y, z + 1), spacing, k, kd);
      }
    }
    for (let x = 0; x < gs - 1; x++) {
      for (let z = 0; z < gs - 1; z++) {
        engine.springs.add(idx(x, gs - 1, z), idx(x + 1, gs - 1, z), spacing, k, kd);
        engine.springs.add(idx(x, gs - 1, z), idx(x, gs - 1, z + 1), spacing, k, kd);
      }
    }
    for (let x = 0; x < gs - 1; x++) {
      for (let y = 0; y < gs - 1; y++) {
        engine.springs.add(idx(x, y, gs - 1), idx(x + 1, y, gs - 1), spacing, k, kd);
        engine.springs.add(idx(x, y, gs - 1), idx(x, y + 1, gs - 1), spacing, k, kd);
      }
    }
    for (let x = 0; x < gs - 1; x++) {
      engine.springs.add(idx(x, gs - 1, gs - 1), idx(x + 1, gs - 1, gs - 1), spacing, k, kd);
    }
    for (let y = 0; y < gs - 1; y++) {
      engine.springs.add(idx(gs - 1, y, gs - 1), idx(gs - 1, y + 1, gs - 1), spacing, k, kd);
    }
    for (let z = 0; z < gs - 1; z++) {
      engine.springs.add(idx(gs - 1, gs - 1, z), idx(gs - 1, gs - 1, z + 1), spacing, k, kd);
    }
  },
};
