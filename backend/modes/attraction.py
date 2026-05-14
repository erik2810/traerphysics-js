from __future__ import annotations
import math
import torch
from .base import SimulationMode
from backend.physics.engine import PhysicsEngine
from backend.physics.particle import ParticleSystem
from backend.physics.collisions import Bounds


class AttractionMode(SimulationMode):
    """Pinned center particle with orbiting particles under inverse-square attraction.
    Verlet integration with tangential initial velocities for orbital motion."""

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

        cx = p["canvas_width"] / 2
        cy = p["canvas_height"] / 2
        n = int(p["num_particles"])

        positions = [[cx, cy]]
        masses = [10.0]
        pinned = [True]

        orbit_radius = 150.0
        for i in range(n):
            angle = (i / n) * math.pi * 2
            r = orbit_radius + (torch.rand(1).item() - 0.5) * 80
            positions.append([cx + math.cos(angle) * r, cy + math.sin(angle) * r])
            masses.append(p["mass"])
            pinned.append(False)

        engine.particles = ParticleSystem.create(positions, masses, pinned)

        for i in range(1, n + 1):
            engine.attractions.add(
                0, i,
                strength=p["attraction_strength"],
                min_dist=p["min_dist"],
                max_dist=p["max_dist"],
            )

        engine.bounds = Bounds(
            min_pos=torch.tensor([0.0, 0.0]),
            max_pos=torch.tensor([p["canvas_width"], p["canvas_height"]]),
        )
        engine.bounds_mode = "elastic"

        # Initial tangential velocity for orbital motion
        dt = engine.dt
        ps = engine.particles
        for i in range(1, n + 1):
            dx = ps.positions[i, 0].item() - cx
            dy = ps.positions[i, 1].item() - cy
            dist = math.sqrt(dx * dx + dy * dy) or 1.0
            speed = 100.0 + torch.rand(1).item() * 60.0
            vx = (-dy / dist) * speed
            vy = (dx / dist) * speed
            ps.prev_positions[i, 0] = ps.positions[i, 0] - vx * dt
            ps.prev_positions[i, 1] = ps.positions[i, 1] - vy * dt
