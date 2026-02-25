import GUI from "lil-gui";
import type { SimulationAPI } from "../SimulationAPI";
import type { ModeInfo } from "../types";

interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  apiField: string;
}

const SLIDER_CONFIGS: SliderConfig[] = [
  { key: "gravity_y", label: "Gravity Y", min: -500, max: 500, step: 5, apiField: "gravity" },
  { key: "drag", label: "Drag", min: 0, max: 20, step: 0.5, apiField: "drag" },
  { key: "spring_k", label: "Spring Stiffness", min: 1, max: 500, step: 1, apiField: "spring_k" },
  { key: "spring_damping", label: "Spring Damping", min: 0, max: 50, step: 0.5, apiField: "spring_damping" },
  { key: "structural_stiffness", label: "Structural K", min: 1, max: 600, step: 5, apiField: "spring_k" },
  { key: "mass", label: "Mass", min: 0.01, max: 20, step: 0.1, apiField: "mass" },
  { key: "max_speed", label: "Max Speed", min: 10, max: 1000, step: 10, apiField: "max_speed" },
  { key: "wind_strength", label: "Wind", min: 0, max: 50, step: 0.5, apiField: "wind_strength" },
  { key: "attraction_strength", label: "Attraction", min: 0, max: 20000, step: 100, apiField: "attraction_strength" },
  { key: "constraint_iterations", label: "Constraint Iters", min: 1, max: 20, step: 1, apiField: "constraint_iterations" },
  { key: "stiffness", label: "Stiffness", min: 1, max: 200, step: 1, apiField: "spring_k" },
];

export class GuiPanel {
  private gui: GUI;
  private api: SimulationAPI;
  private physicsFolder: GUI | null = null;

  private state = {
    mode: "triangle",
    paused: false,
    showSprings: true,
  };

  onShowSpringsChange: ((visible: boolean) => void) | null = null;
  onModeChanged: (() => void) | null = null;

  constructor(api: SimulationAPI) {
    this.api = api;
    this.gui = new GUI({ title: "Traer Physics" });
    this._buildModeFolder();
    this._buildVisualsFolder();
  }

  async init(): Promise<void> {
    const modes = await this.api.getModes();
    const current = await this.api.getCurrentMode();
    this.state.mode = current.mode;
    this.state.paused = current.paused;
    this._rebuildPhysicsFolder(modes, current);
  }

  private _buildModeFolder(): void {
    const folder = this.gui.addFolder("Mode");
    folder
      .add(this.state, "mode", ["triangle", "attraction", "rope", "cloth", "mesh3d"])
      .name("Simulation")
      .onChange(async (mode: string) => {
        await this.api.switchMode(mode);
        this.onModeChanged?.();
        const modes = await this.api.getModes();
        const current = await this.api.getCurrentMode();
        this._rebuildPhysicsFolder(modes, current);
      });

    folder
      .add({ reset: () => this.api.reset().then(() => this.onModeChanged?.()) }, "reset")
      .name("Reset");

    folder
      .add(this.state, "paused")
      .name("Paused")
      .onChange((paused: boolean) => {
        if (paused) this.api.pause();
        else this.api.resume();
      });

    folder.open();
  }

  private _buildVisualsFolder(): void {
    const folder = this.gui.addFolder("Visuals");
    folder
      .add(this.state, "showSprings")
      .name("Show Springs")
      .onChange((v: boolean) => this.onShowSpringsChange?.(v));
    folder.close();
  }

  private _rebuildPhysicsFolder(
    modes: ModeInfo[],
    current: { mode: string; dim?: number; params: Record<string, unknown> },
  ): void {
    if (this.physicsFolder) this.physicsFolder.destroy();
    this.physicsFolder = this.gui.addFolder("Physics");

    const modeInfo = modes.find((m) => m.name === current.mode);
    if (!modeInfo) return;

    const params = { ...modeInfo.default_params, ...current.params };
    const dim = modeInfo.dim;

    for (const cfg of SLIDER_CONFIGS) {
      if (!(cfg.key in params)) continue;

      const wrapper = { value: params[cfg.key] as number };
      this.physicsFolder
        .add(wrapper, "value", cfg.min, cfg.max, cfg.step)
        .name(cfg.label)
        .onChange((v: number) => this._sendParam(cfg, v, params, dim));
    }

    this.physicsFolder.open();
  }

  private _sendParam(
    cfg: SliderConfig,
    value: number,
    params: Record<string, unknown>,
    dim: number,
  ): void {
    params[cfg.key] = value;

    if (cfg.apiField === "gravity") {
      const gx = cfg.key === "gravity_x" ? value : ((params.gravity_x as number) ?? 0);
      const gy = cfg.key === "gravity_y" ? value : ((params.gravity_y as number) ?? 0);
      if (dim === 3) {
        const gz = cfg.key === "gravity_z" ? value : ((params.gravity_z as number) ?? 0);
        this.api.updateParams({ gravity: [gx, gy, gz] });
      } else {
        this.api.updateParams({ gravity: [gx, gy] });
      }
    } else {
      this.api.updateParams({ [cfg.apiField]: value });
    }
  }
}
