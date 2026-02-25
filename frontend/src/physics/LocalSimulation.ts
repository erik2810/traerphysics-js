import type { SimulationAPI, DataSource } from "../SimulationAPI";
import type { ModeInfo, SimulationState, Topology, InteractionEvent } from "../types";
import { PhysicsEngine } from "./PhysicsEngine";
import { triangleMode, attractionMode, ropeMode, clothMode, mesh3dMode } from "./modes";

type ModeDefinition = {
  name: string;
  dim: 2 | 3;
  defaultParams(): Record<string, unknown>;
  setup(engine: PhysicsEngine, params: Record<string, unknown>): void;
};

const ALL_MODES: ModeDefinition[] = [
  triangleMode,
  attractionMode,
  ropeMode,
  clothMode as ModeDefinition,
  mesh3dMode,
];

export class LocalSimulation implements SimulationAPI {
  private engine = new PhysicsEngine(2);
  private modes: Map<string, ModeDefinition>;
  private currentModeName = "triangle";
  private currentParams: Record<string, unknown> = {};
  private paused = false;
  private animFrameId: number | null = null;
  private previousPinState: { index: number; wasPinned: boolean } | null = null;

  private _onStateFrame: ((state: SimulationState) => void) | null = null;
  private _onTopologyFrame: ((topology: Topology) => void) | null = null;
  private _onConnect: (() => void) | null = null;

  constructor() {
    this.modes = new Map(ALL_MODES.map((m) => [m.name, m]));
  }

  // --- SimulationAPI ---

  async getModes(): Promise<ModeInfo[]> {
    return ALL_MODES.map((m) => ({
      name: m.name,
      dim: m.dim,
      default_params: m.defaultParams() as Record<string, number | string | null>,
    }));
  }

  async getCurrentMode() {
    const e = this.engine;
    return {
      mode: this.currentModeName,
      num_particles: e.particles?.count ?? 0,
      num_springs: e.springs.count + e.distanceConstraints.count,
      dim: e.dim,
      paused: this.paused,
      params: { ...this.currentParams },
    };
  }

  async switchMode(mode: string, params?: Record<string, unknown>): Promise<void> {
    const modeDef = this.modes.get(mode);
    if (!modeDef) return;

    this.currentModeName = mode;
    this.currentParams = params ? { ...params } : {};
    modeDef.setup(this.engine, this.currentParams);
    this.emitTopology();
  }

  async updateParams(params: Record<string, unknown>): Promise<void> {
    const e = this.engine;

    if (params.gravity != null) {
      const g = params.gravity as number[];
      e.gravity = new Float32Array(g);
      this.currentParams.gravity_x = g[0];
      this.currentParams.gravity_y = g[1];
      if (g.length > 2) this.currentParams.gravity_z = g[2];
    }
    if (params.drag != null) {
      e.dragCoefficient = params.drag as number;
      this.currentParams.drag = params.drag;
    }
    if (params.wind_strength != null) {
      e.windStrength = params.wind_strength as number;
      this.currentParams.wind_strength = params.wind_strength;
    }
    if (params.max_speed != null) {
      e.maxSpeed = params.max_speed as number;
      this.currentParams.max_speed = params.max_speed;
    }
    if (params.constraint_iterations != null) {
      e.constraintIterations = params.constraint_iterations as number;
      this.currentParams.constraint_iterations = params.constraint_iterations;
    }
    if (params.spring_k != null && e.springs.count > 0) {
      e.springs.stiffnesses.fill(params.spring_k as number);
      this.currentParams.spring_k = params.spring_k;
    }
    if (params.spring_damping != null && e.springs.count > 0) {
      e.springs.dampings.fill(params.spring_damping as number);
      this.currentParams.spring_damping = params.spring_damping;
    }
    if (params.mass != null && e.particles) {
      const newMass = Math.max(params.mass as number, 0.01);
      const ps = e.particles;
      for (let i = 0; i < ps.count; i++) {
        if (!ps.pinned[i]) {
          ps.masses[i] = newMass;
          ps.invMasses[i] = 1.0 / newMass;
        }
      }
      this.currentParams.mass = params.mass;
    }
    if (params.attraction_strength != null && e.attractions.count > 0) {
      e.attractions.strengths.fill(params.attraction_strength as number);
      this.currentParams.attraction_strength = params.attraction_strength;
    }
  }

  async reset(): Promise<void> {
    const modeDef = this.modes.get(this.currentModeName);
    if (!modeDef) return;
    modeDef.setup(this.engine, this.currentParams);
    this.emitTopology();
  }

  async pause(): Promise<void> {
    this.paused = true;
  }

  async resume(): Promise<void> {
    this.paused = false;
  }

  // --- Interaction ---

  sendInteraction(event: InteractionEvent): void {
    const ps = this.engine.particles;
    if (!ps) return;

    switch (event.type) {
      case "grab":
        this.previousPinState = {
          index: event.particleIndex,
          wasPinned: ps.pinned[event.particleIndex] === 1,
        };
        ps.pin(event.particleIndex);
        break;
      case "drag":
        ps.setPosition(event.particleIndex, event.position);
        break;
      case "release":
        if (this.previousPinState && !this.previousPinState.wasPinned) {
          ps.unpin(event.particleIndex);
        }
        this.previousPinState = null;
        break;
    }
  }

  // --- DataSource factory ---

  createDataSource(): DataSource {
    return {
      onStateFrame: (cb) => { this._onStateFrame = cb; },
      onTopologyFrame: (cb) => { this._onTopologyFrame = cb; },
      onConnect: (cb) => { this._onConnect = cb; },
      onDisconnect: () => { /* local never disconnects */ },
      sendInteraction: (e) => this.sendInteraction(e),
      api: this,
      start: () => this.start(),
      isLocal: true,
    };
  }

  // --- Loop ---

  start(): void {
    // Setup default mode
    const modeDef = this.modes.get(this.currentModeName)!;
    modeDef.setup(this.engine, {});
    this._onConnect?.();
    this.emitTopology();

    const loop = () => {
      if (!this.paused && this.engine.particles) {
        this.engine.step();
        this._onStateFrame?.({
          dim: this.engine.dim as 2 | 3,
          numParticles: this.engine.particles.count,
          positions: this.engine.particles.positions,
          simTime: this.engine.simTime,
        });
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private emitTopology(): void {
    const ps = this.engine.particles;
    if (!ps) return;

    this._onTopologyFrame?.({
      dim: this.engine.dim as 2 | 3,
      numParticles: ps.count,
      numSprings: this.engine.springs.count + this.engine.distanceConstraints.count,
      masses: ps.masses,
      pinned: ps.pinned,
      springPairs: this.engine.getSpringPairs(),
    });
  }
}
