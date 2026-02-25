from __future__ import annotations
from dataclasses import dataclass
import torch


@dataclass
class ParticleSystem:
    """Tensor-based particle state. All data stored as contiguous tensors for vectorized ops."""

    positions: torch.Tensor       # (N, dim) float32
    prev_positions: torch.Tensor  # (N, dim) float32 — for Verlet integration
    velocities: torch.Tensor      # (N, dim) float32 — for Euler integration
    accelerations: torch.Tensor   # (N, dim) float32 — force accumulator
    masses: torch.Tensor          # (N,) float32
    inv_masses: torch.Tensor      # (N,) float32 — 0 for pinned particles
    pinned: torch.Tensor          # (N,) bool
    dim: int                      # 2 or 3

    @staticmethod
    def create(positions: list[list[float]], masses: list[float] | None = None,
               pinned: list[bool] | None = None) -> ParticleSystem:
        pos = torch.tensor(positions, dtype=torch.float32)
        n, dim = pos.shape
        m = torch.tensor(masses, dtype=torch.float32) if masses else torch.ones(n)
        pin = torch.tensor(pinned, dtype=torch.bool) if pinned else torch.zeros(n, dtype=torch.bool)
        inv_m = torch.where(pin, torch.zeros(n), 1.0 / m)
        return ParticleSystem(
            positions=pos,
            prev_positions=pos.clone(),
            velocities=torch.zeros(n, dim),
            accelerations=torch.zeros(n, dim),
            masses=m,
            inv_masses=inv_m,
            pinned=pin,
            dim=dim,
        )

    @property
    def count(self) -> int:
        return self.positions.shape[0]

    def apply_force(self, force: torch.Tensor) -> None:
        """Apply a force tensor (N, dim) to all particles. Pinned particles unaffected via inv_mass=0."""
        self.accelerations += force * self.inv_masses.unsqueeze(-1)

    def apply_force_uniform(self, force: torch.Tensor) -> None:
        """Apply the same force to every particle, scaled by mass (e.g. gravity)."""
        # force is (dim,), broadcast to (N, dim), then multiply by mass
        self.accelerations += force.unsqueeze(0) * self.masses.unsqueeze(-1) * self.inv_masses.unsqueeze(-1)

    def pin(self, index: int) -> None:
        self.pinned[index] = True
        self.inv_masses[index] = 0.0

    def unpin(self, index: int) -> None:
        self.pinned[index] = False
        self.inv_masses[index] = 1.0 / self.masses[index].item()

    def set_position(self, index: int, pos: list[float]) -> None:
        self.positions[index] = torch.tensor(pos, dtype=torch.float32)
        self.prev_positions[index] = self.positions[index].clone()
        self.velocities[index] = 0.0
