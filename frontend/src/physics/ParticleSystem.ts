export class ParticleSystem {
  positions: Float32Array;
  prevPositions: Float32Array;
  velocities: Float32Array;
  accelerations: Float32Array;
  masses: Float32Array;
  invMasses: Float32Array;
  pinned: Uint8Array;
  dim: number;
  count: number;

  private constructor(
    positions: Float32Array,
    prevPositions: Float32Array,
    velocities: Float32Array,
    accelerations: Float32Array,
    masses: Float32Array,
    invMasses: Float32Array,
    pinned: Uint8Array,
    dim: number,
    count: number,
  ) {
    this.positions = positions;
    this.prevPositions = prevPositions;
    this.velocities = velocities;
    this.accelerations = accelerations;
    this.masses = masses;
    this.invMasses = invMasses;
    this.pinned = pinned;
    this.dim = dim;
    this.count = count;
  }

  static create(
    positions: number[][],
    masses?: number[],
    pinned?: boolean[],
  ): ParticleSystem {
    const n = positions.length;
    const dim = positions[0]?.length ?? 2;

    const pos = new Float32Array(n * dim);
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < dim; d++) {
        pos[i * dim + d] = positions[i][d];
      }
    }

    const m = new Float32Array(n);
    const invM = new Float32Array(n);
    const pin = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
      m[i] = masses ? masses[i] : 1.0;
      pin[i] = pinned && pinned[i] ? 1 : 0;
      invM[i] = pin[i] ? 0.0 : 1.0 / m[i];
    }

    return new ParticleSystem(
      pos,
      new Float32Array(pos),
      new Float32Array(n * dim),
      new Float32Array(n * dim),
      m,
      invM,
      pin,
      dim,
      n,
    );
  }

  pin(index: number): void {
    this.pinned[index] = 1;
    this.invMasses[index] = 0.0;
  }

  unpin(index: number): void {
    this.pinned[index] = 0;
    this.invMasses[index] = 1.0 / this.masses[index];
  }

  setPosition(index: number, pos: number[]): void {
    const dim = this.dim;
    for (let d = 0; d < dim; d++) {
      this.positions[index * dim + d] = pos[d];
      this.prevPositions[index * dim + d] = pos[d];
      this.velocities[index * dim + d] = 0;
    }
  }
}
