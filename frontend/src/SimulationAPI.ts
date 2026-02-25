import type { ModeInfo, InteractionEvent } from "./types";

export interface SimulationAPI {
  getModes(): Promise<ModeInfo[]>;
  getCurrentMode(): Promise<{
    mode: string;
    num_particles: number;
    num_springs: number;
    dim: number;
    paused: boolean;
    params: Record<string, unknown>;
  }>;
  switchMode(mode: string, params?: Record<string, unknown>): Promise<void>;
  updateParams(params: Record<string, unknown>): Promise<void>;
  reset(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
}

export interface DataSource {
  onStateFrame: ((cb: (state: import("./types").SimulationState) => void) => void);
  onTopologyFrame: ((cb: (topology: import("./types").Topology) => void) => void);
  onConnect: ((cb: () => void) => void);
  onDisconnect: ((cb: () => void) => void);
  sendInteraction: (event: InteractionEvent) => void;
  api: SimulationAPI;
  start: () => void;
  isLocal: boolean;
}
