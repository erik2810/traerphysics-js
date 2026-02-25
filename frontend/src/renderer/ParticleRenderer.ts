import * as THREE from "three";
import { COLORS, PARTICLE_RADIUS_BASE, POINTS_THRESHOLD } from "../constants";
import type { Topology } from "../types";

export class ParticleRenderer {
  private scene: THREE.Scene;
  private mesh: THREE.InstancedMesh | null = null;
  private count = 0;
  private dim: 2 | 3 = 2;
  private pinnedFlags: Uint8Array | null = null;
  private grabbedIndex: number | null = null;

  private colorDefault = new THREE.Color(COLORS.particle);
  private colorPinned = new THREE.Color(COLORS.particlePinned);
  private colorGrabbed = new THREE.Color(COLORS.particleGrabbed);
  private tempMatrix = new THREE.Matrix4();
  private tempColor = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  updateTopology(topology: Topology): void {
    // Remove old mesh
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }

    this.count = topology.numParticles;
    this.dim = topology.dim;
    this.pinnedFlags = topology.pinned;

    const radius = PARTICLE_RADIUS_BASE;
    const geometry =
      this.count > POINTS_THRESHOLD
        ? new THREE.SphereGeometry(radius, 6, 4)
        : new THREE.SphereGeometry(radius, 12, 8);

    const material = new THREE.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.2,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, this.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Set initial colors
    for (let i = 0; i < this.count; i++) {
      const pinned = this.pinnedFlags && this.pinnedFlags[i];
      this.mesh.setColorAt(i, pinned ? this.colorPinned : this.colorDefault);
      this.tempMatrix.setPosition(0, 0, 0);
      this.mesh.setMatrixAt(i, this.tempMatrix);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    this.scene.add(this.mesh);
  }

  updatePositions(positions: Float32Array, dim: number): void {
    if (!this.mesh || this.count === 0) return;

    for (let i = 0; i < this.count; i++) {
      const offset = i * dim;
      const x = positions[offset];
      const y = positions[offset + 1];
      const z = dim === 3 ? positions[offset + 2] : 0;
      this.tempMatrix.makeScale(1, 1, 1);
      this.tempMatrix.setPosition(x, y, z);
      this.mesh.setMatrixAt(i, this.tempMatrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  highlightParticle(index: number | null): void {
    if (!this.mesh) return;

    // Restore previous grabbed particle color
    if (this.grabbedIndex !== null && this.grabbedIndex !== index) {
      const pinned =
        this.pinnedFlags && this.pinnedFlags[this.grabbedIndex];
      this.mesh.setColorAt(
        this.grabbedIndex,
        pinned ? this.colorPinned : this.colorDefault,
      );
    }

    // Highlight new particle
    if (index !== null) {
      this.mesh.setColorAt(index, this.colorGrabbed);
    }

    this.grabbedIndex = index;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  getInstancedMesh(): THREE.InstancedMesh | null {
    return this.mesh;
  }

  getParticlePosition(index: number): THREE.Vector3 | null {
    if (!this.mesh || index < 0 || index >= this.count) return null;
    this.mesh.getMatrixAt(index, this.tempMatrix);
    const pos = new THREE.Vector3();
    pos.setFromMatrixPosition(this.tempMatrix);
    return pos;
  }
}
