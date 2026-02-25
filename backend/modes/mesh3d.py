from __future__ import annotations
import math
import torch
from .base import SimulationMode
from backend.physics.engine import PhysicsEngine
from backend.physics.particle import ParticleSystem
from backend.physics.collisions import Bounds


class Mesh3DMode(SimulationMode):
    """3D particle mesh grid with force-based springs, elastic collisions,
    and boundary reflection. Matches the gorillasun spring model."""

    name = "mesh3d"
    dim = 3

    def default_params(self) -> dict:
        return {
            "grid_size": 5,
            "spacing": 60.0,
            "stiffness": 20.0,
            "spring_damping": 3.0,
            "mass": 1.5,
            "max_speed": 200.0,
            "particle_mass": 1.5,
            "particle_radius_factor": 5.0,
            "bounds_margin": 250.0,
            "drag": 2.0,
            "gravity_x": 0.0,
            "gravity_y": 0.0,
            "gravity_z": 0.0,
        }

    def setup(self, engine: PhysicsEngine, params: dict) -> None:
        p = {**self.default_params(), **params}
        engine.reset()
        engine.dim = self.dim
        engine.gravity = torch.tensor([p["gravity_x"], p["gravity_y"], p["gravity_z"]])
        engine.drag_coefficient = p["drag"]
        engine.max_speed = p["max_speed"]
        engine.enable_collisions = True

        gs = int(p["grid_size"])
        spacing = p["spacing"]
        mass = p["particle_mass"]
        margin = p["bounds_margin"]
        k = p["stiffness"]
        kd = p["spring_damping"]
        diag = spacing * math.sqrt(2)

        # Build 3D particle grid
        positions = []
        for x in range(gs):
            for y in range(gs):
                for z in range(gs):
                    px = (x - gs / 2) * spacing
                    py = (y - gs / 2) * spacing
                    pz = (z - gs / 2) * spacing
                    positions.append([px, py, pz])

        n = len(positions)
        engine.particles = ParticleSystem.create(
            positions=positions,
            masses=[mass] * n,
        )

        # Give particles small random initial velocities
        engine.particles.velocities = (torch.rand(n, 3) - 0.5) * 2.0

        # Collision radii
        engine.collision_radii = torch.full((n,), mass * p["particle_radius_factor"])

        # Bounds
        engine.bounds = Bounds(
            min_pos=torch.tensor([-margin, -margin, -margin]),
            max_pos=torch.tensor([margin, margin, margin]),
        )
        engine.bounds_mode = "elastic"

        # Helper to get flat index from 3D grid coords
        def idx(x: int, y: int, z: int) -> int:
            return x * gs * gs + y * gs + z

        # Build springs matching mesh.html connectivity
        # Interior cells: structural + diagonal springs
        for x in range(gs - 1):
            for y in range(gs - 1):
                for z in range(gs - 1):
                    # Structural (axis-aligned)
                    engine.springs.add(idx(x, y, z), idx(x + 1, y, z), spacing, k, kd)
                    engine.springs.add(idx(x, y, z), idx(x, y + 1, z), spacing, k, kd)
                    engine.springs.add(idx(x, y, z), idx(x, y, z + 1), spacing, k, kd)
                    # Shear/diagonal springs
                    engine.springs.add(idx(x, y, z), idx(x + 1, y + 1, z), diag, k, kd)
                    engine.springs.add(idx(x, y + 1, z), idx(x + 1, y, z), diag, k, kd)
                    engine.springs.add(idx(x, y, z), idx(x + 1, y, z + 1), diag, k, kd)
                    engine.springs.add(idx(x, y, z + 1), idx(x + 1, y, z), diag, k, kd)
                    engine.springs.add(idx(x, y, z), idx(x, y + 1, z + 1), diag, k, kd)
                    engine.springs.add(idx(x, y, z + 1), idx(x, y + 1, z), diag, k, kd)

        # Edge springs for faces not covered by interior loop
        for y in range(gs - 1):
            for z in range(gs - 1):
                engine.springs.add(idx(gs - 1, y, z), idx(gs - 1, y + 1, z), spacing, k, kd)
                engine.springs.add(idx(gs - 1, y, z), idx(gs - 1, y, z + 1), spacing, k, kd)

        for x in range(gs - 1):
            for z in range(gs - 1):
                engine.springs.add(idx(x, gs - 1, z), idx(x + 1, gs - 1, z), spacing, k, kd)
                engine.springs.add(idx(x, gs - 1, z), idx(x, gs - 1, z + 1), spacing, k, kd)

        for x in range(gs - 1):
            for y in range(gs - 1):
                engine.springs.add(idx(x, y, gs - 1), idx(x + 1, y, gs - 1), spacing, k, kd)
                engine.springs.add(idx(x, y, gs - 1), idx(x, y + 1, gs - 1), spacing, k, kd)

        for x in range(gs - 1):
            engine.springs.add(idx(x, gs - 1, gs - 1), idx(x + 1, gs - 1, gs - 1), spacing, k, kd)
        for y in range(gs - 1):
            engine.springs.add(idx(gs - 1, y, gs - 1), idx(gs - 1, y + 1, gs - 1), spacing, k, kd)
        for z in range(gs - 1):
            engine.springs.add(idx(gs - 1, gs - 1, z), idx(gs - 1, gs - 1, z + 1), spacing, k, kd)
