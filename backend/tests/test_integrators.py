"""Unit tests for the integrators.

NOTE: only verlet/euler position updates and velocity clamping are checked here.
The verlet vs euler force pipelines in engine.py (_step_verlet / _step_euler)
are not exercised end-to-end by any test.
"""
from __future__ import annotations
import torch

from backend.physics.particle import ParticleSystem
from backend.physics.integrators import (
    verlet_integrate, euler_integrate, clamp_velocities,
)


def test_verlet_constant_accel():
    ps = ParticleSystem.create([[0.0, 0.0]])
    ps.accelerations[0] = torch.tensor([1.0, 0.0])
    verlet_integrate(ps, dt=1.0)
    # vel = pos - prev = 0; next = pos + vel + a*dt^2 = 1
    assert abs(ps.positions[0, 0].item() - 1.0) < 1e-6
    assert ps.accelerations.abs().sum().item() == 0.0  # accelerations cleared


def test_verlet_pinned_stays_put():
    ps = ParticleSystem.create([[5.0, 0.0]], pinned=[True])
    ps.accelerations[0] = torch.tensor([1.0, 0.0])
    verlet_integrate(ps, dt=1.0)
    assert ps.positions[0, 0].item() == 5.0


def test_euler_integrates_velocity_then_position():
    ps = ParticleSystem.create([[0.0, 0.0]])
    ps.accelerations[0] = torch.tensor([2.0, 0.0])
    euler_integrate(ps, dt=0.5)
    # v += a*dt = 1.0 ; x += v*dt = 0.5
    assert abs(ps.velocities[0, 0].item() - 1.0) < 1e-6
    assert abs(ps.positions[0, 0].item() - 0.5) < 1e-6


def test_clamp_velocities_caps_speed():
    ps = ParticleSystem.create([[0.0, 0.0]])
    ps.velocities[0] = torch.tensor([3.0, 4.0])  # speed = 5
    clamp_velocities(ps, max_speed=2.5)
    assert abs(ps.velocities[0].norm().item() - 2.5) < 1e-5
