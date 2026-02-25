import * as THREE from "three";
import { COLORS, SPRING_OPACITY } from "../constants";
import type { Topology } from "../types";

export class SpringRenderer {
  private scene: THREE.Scene;
  private lineSegments: THREE.LineSegments | null = null;
  private springPairs: Uint16Array | null = null;
  private count = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  updateTopology(topology: Topology): void {
    // Remove old lines
    if (this.lineSegments) {
      this.scene.remove(this.lineSegments);
      this.lineSegments.geometry.dispose();
      (this.lineSegments.material as THREE.Material).dispose();
      this.lineSegments = null;
    }

    this.springPairs = topology.springPairs;
    this.count = topology.numSprings;

    if (this.count === 0) return;

    // 2 vertices per line segment, 3 components each
    const positions = new Float32Array(this.count * 2 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, this.count * 2);

    const material = new THREE.LineBasicMaterial({
      color: COLORS.spring,
      transparent: true,
      opacity: SPRING_OPACITY,
    });

    this.lineSegments = new THREE.LineSegments(geometry, material);
    this.scene.add(this.lineSegments);
  }

  updatePositions(positions: Float32Array, dim: number): void {
    if (!this.lineSegments || !this.springPairs || this.count === 0) return;

    const posAttr = this.lineSegments.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let s = 0; s < this.count; s++) {
      const a = this.springPairs[s * 2];
      const b = this.springPairs[s * 2 + 1];
      const oA = a * dim;
      const oB = b * dim;
      const oLine = s * 6; // 2 vertices * 3 components

      arr[oLine] = positions[oA];
      arr[oLine + 1] = positions[oA + 1];
      arr[oLine + 2] = dim === 3 ? positions[oA + 2] : 0;

      arr[oLine + 3] = positions[oB];
      arr[oLine + 4] = positions[oB + 1];
      arr[oLine + 5] = dim === 3 ? positions[oB + 2] : 0;
    }

    posAttr.needsUpdate = true;
  }

  setVisible(visible: boolean): void {
    if (this.lineSegments) {
      this.lineSegments.visible = visible;
    }
  }
}
