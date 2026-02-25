from __future__ import annotations
from dataclasses import dataclass
import torch
from .particle import ParticleSystem


@dataclass
class DistanceConstraintSystem:
    """Hard distance constraints solved via position-based dynamics.
    Ported from traer.py DistanceConstraint.solve (lines 42-54)."""

    indices_a: torch.Tensor     # (C,) int64
    indices_b: torch.Tensor     # (C,) int64
    rest_lengths: torch.Tensor  # (C,) float32
    stiffnesses: torch.Tensor   # (C,) float32

    @staticmethod
    def create() -> DistanceConstraintSystem:
        return DistanceConstraintSystem(
            indices_a=torch.zeros(0, dtype=torch.long),
            indices_b=torch.zeros(0, dtype=torch.long),
            rest_lengths=torch.zeros(0),
            stiffnesses=torch.zeros(0),
        )

    @property
    def count(self) -> int:
        return self.indices_a.shape[0]

    def add(self, a: int, b: int, rest_length: float, stiffness: float = 1.0) -> None:
        self.indices_a = torch.cat([self.indices_a, torch.tensor([a], dtype=torch.long)])
        self.indices_b = torch.cat([self.indices_b, torch.tensor([b], dtype=torch.long)])
        self.rest_lengths = torch.cat([self.rest_lengths, torch.tensor([rest_length])])
        self.stiffnesses = torch.cat([self.stiffnesses, torch.tensor([stiffness])])


def solve_distance_constraints(ps: ParticleSystem, constraints: DistanceConstraintSystem) -> None:
    """Position-based distance constraint solving. Same math as springs but typically
    stiffness=1.0 and iterated multiple times for convergence."""
    if constraints.count == 0:
        return

    pos_a = ps.positions[constraints.indices_a]
    pos_b = ps.positions[constraints.indices_b]
    delta = pos_b - pos_a
    dist = delta.norm(dim=-1, keepdim=True).clamp(min=1e-6)
    diff = (dist - constraints.rest_lengths.unsqueeze(-1)) / dist
    correction = constraints.stiffnesses.unsqueeze(-1) * 0.5 * diff * delta

    pinned_a = ps.pinned[constraints.indices_a].unsqueeze(-1)
    pinned_b = ps.pinned[constraints.indices_b].unsqueeze(-1)
    corr_a = torch.where(pinned_a, torch.zeros_like(correction), correction)
    corr_b = torch.where(pinned_b, torch.zeros_like(correction), correction)

    ps.positions.index_add_(0, constraints.indices_a, corr_a)
    ps.positions.index_add_(0, constraints.indices_b, -corr_b)


@dataclass
class AngleConstraintSystem:
    """Three-particle angle constraints. Particle b is the pivot.
    Ported from traerphysics.js AngleConstraint.apply (lines 176-188)."""

    indices_a: torch.Tensor       # (C,) int64
    indices_b: torch.Tensor       # (C,) int64 — pivot
    indices_c: torch.Tensor       # (C,) int64
    target_angles: torch.Tensor   # (C,) float32
    stiffnesses: torch.Tensor     # (C,) float32

    @staticmethod
    def create() -> AngleConstraintSystem:
        return AngleConstraintSystem(
            indices_a=torch.zeros(0, dtype=torch.long),
            indices_b=torch.zeros(0, dtype=torch.long),
            indices_c=torch.zeros(0, dtype=torch.long),
            target_angles=torch.zeros(0),
            stiffnesses=torch.zeros(0),
        )

    @property
    def count(self) -> int:
        return self.indices_a.shape[0]

    def add(self, a: int, b: int, c: int, target_angle: float, stiffness: float = 0.5) -> None:
        self.indices_a = torch.cat([self.indices_a, torch.tensor([a], dtype=torch.long)])
        self.indices_b = torch.cat([self.indices_b, torch.tensor([b], dtype=torch.long)])
        self.indices_c = torch.cat([self.indices_c, torch.tensor([c], dtype=torch.long)])
        self.target_angles = torch.cat([self.target_angles, torch.tensor([target_angle])])
        self.stiffnesses = torch.cat([self.stiffnesses, torch.tensor([stiffness])])


def solve_angle_constraints(ps: ParticleSystem, constraints: AngleConstraintSystem) -> None:
    """Solve angle constraints by rotating endpoints a and c around pivot b."""
    if constraints.count == 0:
        return

    pos_a = ps.positions[constraints.indices_a]
    pos_b = ps.positions[constraints.indices_b]
    pos_c = ps.positions[constraints.indices_c]

    ab = pos_a - pos_b  # (C, dim)
    cb = pos_c - pos_b  # (C, dim)

    # Compute current angle at pivot b (2D: use atan2)
    angle_ab = torch.atan2(ab[:, 1], ab[:, 0])
    angle_cb = torch.atan2(cb[:, 1], cb[:, 0])
    current_angle = angle_cb - angle_ab

    # Wrap difference to [-pi, pi]
    diff = current_angle - constraints.target_angles
    diff = (diff + torch.pi) % (2 * torch.pi) - torch.pi

    correction = diff * constraints.stiffnesses  # (C,)

    # Rotate a and c by correction angle
    cos_c = torch.cos(correction)
    sin_c = torch.sin(correction)

    # Apply rotation-based positional correction
    len_ab = ab.norm(dim=-1).clamp(min=1e-6)
    len_cb = cb.norm(dim=-1).clamp(min=1e-6)

    # New directions after rotation
    new_angle_a = angle_ab - correction * 0.5
    new_angle_c = angle_cb + correction * 0.5

    new_ab = torch.stack([torch.cos(new_angle_a) * len_ab, torch.sin(new_angle_a) * len_ab], dim=-1)
    new_cb = torch.stack([torch.cos(new_angle_c) * len_cb, torch.sin(new_angle_c) * len_cb], dim=-1)

    new_pos_a = pos_b + new_ab
    new_pos_c = pos_b + new_cb

    # Compute deltas and scatter
    delta_a = new_pos_a - pos_a
    delta_c = new_pos_c - pos_c

    pinned_a = ps.pinned[constraints.indices_a].unsqueeze(-1)
    pinned_c = ps.pinned[constraints.indices_c].unsqueeze(-1)

    delta_a = torch.where(pinned_a, torch.zeros_like(delta_a), delta_a)
    delta_c = torch.where(pinned_c, torch.zeros_like(delta_c), delta_c)

    ps.positions.index_add_(0, constraints.indices_a, delta_a)
    ps.positions.index_add_(0, constraints.indices_c, delta_c)
