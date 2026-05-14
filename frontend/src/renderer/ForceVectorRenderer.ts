import * as THREE from "three";
import { COLORS } from "../constants";

/**
 * Renders net acceleration vectors as colored line segments from each particle.
 * Line goes from particle position to position + acceleration * scale.
 */
export class ForceVectorRenderer {
  private scene: THREE.Scene;
  private lineSegments: THREE.LineSegments | null = null;
  private count = 0;
  private _visible = true;
  scale = 30;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  updateTopology(numParticles: number): void {
    if (this.lineSegments) {
      this.scene.remove(this.lineSegments);
      this.lineSegments.geometry.dispose();
      (this.lineSegments.material as THREE.Material).dispose();
      this.lineSegments = null;
    }

    this.count = numParticles;
    if (this.count === 0) return;

    // 2 vertices per particle (start + tip), 3 xyz components each
    const positions = new Float32Array(this.count * 2 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, this.count * 2);

    const material = new THREE.LineBasicMaterial({
      color: COLORS.forceVector,
      linewidth: 2,
    });

    this.lineSegments = new THREE.LineSegments(geometry, material);
    this.lineSegments.visible = this._visible;
    this.scene.add(this.lineSegments);
  }

  updateForces(
    positions: Float32Array,
    forces: Float32Array | undefined,
    dim: number,
  ): void {
    if (!this.lineSegments || this.count === 0 || !forces) return;

    const posAttr = this.lineSegments.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < this.count; i++) {
      const pOff = i * dim;
      const lOff = i * 6; // 2 vertices * 3 xyz

      const px = positions[pOff];
      const py = positions[pOff + 1];
      const pz = dim === 3 ? positions[pOff + 2] : 0;

      const fx = forces[pOff] * this.scale;
      const fy = forces[pOff + 1] * this.scale;
      const fz = dim === 3 ? forces[pOff + 2] * this.scale : 0;

      // Start at particle position
      arr[lOff] = px;
      arr[lOff + 1] = py;
      arr[lOff + 2] = pz;

      // End at position + scaled force
      arr[lOff + 3] = px + fx;
      arr[lOff + 4] = py + fy;
      arr[lOff + 5] = pz + fz;
    }

    posAttr.needsUpdate = true;
  }

  setVisible(visible: boolean): void {
    this._visible = visible;
    if (this.lineSegments) {
      this.lineSegments.visible = visible;
    }
  }
}
