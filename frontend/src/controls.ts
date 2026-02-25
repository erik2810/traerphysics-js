import type { SceneContext } from "./scene";
import { configure2D, configure3D } from "./scene";

export function setupCameraForDim(ctx: SceneContext, dim: number): void {
  if (dim === 3) {
    configure3D(ctx);
  } else {
    configure2D(ctx);
  }
}
