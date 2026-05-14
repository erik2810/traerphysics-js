from __future__ import annotations
import math
import torch
from .base import SimulationMode
from backend.physics.engine import PhysicsEngine
from backend.physics.particle import ParticleSystem
from backend.physics.collisions import Bounds


class ClothMode(SimulationMode):
    """2D cloth grid with structural, shear, and bending position-based springs.
    Verlet integration with optional iterated constraints."""

    name = "cloth"
    dim = 2

    def default_params(self) -> dict:
        return {
            "rows": 12,
            "cols": 12,
            "spacing": 25.0,
            "start_x": 200.0,
            "start_y": 50.0,
            "structural_stiffness": 0.5,
            "shear_stiffness": 0.3,
            "bending_stiffness": 0.1,
            "mass": 1.0,
            "constraint_iterations": 3,
            "drag": 0.3,
            "gravity_x": 0.0,
            "gravity_y": 0.0,
            "wind_strength": 0.0,
            "floor_y": None,
            "floor_restitution": 0.3,
            "pin_mode": "all_top",
            "canvas_width": 800.0,
            "canvas_height": 600.0,
        }

    def setup(self, engine: PhysicsEngine, params: dict) -> None:
        p = {**self.default_params(), **params}
        engine.reset()
        engine.dim = self.dim
        engine.gravity = torch.tensor([p["gravity_x"], p["gravity_y"]])
        engine.drag_coefficient = p["drag"]
        engine.constraint_iterations = int(p["constraint_iterations"])
        engine.wind_strength = p["wind_strength"]

        if p["floor_y"] is not None:
            engine.floor_y = p["floor_y"]
            engine.floor_restitution = p["floor_restitution"]

        rows = int(p["rows"])
        cols = int(p["cols"])
        spacing = p["spacing"]
        sx, sy = p["start_x"], p["start_y"]
        pin_mode = p["pin_mode"]

        positions = []
        pinned = []
        for y in range(rows):
            for x in range(cols):
                positions.append([sx + x * spacing, sy + y * spacing])
                if pin_mode == "all_top":
                    pinned.append(y == 0)
                else:
                    pinned.append(y == 0 and x % 3 == 0)

        engine.particles = ParticleSystem.create(positions, pinned=pinned)

        diag = spacing * math.sqrt(2)
        struct_k = p["structural_stiffness"]
        shear_k = p["shear_stiffness"]
        bend_k = p["bending_stiffness"]

        def idx(r: int, c: int) -> int:
            return r * cols + c

        for y in range(rows):
            for x in range(cols):
                if x < cols - 1:
                    engine.springs.add(idx(y, x), idx(y, x + 1), spacing, struct_k)
                if y < rows - 1:
                    engine.springs.add(idx(y, x), idx(y + 1, x), spacing, struct_k)
                if x < cols - 1 and y < rows - 1:
                    engine.springs.add(idx(y, x), idx(y + 1, x + 1), diag, shear_k)
                    engine.springs.add(idx(y + 1, x), idx(y, x + 1), diag, shear_k)
                if x < cols - 2:
                    engine.springs.add(idx(y, x), idx(y, x + 2), spacing * 2, bend_k)
                if y < rows - 2:
                    engine.springs.add(idx(y, x), idx(y + 2, x), spacing * 2, bend_k)

        engine.bounds = Bounds(
            min_pos=torch.tensor([0.0, 0.0]),
            max_pos=torch.tensor([p["canvas_width"], p["canvas_height"]]),
        )
        engine.bounds_mode = "clamp"

        # Initial velocity: gentle rightward billow with sinusoidal vertical variation
        dt = engine.dt
        ps = engine.particles
        for y in range(rows):
            for x in range(cols):
                i = idx(y, x)
                if ps.pinned[i]:
                    continue
                row_frac = y / (rows - 1)
                vx = 60.0 * row_frac
                vy = 20.0 * math.sin(x / cols * math.pi * 2) * row_frac
                ps.prev_positions[i, 0] = ps.positions[i, 0] - vx * dt
                ps.prev_positions[i, 1] = ps.positions[i, 1] - vy * dt
