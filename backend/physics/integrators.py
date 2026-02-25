from __future__ import annotations
import torch
from .particle import ParticleSystem


def euler_integrate(ps: ParticleSystem, dt: float) -> None:
    """Explicit Euler integration matching gorillasun / Paul Bourke.

    v(t+dt) = v(t) + a(t) * dt
    x(t+dt) = x(t) + v(t+dt) * dt

    References:
      - https://paulbourke.net/miscellaneous/particle/
      - https://www.gorillasun.de/blog/spring-physics-and-connecting-particles-with-springs/
    """
    mask = ~ps.pinned.unsqueeze(-1)  # (N, 1)

    # Update velocity: v += a * dt
    ps.velocities += ps.accelerations * dt

    # Zero velocity for pinned particles
    ps.velocities = torch.where(mask, ps.velocities, torch.zeros_like(ps.velocities))

    # Update position: x += v * dt
    ps.positions += ps.velocities * dt * mask.float()

    # Clear acceleration accumulator
    ps.accelerations.zero_()


def clamp_velocities(ps: ParticleSystem, max_speed: float) -> None:
    """Clamp particle velocities to a maximum speed.
    Reference: gorillasun article velocity limiting."""
    if max_speed <= 0:
        return
    speed = ps.velocities.norm(dim=-1, keepdim=True)  # (N, 1)
    too_fast = speed > max_speed
    scale = torch.where(too_fast, max_speed / speed.clamp(min=1e-6), torch.ones_like(speed))
    ps.velocities *= scale
