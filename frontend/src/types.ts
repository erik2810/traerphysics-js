export interface SimulationState {
  dim: 2 | 3;
  numParticles: number;
  positions: Float32Array;
  simTime: number;
}

export interface Topology {
  dim: 2 | 3;
  numParticles: number;
  numSprings: number;
  masses: Float32Array;
  pinned: Uint8Array;
  springPairs: Uint16Array;
}

export interface ModeInfo {
  name: string;
  dim: 2 | 3;
  default_params: Record<string, number | string | null>;
}

export type InteractionEvent =
  | { type: "grab"; particleIndex: number }
  | { type: "drag"; particleIndex: number; position: number[] }
  | { type: "release"; particleIndex: number };
