from __future__ import annotations
from typing import Optional
import torch

from .particle import ParticleSystem
from .forces import (
    SpringSystem, AttractionSystem,
    apply_spring_forces, apply_attractions, apply_viscous_drag,
    apply_gravity, apply_wind,
)
from .constraints import (
    DistanceConstraintSystem, AngleConstraintSystem,
    solve_distance_constraints, solve_angle_constraints,
)
from .collisions import (
    Bounds, enforce_bounds_clamp, enforce_bounds_elastic,
    floor_collision, resolve_elastic_collisions,
)
from .integrators import euler_integrate, clamp_velocities


class PhysicsEngine:
    """Central physics simulation engine.

    Step order (force-based Euler, per gorillasun / Paul Bourke):
      1. Zero acceleration accumulator (done by integrator at end of prev step)
      2. Accumulate forces: gravity, wind, drag, springs, attractions
      3. Integrate: v += a*dt, x += v*dt (Euler)
      4. Clamp velocities
      5. Solve position-based constraints (iterated)
      6. Resolve elastic collisions
      7. Enforce bounds / floor collision
    """

    def __init__(self, dim: int = 2):
        self.dim = dim
        self.particles: Optional[ParticleSystem] = None
        self.springs = SpringSystem.create()
        self.attractions = AttractionSystem.create()
        self.distance_constraints = DistanceConstraintSystem.create()
        self.angle_constraints = AngleConstraintSystem.create()

        self.gravity = torch.zeros(dim)
        self.drag_coefficient: float = 0.0
        self.wind_strength: float = 0.0
        self.max_speed: float = 0.0  # 0 = unlimited

        self.bounds: Optional[Bounds] = None
        self.bounds_mode: str = "clamp"  # "clamp" or "elastic"
        self.floor_y: Optional[float] = None
        self.floor_restitution: float = 0.3

        self.constraint_iterations: int = 1
        self.enable_collisions: bool = False
        self.collision_radii: Optional[torch.Tensor] = None

        self.sim_time: float = 0.0
        self.dt: float = 1.0 / 60.0

    def reset(self) -> None:
        """Reset ALL engine state so modes don't leak into each other."""
        self.particles = None
        self.springs = SpringSystem.create()
        self.attractions = AttractionSystem.create()
        self.distance_constraints = DistanceConstraintSystem.create()
        self.angle_constraints = AngleConstraintSystem.create()

        self.gravity = torch.zeros(self.dim)
        self.drag_coefficient = 0.0
        self.wind_strength = 0.0
        self.max_speed = 0.0

        self.bounds = None
        self.bounds_mode = "clamp"
        self.floor_y = None
        self.floor_restitution = 0.3

        self.constraint_iterations = 1
        self.enable_collisions = False
        self.collision_radii = None

        self.sim_time = 0.0

    def step(self) -> None:
        if self.particles is None or self.particles.count == 0:
            return

        ps = self.particles
        dt = self.dt

        # 1. Accumulate forces into acceleration buffer
        if self.gravity.any():
            apply_gravity(ps, self.gravity)

        if self.wind_strength > 0:
            apply_wind(ps, self.wind_strength)

        if self.drag_coefficient > 0:
            apply_viscous_drag(ps, self.drag_coefficient)

        apply_spring_forces(ps, self.springs)

        apply_attractions(ps, self.attractions)

        # 2. Integrate: v += a*dt, x += v*dt (clears accelerations)
        euler_integrate(ps, dt)

        # 3. Clamp velocities
        if self.max_speed > 0:
            clamp_velocities(ps, self.max_speed)

        # 4. Solve position-based constraints (iterated)
        for _ in range(self.constraint_iterations):
            solve_distance_constraints(ps, self.distance_constraints)
            solve_angle_constraints(ps, self.angle_constraints)

        # 5. Resolve elastic collisions
        if self.enable_collisions and self.collision_radii is not None:
            resolve_elastic_collisions(ps, self.collision_radii)

        # 6. Enforce bounds
        if self.bounds is not None:
            if self.bounds_mode == "elastic":
                enforce_bounds_elastic(ps, self.bounds, self.collision_radii)
            else:
                enforce_bounds_clamp(ps, self.bounds)

        # 7. Floor collision
        if self.floor_y is not None:
            floor_collision(ps, self.floor_y, self.floor_restitution)

        self.sim_time += dt

    def get_spring_pairs(self) -> torch.Tensor:
        """Return all spring/constraint connectivity as (S, 2) int tensor for rendering."""
        pairs = []
        if self.springs.count > 0:
            pairs.append(torch.stack([self.springs.indices_a, self.springs.indices_b], dim=-1))
        if self.distance_constraints.count > 0:
            pairs.append(torch.stack([
                self.distance_constraints.indices_a,
                self.distance_constraints.indices_b,
            ], dim=-1))
        if not pairs:
            return torch.zeros(0, 2, dtype=torch.long)
        return torch.cat(pairs, dim=0)
