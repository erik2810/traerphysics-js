import { API_BASE } from "../constants";
import type { SimulationAPI } from "../SimulationAPI";
import type { ModeInfo } from "../types";

export class ApiClient implements SimulationAPI {
  private base: string;

  constructor(base: string = API_BASE) {
    this.base = base;
  }

  async getModes(): Promise<ModeInfo[]> {
    const res = await fetch(`${this.base}/modes`);
    return res.json();
  }

  async getCurrentMode(): Promise<{
    mode: string;
    num_particles: number;
    num_springs: number;
    dim: number;
    paused: boolean;
    params: Record<string, unknown>;
  }> {
    const res = await fetch(`${this.base}/mode`);
    return res.json();
  }

  async switchMode(
    mode: string,
    params?: Record<string, unknown>,
  ): Promise<void> {
    await fetch(`${this.base}/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, params: params ?? {} }),
    });
  }

  async updateParams(params: Record<string, unknown>): Promise<void> {
    await fetch(`${this.base}/params`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async reset(): Promise<void> {
    await fetch(`${this.base}/reset`, { method: "POST" });
  }

  async pause(): Promise<void> {
    await fetch(`${this.base}/pause`, { method: "POST" });
  }

  async resume(): Promise<void> {
    await fetch(`${this.base}/resume`, { method: "POST" });
  }
}
