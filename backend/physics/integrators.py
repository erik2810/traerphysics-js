from __future__ import annotations
import torch
from .particle import ParticleSystem


def verlet_integrate(ps: ParticleSystem, dt: float) -> None:
    """Verlet integration matching traerphysics.js Particle.integrate():
        vel = pos - prev
        next = pos + vel + acc * dt²
        prev = pos
    """
    mask = ~ps.pinned.unsqueeze(-1)  # (N, 1)
    dt_sq = dt * dt

    current = ps.positions.clone()
    velocity = current - ps.prev_positions
    ps.positions = torch.where(
        mask,
        current + velocity + ps.accelerations * dt_sq,
        current,
    )
    ps.prev_positions = current
    ps.accelerations.zero_()


def euler_integrate(ps: ParticleSystem, dt: float) -> None:
    """Explicit Euler integration for modes needing explicit velocity (mesh3d collisions).
        v += a * dt
        x += v * dt
    """
    mask = ~ps.pinned.unsqueeze(-1)  # (N, 1)

    ps.velocities += ps.accelerations * dt
    ps.velocities = torch.where(mask, ps.velocities, torch.zeros_like(ps.velocities))
    ps.positions += ps.velocities * dt * mask.float()
    ps.accelerations.zero_()


def clamp_velocities(ps: ParticleSystem, max_speed: float) -> None:
    """Clamp particle velocities to a maximum speed."""
    if max_speed <= 0:
        return
    speed = ps.velocities.norm(dim=-1, keepdim=True)  # (N, 1)
    too_fast = speed > max_speed
    scale = torch.where(too_fast, max_speed / speed.clamp(min=1e-6), torch.ones_like(speed))
    ps.velocities *= scale
