"""Unit tests for ParticleSystem.

Covers construction, pinning, and force application. Does not cover the
force/constraint solvers in physics/forces.py or physics/constraints.py.
"""
from __future__ import annotations
import torch

from backend.physics.particle import ParticleSystem


def test_create_defaults():
    ps = ParticleSystem.create([[0.0, 0.0], [1.0, 0.0]])
    assert ps.count == 2
    assert ps.dim == 2
    assert torch.allclose(ps.masses, torch.ones(2))
    assert not ps.pinned.any()
    assert torch.allclose(ps.inv_masses, torch.ones(2))


def test_pin_unpin_roundtrip():
    ps = ParticleSystem.create([[0.0, 0.0]], masses=[2.0])
    ps.pin(0)
    assert bool(ps.pinned[0])
    assert ps.inv_masses[0].item() == 0.0
    ps.unpin(0)
    assert not bool(ps.pinned[0])
    assert abs(ps.inv_masses[0].item() - 0.5) < 1e-6


def test_apply_force_scales_by_inv_mass():
    ps = ParticleSystem.create([[0.0, 0.0]], masses=[2.0])
    ps.apply_force(torch.tensor([[2.0, 0.0]]))
    # a = F * inv_mass = 2 * 0.5 = 1
    assert abs(ps.accelerations[0, 0].item() - 1.0) < 1e-6


def test_set_position_zeros_velocity():
    ps = ParticleSystem.create([[0.0, 0.0]])
    ps.velocities[0, 0] = 5.0
    ps.set_position(0, [3.0, 4.0])
    assert torch.allclose(ps.positions[0], torch.tensor([3.0, 4.0]))
    assert ps.velocities[0, 0].item() == 0.0
