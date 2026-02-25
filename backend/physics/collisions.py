from __future__ import annotations
from dataclasses import dataclass
from typing import Optional
import torch
from .particle import ParticleSystem


@dataclass
class Bounds:
    """Axis-aligned bounding box."""
    min_pos: torch.Tensor  # (dim,) float32
    max_pos: torch.Tensor  # (dim,) float32


def enforce_bounds_clamp(ps: ParticleSystem, bounds: Bounds) -> None:
    """Clamp particles to bounding box. Ported from traerphysics.js enforceBounds (lines 258-265)."""
    ps.positions = torch.clamp(ps.positions, min=bounds.min_pos, max=bounds.max_pos)


def enforce_bounds_elastic(ps: ParticleSystem, bounds: Bounds,
                           radii: Optional[torch.Tensor] = None,
                           restitution: float = 0.8) -> None:
    """Elastic boundary collision with velocity reflection.
    Ported from mesh.html Particle.checkEdges (lines 64-87).
    restitution: coefficient of restitution (0=fully inelastic, 1=perfect bounce)."""
    r = radii if radii is not None else torch.zeros(ps.count)

    for d in range(ps.dim):
        low = bounds.min_pos[d]
        high = bounds.max_pos[d]

        below = ps.positions[:, d] - r < low
        above = ps.positions[:, d] + r > high

        ps.positions[below, d] = low + r[below]
        ps.velocities[below, d] *= -restitution

        ps.positions[above, d] = high - r[above]
        ps.velocities[above, d] *= -restitution


def floor_collision(ps: ParticleSystem, floor_y: float, restitution: float = 0.3) -> None:
    """Floor collision with bounce. Ported from traer.py (lines 94-97).
    Uses the Y axis (index 1) as vertical."""
    below = ps.positions[:, 1] < floor_y
    ps.positions[below, 1] = floor_y
    ps.velocities[below, 1] *= -restitution


def resolve_elastic_collisions(ps: ParticleSystem, radii: torch.Tensor) -> None:
    """Pairwise elastic particle collisions with impulse response.
    Ported from mesh.html Particle.checkCollision (lines 89-107).
    Brute-force O(N^2) — suitable for small particle counts."""
    n = ps.count
    if n < 2:
        return

    # Pairwise distances
    dists = torch.cdist(ps.positions, ps.positions)  # (N, N)
    min_dists = radii.unsqueeze(0) + radii.unsqueeze(1)  # (N, N)

    # Find colliding pairs (upper triangle only to avoid double-processing)
    mask = (dists < min_dists) & (dists > 1e-6)
    mask = torch.triu(mask, diagonal=1)

    pairs = mask.nonzero()  # (P, 2)
    if pairs.shape[0] == 0:
        return

    i = pairs[:, 0]
    j = pairs[:, 1]

    pos_i = ps.positions[i]
    pos_j = ps.positions[j]
    vel_i = ps.velocities[i]
    vel_j = ps.velocities[j]
    mass_i = ps.masses[i]
    mass_j = ps.masses[j]

    # Normal direction
    delta = pos_j - pos_i
    dist = delta.norm(dim=-1, keepdim=True).clamp(min=1e-6)
    normal = delta / dist

    # Relative velocity
    rel_vel = vel_j - vel_i
    vel_along_normal = (rel_vel * normal).sum(dim=-1, keepdim=True)

    # Impulse (equal mass simplification: impulse = vel_along_normal)
    total_mass = mass_i.unsqueeze(-1) + mass_j.unsqueeze(-1)
    impulse = 2.0 * vel_along_normal * normal / total_mass

    # Apply impulse
    impulse_i = impulse * mass_j.unsqueeze(-1)
    impulse_j = impulse * mass_i.unsqueeze(-1)

    # Position separation
    overlap = (radii[i] + radii[j]).unsqueeze(-1) - dist
    separation = normal * overlap * 0.5

    # Scatter updates
    ps.velocities.index_add_(0, i, impulse_i)
    ps.velocities.index_add_(0, j, -impulse_j)
    ps.positions.index_add_(0, i, -separation)
    ps.positions.index_add_(0, j, separation)
