from __future__ import annotations
import torch
from .base import SimulationMode
from backend.physics.engine import PhysicsEngine
from backend.physics.particle import ParticleSystem
from backend.physics.collisions import Bounds


class RopeMode(SimulationMode):
    """Chain of particles connected by springs between neighbors only.
    Uses force-based springs for dynamics — no distance constraints,
    so the rope can oscillate around its rest lengths."""

    name = "rope"
    dim = 2

    def default_params(self) -> dict:
        return {
            "num_segments": 15,
            "segment_length": 25.0,
            "start_x": 400.0,
            "start_y": 50.0,
            "spring_k": 120.0,
            "spring_damping": 4.0,
            "mass": 1.0,
            "drag": 2.0,
            "gravity_x": 0.0,
            "gravity_y": 80.0,
            "max_speed": 400.0,
            "canvas_width": 800.0,
            "canvas_height": 600.0,
        }

    def setup(self, engine: PhysicsEngine, params: dict) -> None:
        p = {**self.default_params(), **params}
        engine.reset()
        engine.dim = self.dim
        engine.gravity = torch.tensor([p["gravity_x"], p["gravity_y"]])
        engine.drag_coefficient = p["drag"]
        engine.max_speed = p["max_speed"]

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

        # Only springs between direct neighbors — no distance constraints
        k = p["spring_k"]
        kd = p["spring_damping"]
        for i in range(n - 1):
            engine.springs.add(i, i + 1, seg_len, k, kd)

        # Bounds to keep rope on-screen
        engine.bounds = Bounds(
            min_pos=torch.tensor([0.0, 0.0]),
            max_pos=torch.tensor([p["canvas_width"], p["canvas_height"]]),
        )
        engine.bounds_mode = "clamp"
