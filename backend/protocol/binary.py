from __future__ import annotations
import struct
import torch

from .messages import MSG_STATE, MSG_TOPOLOGY
from backend.physics.engine import PhysicsEngine


def pack_state_frame(engine: PhysicsEngine) -> bytes:
    """Pack current particle positions into a binary state frame.

    Layout (little-endian):
        uint8   msg_type = 0x01
        uint8   dim
        uint16  num_particles
        float32 sim_time
        float32[] positions (N * dim values, flat)
    """
    ps = engine.particles
    n = ps.count
    dim = ps.dim
    header = struct.pack("<BBHf", MSG_STATE, dim, n, engine.sim_time)
    pos_bytes = ps.positions.contiguous().cpu().to(torch.float32).numpy().tobytes()
    return header + pos_bytes


def pack_topology_frame(engine: PhysicsEngine) -> bytes:
    """Pack topology (masses, pinned, spring pairs) into a binary frame.

    Layout (little-endian):
        uint8    msg_type = 0x02
        uint8    dim
        uint16   num_particles (N)
        uint32   num_springs (S)
        float32[] masses (N values)
        uint8[]   pinned flags (N values)
        uint16[]  spring pairs (S * 2 values, flat: [a0, b0, a1, b1, ...])
    """
    ps = engine.particles
    n = ps.count
    dim = ps.dim
    pairs = engine.get_spring_pairs()
    s = pairs.shape[0]

    header = struct.pack("<BBHI", MSG_TOPOLOGY, dim, n, s)
    masses_bytes = ps.masses.contiguous().cpu().to(torch.float32).numpy().tobytes()
    pinned_bytes = ps.pinned.contiguous().cpu().to(torch.uint8).numpy().tobytes()

    # Pad pinned bytes to 2-byte alignment for the uint16 spring pairs that follow
    padding = b"\x00" * (len(pinned_bytes) % 2)

    if s > 0:
        springs_bytes = pairs.contiguous().cpu().to(torch.int16).numpy().astype("uint16").tobytes()
    else:
        springs_bytes = b""

    return header + masses_bytes + pinned_bytes + padding + springs_bytes
