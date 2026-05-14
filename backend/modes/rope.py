from __future__ import annotations
import torch
from .base import SimulationMode
from backend.physics.engine import PhysicsEngine
from backend.physics.particle import ParticleSystem
from backend.physics.collisions import Bounds


class RopeMode(SimulationMode):
    """Chain of particles connected by position-based springs.
    First particle pinned, Verlet integration."""

    name = "rope"
    dim = 2

    def default_params(self) -> dict:
        return {
            "num_segments": 15,
            "segment_length": 25.0,
            "start_x": 400.0,
            "start_y": 50.0,
            "spring_k": 0.5,
            "mass": 1.0,
            "drag": 0.5,
            "gravity_x": 0.0,
            "gravity_y": 0.0,
            "canvas_width": 800.0,
            "canvas_height": 600.0,
        }

    def setup(self, engine: PhysicsEngine, params: dict) -> None:
        p = {**self.default_params(), **params}
        engine.reset()
        engine.dim = self.dim
        engine.gravity = torch.tensor([p["gravity_x"], p["gravity_y"]])
        engine.drag_coefficient = p["drag"]

        n = int(p["num_segments"])
        seg_len = p["segment_length"]
        sx, sy = p["start_x"], p["start_y"]
        mass = p["mass"]

        positions = []
        masses = []
        pinned = []
        for i in range(n):
            positions.append([sx, sy + i * seg_len])
            masses.append(mass)
            pinned.append(i == 0)

        engine.particles = ParticleSystem.create(positions, masses=masses, pinned=pinned)

        k = p["spring_k"]
        for i in range(n - 1):
            engine.springs.add(i, i + 1, seg_len, k)

        engine.bounds = Bounds(
            min_pos=torch.tensor([0.0, 0.0]),
            max_pos=torch.tensor([p["canvas_width"], p["canvas_height"]]),
        )
        engine.bounds_mode = "clamp"

        # Initial whip velocity: increasing horizontal push down the chain
        dt = engine.dt
        ps = engine.particles
        for i in range(1, n):
            t = i / (n - 1)
            vx = 120.0 * t
            vy = -30.0 * t
            ps.prev_positions[i, 0] = ps.positions[i, 0] - vx * dt
            ps.prev_positions[i, 1] = ps.positions[i, 1] - vy * dt
