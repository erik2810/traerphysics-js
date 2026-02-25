from __future__ import annotations
import torch
from .base import SimulationMode
from backend.physics.engine import PhysicsEngine
from backend.physics.particle import ParticleSystem
from backend.physics.collisions import Bounds


class AttractionMode(SimulationMode):
    """Pinned center particle with orbiting particles under inverse-square attraction.
    Force-based Euler integration."""

    name = "attraction"
    dim = 2

    def default_params(self) -> dict:
        return {
            "num_particles": 20,
            "attraction_strength": 5000.0,
            "min_dist": 20.0,
            "max_dist": 500.0,
            "mass": 1.0,
            "drag": 2.0,
            "gravity_x": 0.0,
            "gravity_y": 50.0,
            "max_speed": 300.0,
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

        cx = p["canvas_width"] / 2
        cy = p["canvas_height"] / 2
        n = int(p["num_particles"])

        positions = [[cx, cy]]
        masses = [10.0]
        pinned = [True]

        for _ in range(n):
            x = torch.rand(1).item() * p["canvas_width"]
            y = torch.rand(1).item() * p["canvas_height"]
            positions.append([x, y])
            masses.append(1.0)
            pinned.append(False)

        engine.particles = ParticleSystem.create(positions, masses, pinned)

        for i in range(1, n + 1):
            engine.attractions.add(
                0, i,
                strength=p["attraction_strength"],
                min_dist=p["min_dist"],
                max_dist=p["max_dist"],
            )

        # Bounds to keep particles on-screen
        engine.bounds = Bounds(
            min_pos=torch.tensor([0.0, 0.0]),
            max_pos=torch.tensor([p["canvas_width"], p["canvas_height"]]),
        )
        engine.bounds_mode = "elastic"
