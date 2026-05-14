import { ParticleSystem } from "./ParticleSystem";
import {
  SpringSystem,
  AttractionSystem,
  applySpringForces,
  applySpringsPositionBased,
  applyAttractions,
  applyViscousDrag,
  applyVerletDrag,
  applyGravity,
  applyWind,
} from "./forces";
import {
  DistanceConstraintSystem,
  AngleConstraintSystem,
  solveDistanceConstraints,
  solveAngleConstraints,
} from "./constraints";
import {
  type Bounds,
  enforceBoundsClamp,
  enforceBoundsElastic,
  floorCollision,
  resolveElasticCollisions,
} from "./collisions";
import { verletIntegrate, eulerIntegrate, clampVelocities } from "./integrators";

export class PhysicsEngine {
  dim: number;
  particles: ParticleSystem | null = null;

  springs = new SpringSystem();
  attractions = new AttractionSystem();
  distanceConstraints = new DistanceConstraintSystem();
  angleConstraints = new AngleConstraintSystem();

  gravity: Float32Array;
  dragCoefficient = 0;
  windStrength = 0;
  maxSpeed = 0;

  bounds: Bounds | null = null;
  boundsMode: "clamp" | "elastic" = "clamp";
  floorY: number | null = null;
  floorRestitution = 0.3;

  constraintIterations = 1;
  enableCollisions = false;
  collisionRadii: Float32Array | null = null;

  /** "verlet" matches original traerphysics.js; "euler" for mesh3d collisions */
  integrationMode: "verlet" | "euler" = "verlet";

  /** Snapshot of net accelerations captured right before integration clears them. */
  lastAccelerations: Float32Array | null = null;

  simTime = 0;
  dt = 1 / 60;

  constructor(dim: number = 2) {
    this.dim = dim;
    this.gravity = new Float32Array(dim);
  }

  reset(): void {
    this.particles = null;
    this.springs = new SpringSystem();
    this.attractions = new AttractionSystem();
    this.distanceConstraints = new DistanceConstraintSystem();
    this.angleConstraints = new AngleConstraintSystem();

    this.gravity = new Float32Array(this.dim);
    this.dragCoefficient = 0;
    this.windStrength = 0;
    this.maxSpeed = 0;

    this.bounds = null;
    this.boundsMode = "clamp";
    this.floorY = null;
    this.floorRestitution = 0.3;

    this.constraintIterations = 1;
    this.enableCollisions = false;
    this.collisionRadii = null;

    this.integrationMode = "verlet";
    this.lastAccelerations = null;
    this.simTime = 0;
  }

  step(): void {
    const ps = this.particles;
    if (!ps || ps.count === 0) return;

    if (this.integrationMode === "verlet") {
      this.stepVerlet(ps);
    } else {
      this.stepEuler(ps);
    }

    this.simTime += this.dt;
  }

  /**
   * Verlet step matching traerphysics.js Physics.step():
   *   1. Gravity, drag, wind, attractions → accumulate in accelerations
   *   2. Position-based springs (direct position correction)
   *   3. Constraints (distance, angle — position correction)
   *   4. Snapshot accelerations (for force vector visualization)
   *   5. Verlet integrate: next = pos + (pos - prev) + acc * dt²
   *   6. Bounds / floor
   */
  private stepVerlet(ps: ParticleSystem): void {
    const dt = this.dt;

    // 1. Accumulate acceleration-based forces
    let hasGravity = false;
    for (let d = 0; d < this.dim; d++) {
      if (this.gravity[d] !== 0) { hasGravity = true; break; }
    }
    if (hasGravity) applyGravity(ps, this.gravity);
    if (this.windStrength > 0) applyWind(ps, this.windStrength);
    if (this.dragCoefficient > 0) applyVerletDrag(ps, this.dragCoefficient);
    applyAttractions(ps, this.attractions);

    // 2. Position-based springs
    applySpringsPositionBased(ps, this.springs);

    // 3. Constraints
    for (let i = 0; i < this.constraintIterations; i++) {
      solveDistanceConstraints(ps, this.distanceConstraints);
      solveAngleConstraints(ps, this.angleConstraints);
    }

    // 4. Snapshot accelerations before integration clears them
    this.snapshotAccelerations(ps);

    // 5. Verlet integrate
    verletIntegrate(ps, dt);

    // 6. Bounds
    if (this.bounds) {
      if (this.boundsMode === "elastic") {
        enforceBoundsElastic(ps, this.bounds, this.collisionRadii);
      } else {
        enforceBoundsClamp(ps, this.bounds);
      }
    }

    // 7. Floor
    if (this.floorY !== null) {
      floorCollision(ps, this.floorY, this.floorRestitution);
    }
  }

  /**
   * Euler step for modes needing explicit velocity (mesh3d collisions).
   */
  private stepEuler(ps: ParticleSystem): void {
    const dt = this.dt;

    // 1. Accumulate forces
    let hasGravity = false;
    for (let d = 0; d < this.dim; d++) {
      if (this.gravity[d] !== 0) { hasGravity = true; break; }
    }
    if (hasGravity) applyGravity(ps, this.gravity);
    if (this.windStrength > 0) applyWind(ps, this.windStrength);
    if (this.dragCoefficient > 0) applyViscousDrag(ps, this.dragCoefficient, dt);
    applySpringForces(ps, this.springs);
    applyAttractions(ps, this.attractions);

    // 2. Snapshot accelerations before integration clears them
    this.snapshotAccelerations(ps);

    // 3. Integrate
    eulerIntegrate(ps, dt);

    // 4. Clamp velocities
    if (this.maxSpeed > 0) clampVelocities(ps, this.maxSpeed);

    // 5. Solve constraints
    for (let i = 0; i < this.constraintIterations; i++) {
      solveDistanceConstraints(ps, this.distanceConstraints);
      solveAngleConstraints(ps, this.angleConstraints);
    }

    // 6. Elastic collisions
    if (this.enableCollisions && this.collisionRadii) {
      resolveElasticCollisions(ps, this.collisionRadii);
    }

    // 7. Bounds
    if (this.bounds) {
      if (this.boundsMode === "elastic") {
        enforceBoundsElastic(ps, this.bounds, this.collisionRadii);
      } else {
        enforceBoundsClamp(ps, this.bounds);
      }
    }

    // 8. Floor
    if (this.floorY !== null) {
      floorCollision(ps, this.floorY, this.floorRestitution);
    }
  }

  private snapshotAccelerations(ps: ParticleSystem): void {
    const len = ps.count * ps.dim;
    if (!this.lastAccelerations || this.lastAccelerations.length !== len) {
      this.lastAccelerations = new Float32Array(len);
    }
    this.lastAccelerations.set(ps.accelerations);
  }

  getSpringPairs(): Uint16Array {
    const totalSprings = this.springs.count + this.distanceConstraints.count;
    const pairs = new Uint16Array(totalSprings * 2);
    let idx = 0;

    for (let i = 0; i < this.springs.count; i++) {
      pairs[idx++] = this.springs.indicesA[i];
      pairs[idx++] = this.springs.indicesB[i];
    }
    for (let i = 0; i < this.distanceConstraints.count; i++) {
      pairs[idx++] = this.distanceConstraints.indicesA[i];
      pairs[idx++] = this.distanceConstraints.indicesB[i];
    }

    return pairs;
  }
}
