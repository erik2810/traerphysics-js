from __future__ import annotations
from typing import Optional
import torch

from .particle import ParticleSystem
from .forces import (
    SpringSystem, AttractionSystem,
    apply_spring_forces, apply_springs_position_based,
    apply_attractions, apply_viscous_drag, apply_verlet_drag,
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
from .integrators import verlet_integrate, euler_integrate, clamp_velocities


class PhysicsEngine:
    """Central physics simulation engine supporting Verlet and Euler integration."""

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

        # "verlet" matches original traerphysics.js; "euler" for mesh3d collisions
        self.integration_mode: str = "verlet"

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

        self.integration_mode = "verlet"
        self.sim_time = 0.0

    def step(self) -> None:
        if self.particles is None or self.particles.count == 0:
            return

        if self.integration_mode == "verlet":
            self._step_verlet()
        else:
            self._step_euler()

        self.sim_time += self.dt

    def _step_verlet(self) -> None:
        """Verlet step matching traerphysics.js Physics.step()."""
        ps = self.particles
        assert ps is not None
        dt = self.dt

        # 1. Accumulate acceleration-based forces
        if self.gravity.any():
            apply_gravity(ps, self.gravity)
        if self.wind_strength > 0:
            apply_wind(ps, self.wind_strength)
        if self.drag_coefficient > 0:
            apply_verlet_drag(ps, self.drag_coefficient)
        apply_attractions(ps, self.attractions)

        # 2. Position-based springs
        apply_springs_position_based(ps, self.springs)

        # 3. Constraints
        for _ in range(self.constraint_iterations):
            solve_distance_constraints(ps, self.distance_constraints)
            solve_angle_constraints(ps, self.angle_constraints)

        # 4. Verlet integrate
        verlet_integrate(ps, dt)

        # 5. Bounds
        if self.bounds is not None:
            if self.bounds_mode == "elastic":
                enforce_bounds_elastic(ps, self.bounds, self.collision_radii)
            else:
                enforce_bounds_clamp(ps, self.bounds)

        # 6. Floor
        if self.floor_y is not None:
            floor_collision(ps, self.floor_y, self.floor_restitution)

    def _step_euler(self) -> None:
        """Euler step for modes needing explicit velocity (mesh3d collisions)."""
        ps = self.particles
        assert ps is not None
        dt = self.dt

        # 1. Accumulate forces
        if self.gravity.any():
            apply_gravity(ps, self.gravity)
        if self.wind_strength > 0:
            apply_wind(ps, self.wind_strength)
        if self.drag_coefficient > 0:
            apply_viscous_drag(ps, self.drag_coefficient, dt)
        apply_spring_forces(ps, self.springs)
        apply_attractions(ps, self.attractions)

        # 2. Integrate
        euler_integrate(ps, dt)

        # 3. Clamp velocities
        if self.max_speed > 0:
            clamp_velocities(ps, self.max_speed)

        # 4. Solve constraints
        for _ in range(self.constraint_iterations):
            solve_distance_constraints(ps, self.distance_constraints)
            solve_angle_constraints(ps, self.angle_constraints)

        # 5. Elastic collisions
        if self.enable_collisions and self.collision_radii is not None:
            resolve_elastic_collisions(ps, self.collision_radii)

        # 6. Bounds
        if self.bounds is not None:
            if self.bounds_mode == "elastic":
                enforce_bounds_elastic(ps, self.bounds, self.collision_radii)
            else:
                enforce_bounds_clamp(ps, self.bounds)

        # 7. Floor
        if self.floor_y is not None:
            floor_collision(ps, self.floor_y, self.floor_restitution)

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
