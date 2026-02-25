import type { SimulationState, Topology } from "../types";

const MSG_STATE = 0x01;
const MSG_TOPOLOGY = 0x02;

export function getMessageType(buffer: ArrayBuffer): number {
  return new DataView(buffer).getUint8(0);
}

export function isStateFrame(buffer: ArrayBuffer): boolean {
  return getMessageType(buffer) === MSG_STATE;
}

export function isTopologyFrame(buffer: ArrayBuffer): boolean {
  return getMessageType(buffer) === MSG_TOPOLOGY;
}

export function decodeStateFrame(buffer: ArrayBuffer): SimulationState {
  const view = new DataView(buffer);
  const dim = view.getUint8(1) as 2 | 3;
  const numParticles = view.getUint16(2, true);
  const simTime = view.getFloat32(4, true);
  const positions = new Float32Array(buffer, 8, numParticles * dim);
  return { dim, numParticles, positions, simTime };
}

export function decodeTopologyFrame(buffer: ArrayBuffer): Topology {
  const view = new DataView(buffer);
  const dim = view.getUint8(1) as 2 | 3;
  const numParticles = view.getUint16(2, true);
  const numSprings = view.getUint32(4, true);

  let offset = 8;

  // Masses: N * float32
  const masses = new Float32Array(buffer, offset, numParticles);
  offset += numParticles * 4;

  // Pinned flags: N * uint8
  const pinned = new Uint8Array(buffer, offset, numParticles);
  offset += numParticles;

  // Padding to 2-byte alignment for uint16 spring pairs
  if (offset % 2 !== 0) offset += 1;

  // Spring pairs: S * 2 * uint16
  const springPairs = new Uint16Array(buffer, offset, numSprings * 2);

  return { dim, numParticles, numSprings, masses, pinned, springPairs };
}
