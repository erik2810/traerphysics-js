import * as THREE from "three";
import type { ParticleRenderer } from "../renderer/ParticleRenderer";

export class MousePicker {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private particleRenderer: ParticleRenderer;
  private dim: 2 | 3 = 2;

  private grabbedIndex: number | null = null;
  private dragPlane = new THREE.Plane();
  private intersection = new THREE.Vector3();

  onGrab: ((index: number) => void) | null = null;
  onDrag: ((index: number, position: number[]) => void) | null = null;
  onRelease: ((index: number) => void) | null = null;

  constructor(
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    particleRenderer: ParticleRenderer,
  ) {
    this.camera = camera;
    this.renderer = renderer;
    this.particleRenderer = particleRenderer;

    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", this._onPointerDown);
    canvas.addEventListener("pointermove", this._onPointerMove);
    canvas.addEventListener("pointerup", this._onPointerUp);
  }

  setDim(dim: 2 | 3): void {
    this.dim = dim;
  }

  get isGrabbing(): boolean {
    return this.grabbedIndex !== null;
  }

  private _updateMouse(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private _onPointerDown = (event: PointerEvent): void => {
    this._updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const mesh = this.particleRenderer.getInstancedMesh();
    if (!mesh) return;

    const hits = this.raycaster.intersectObject(mesh);
    if (hits.length > 0 && hits[0].instanceId !== undefined) {
      const index = hits[0].instanceId;
      this.grabbedIndex = index;

      // Set up drag plane perpendicular to camera at the particle's position
      const pos = this.particleRenderer.getParticlePosition(index);
      if (pos) {
        const cameraDir = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDir);
        this.dragPlane.setFromNormalAndCoplanarPoint(cameraDir, pos);
      }

      this.particleRenderer.highlightParticle(index);
      this.onGrab?.(index);
    }
  };

  private _onPointerMove = (event: PointerEvent): void => {
    if (this.grabbedIndex === null) return;

    this._updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
      const pos =
        this.dim === 3
          ? [this.intersection.x, this.intersection.y, this.intersection.z]
          : [this.intersection.x, this.intersection.y];
      this.onDrag?.(this.grabbedIndex, pos);
    }
  };

  private _onPointerUp = (_event: PointerEvent): void => {
    if (this.grabbedIndex !== null) {
      this.particleRenderer.highlightParticle(null);
      this.onRelease?.(this.grabbedIndex);
      this.grabbedIndex = null;
    }
  };

  dispose(): void {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this._onPointerDown);
    canvas.removeEventListener("pointermove", this._onPointerMove);
    canvas.removeEventListener("pointerup", this._onPointerUp);
  }
}
