from __future__ import annotations
import math
import torch
from .base import SimulationMode
from backend.physics.engine import PhysicsEngine
from backend.physics.particle import ParticleSystem
from backend.physics.collisions import Bounds


class TriangleMode(SimulationMode):
    """Three particles forming an equilateral triangle with position-based springs
    and an angle constraint. Verlet integration."""

    name = "triangle"
    dim = 2

    def default_params(self) -> dict:
        return {
            "side_length": 100.0,
            "spring_k": 0.3,
            "angle_stiffness": 0.3,
            "target_angle": math.pi / 3,
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

        cx = p["canvas_width"] / 2
        cy = p["canvas_height"] / 2
        side = p["side_length"]

        h = side * math.sqrt(3) / 2
        p0 = [cx, cy - h * 2 / 3]
        p1 = [cx + side / 2, cy + h / 3]
        p2 = [cx - side / 2, cy + h / 3]

        engine.particles = ParticleSystem.create(positions=[p0, p1, p2])

        k = p["spring_k"]
        for a, b in [(0, 1), (0, 2), (1, 2)]:
            engine.springs.add(a, b, side, k)

        engine.angle_constraints.add(1, 0, 2, p["target_angle"], p["angle_stiffness"])

        engine.bounds = Bounds(
            min_pos=torch.tensor([0.0, 0.0]),
            max_pos=torch.tensor([p["canvas_width"], p["canvas_height"]]),
        )
        engine.bounds_mode = "elastic"

        # Initial rotational velocity (counter-clockwise spin + drift)
        dt = engine.dt
        ps = engine.particles
        centx = (p0[0] + p1[0] + p2[0]) / 3
        centy = (p0[1] + p1[1] + p2[1]) / 3
        spin = 80.0
        drift = 40.0
        verts = [p0, p1, p2]
        for i in range(3):
            dx = verts[i][0] - centx
            dy = verts[i][1] - centy
            vx = -dy / side * spin + drift
            vy = dx / side * spin
            ps.prev_positions[i, 0] = ps.positions[i, 0] - vx * dt
            ps.prev_positions[i, 1] = ps.positions[i, 1] - vy * dt
