from __future__ import annotations
import math
import torch
from .base import SimulationMode
from backend.physics.engine import PhysicsEngine
from backend.physics.particle import ParticleSystem
from backend.physics.collisions import Bounds


class TriangleMode(SimulationMode):
    """Three particles forming an equilateral triangle with springs and an angle constraint.
    Force-based springs with damping (Bourke/gorillasun model).
    Bounded to a canvas region so the triangle doesn't drift off-screen."""

    name = "triangle"
    dim = 2

    def default_params(self) -> dict:
        return {
            "side_length": 100.0,
            "spring_k": 150.0,
            "spring_damping": 12.0,
            "angle_stiffness": 0.3,
            "target_angle": math.pi / 3,
            "mass": 1.0,
            "drag": 4.0,
            "gravity_x": 0.0,
            "gravity_y": 10.0,
            "max_speed": 200.0,
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
        side = p["side_length"]

        # Equilateral triangle centered at (cx, cy) with correct pi/3 angles
        h = side * math.sqrt(3) / 2
        p0 = [cx, cy - h * 2 / 3]          # top vertex (angle constraint pivot)
        p1 = [cx + side / 2, cy + h / 3]   # bottom-right
        p2 = [cx - side / 2, cy + h / 3]   # bottom-left

        engine.particles = ParticleSystem.create(positions=[p0, p1, p2])

        k = p["spring_k"]
        kd = p["spring_damping"]
        for a, b in [(0, 1), (0, 2), (1, 2)]:
            engine.springs.add(a, b, side, k, kd)

        engine.angle_constraints.add(1, 0, 2, p["target_angle"], p["angle_stiffness"])

        # Bounds to keep triangle on-screen
        engine.bounds = Bounds(
            min_pos=torch.tensor([0.0, 0.0]),
            max_pos=torch.tensor([p["canvas_width"], p["canvas_height"]]),
        )
        engine.bounds_mode = "elastic"
