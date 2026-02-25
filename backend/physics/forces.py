from __future__ import annotations
from dataclasses import dataclass
import torch
from .particle import ParticleSystem


@dataclass
class SpringSystem:
    """Force-based Hooke's law springs with damping.

    Spring force formula (Paul Bourke):
        F = [ks * (|xb - xa| - r) + kd * dot(vb - va, n)] * n
    where n = unit vector from a to b, ks = spring constant, kd = damping,
    r = rest length. Force on a is +F, force on b is -F (Newton's 3rd law).

    Reference: https://paulbourke.net/miscellaneous/particle/
    """

    indices_a: torch.Tensor     # (S,) int64
    indices_b: torch.Tensor     # (S,) int64
    rest_lengths: torch.Tensor  # (S,) float32
    stiffnesses: torch.Tensor   # (S,) float32
    dampings: torch.Tensor      # (S,) float32

    @staticmethod
    def create() -> SpringSystem:
        return SpringSystem(
            indices_a=torch.zeros(0, dtype=torch.long),
            indices_b=torch.zeros(0, dtype=torch.long),
            rest_lengths=torch.zeros(0),
            stiffnesses=torch.zeros(0),
            dampings=torch.zeros(0),
        )

    @property
    def count(self) -> int:
        return self.indices_a.shape[0]

    def add(self, a: int, b: int, rest_length: float,
            stiffness: float = 0.1, damping: float = 0.01) -> None:
        self.indices_a = torch.cat([self.indices_a, torch.tensor([a], dtype=torch.long)])
        self.indices_b = torch.cat([self.indices_b, torch.tensor([b], dtype=torch.long)])
        self.rest_lengths = torch.cat([self.rest_lengths, torch.tensor([rest_length])])
        self.stiffnesses = torch.cat([self.stiffnesses, torch.tensor([stiffness])])
        self.dampings = torch.cat([self.dampings, torch.tensor([damping])])


def apply_spring_forces(ps: ParticleSystem, springs: SpringSystem) -> None:
    """Apply Hooke's law spring forces with velocity-based damping along the spring axis.

    For each spring connecting particles a and b:
      d = pos_b - pos_a           (displacement vector)
      dist = |d|
      n = d / dist                (unit direction a -> b)
      deform = dist - rest_length (extension > 0, compression < 0)
      F_spring = ks * deform      (Hooke's law, scalar)
      F_damp = kd * dot(vel_b - vel_a, n)  (damping along spring axis)
      F = (F_spring + F_damp) * n (total force vector)
      particle_a gets +F, particle_b gets -F

    References:
      - https://paulbourke.net/miscellaneous/particle/
      - https://www.gorillasun.de/blog/spring-physics-and-connecting-particles-with-springs/
    """
    if springs.count == 0:
        return

    pos_a = ps.positions[springs.indices_a]  # (S, dim)
    pos_b = ps.positions[springs.indices_b]  # (S, dim)
    vel_a = ps.velocities[springs.indices_a]  # (S, dim)
    vel_b = ps.velocities[springs.indices_b]  # (S, dim)

    d = pos_b - pos_a                                       # (S, dim)
    dist = d.norm(dim=-1, keepdim=True).clamp(min=1e-6)     # (S, 1)
    n = d / dist                                             # (S, 1) unit direction

    # Hooke's law: F_spring = ks * (dist - rest_length)
    deform = dist - springs.rest_lengths.unsqueeze(-1)       # (S, 1)
    f_spring = springs.stiffnesses.unsqueeze(-1) * deform    # (S, 1)

    # Damping along spring axis: F_damp = kd * dot(v_rel, n)
    v_rel = vel_b - vel_a                                    # (S, dim)
    v_along = (v_rel * n).sum(dim=-1, keepdim=True)          # (S, 1) scalar projection
    f_damp = springs.dampings.unsqueeze(-1) * v_along        # (S, 1)

    # Total force vector along the spring direction
    force = (f_spring + f_damp) * n                          # (S, dim)

    # Apply: a gets +F (pulled toward b), b gets -F (Newton's 3rd law)
    # Zero out forces for pinned particles via inv_mass
    inv_mass_a = ps.inv_masses[springs.indices_a].unsqueeze(-1)
    inv_mass_b = ps.inv_masses[springs.indices_b].unsqueeze(-1)

    acc_a = force * inv_mass_a
    acc_b = force * inv_mass_b

    ps.accelerations.index_add_(0, springs.indices_a, acc_a)
    ps.accelerations.index_add_(0, springs.indices_b, -acc_b)


@dataclass
class AttractionSystem:
    """Inverse-square attraction/repulsion forces between particle pairs.
    F = strength / |r|^2 along the line joining the particles.
    Reference: https://paulbourke.net/miscellaneous/particle/"""

    indices_a: torch.Tensor   # (A,) int64
    indices_b: torch.Tensor   # (A,) int64
    strengths: torch.Tensor   # (A,) float32
    min_dists: torch.Tensor   # (A,) float32
    max_dists: torch.Tensor   # (A,) float32

    @staticmethod
    def create() -> AttractionSystem:
        return AttractionSystem(
            indices_a=torch.zeros(0, dtype=torch.long),
            indices_b=torch.zeros(0, dtype=torch.long),
            strengths=torch.zeros(0),
            min_dists=torch.zeros(0),
            max_dists=torch.zeros(0),
        )

    @property
    def count(self) -> int:
        return self.indices_a.shape[0]

    def add(self, a: int, b: int, strength: float = 100.0,
            min_dist: float = 20.0, max_dist: float = 500.0) -> None:
        self.indices_a = torch.cat([self.indices_a, torch.tensor([a], dtype=torch.long)])
        self.indices_b = torch.cat([self.indices_b, torch.tensor([b], dtype=torch.long)])
        self.strengths = torch.cat([self.strengths, torch.tensor([strength])])
        self.min_dists = torch.cat([self.min_dists, torch.tensor([min_dist])])
        self.max_dists = torch.cat([self.max_dists, torch.tensor([max_dist])])


def apply_attractions(ps: ParticleSystem, attractions: AttractionSystem) -> None:
    """Apply inverse-square attraction forces between particle pairs."""
    if attractions.count == 0:
        return

    pos_a = ps.positions[attractions.indices_a]
    pos_b = ps.positions[attractions.indices_b]
    delta = pos_b - pos_a
    dist_sq = (delta * delta).sum(dim=-1)  # (A,)
    dist = dist_sq.sqrt()

    # Mask out pairs outside [min_dist, max_dist] or too close
    valid = (dist > 1e-3) & (dist >= attractions.min_dists) & (dist <= attractions.max_dists)

    # Normalize delta
    direction = delta / dist.unsqueeze(-1).clamp(min=1e-6)
    strength = attractions.strengths / dist_sq.clamp(min=1e-6)  # (A,)
    force = direction * strength.unsqueeze(-1)  # (A, dim)

    # Zero out invalid forces
    force = torch.where(valid.unsqueeze(-1), force, torch.zeros_like(force))

    # Apply: a attracted toward b, b repelled from a
    inv_mass_a = ps.inv_masses[attractions.indices_a].unsqueeze(-1)
    inv_mass_b = ps.inv_masses[attractions.indices_b].unsqueeze(-1)

    ps.accelerations.index_add_(0, attractions.indices_a, force * inv_mass_a)
    ps.accelerations.index_add_(0, attractions.indices_b, -force * inv_mass_b)


def apply_viscous_drag(ps: ParticleSystem, coefficient: float) -> None:
    """Viscous drag: F = -kd * v. Applied as acceleration = -kd * v * inv_mass.
    Reference: https://paulbourke.net/miscellaneous/particle/"""
    if coefficient <= 0:
        return
    drag_force = -coefficient * ps.velocities  # (N, dim)
    ps.accelerations += drag_force * ps.inv_masses.unsqueeze(-1)


def apply_gravity(ps: ParticleSystem, gravity: torch.Tensor) -> None:
    """Apply uniform gravitational acceleration. gravity is (dim,) tensor.
    F = m * g => a = g (for non-pinned, where inv_mass > 0).
    Reference: https://paulbourke.net/miscellaneous/particle/"""
    # a = F/m = (m*g)/m = g, but we need inv_mass to zero out pinned particles
    # So: a += g * (inv_mass > 0)
    active = (ps.inv_masses > 0).unsqueeze(-1).float()
    ps.accelerations += gravity.unsqueeze(0) * active


def apply_wind(ps: ParticleSystem, wind_strength: float) -> None:
    """Random horizontal wind noise as a force."""
    if wind_strength <= 0:
        return
    wind = torch.zeros(ps.count, ps.dim)
    wind[:, 0] = wind_strength * (torch.rand(ps.count) - 0.5)
    ps.accelerations += wind * ps.inv_masses.unsqueeze(-1)
