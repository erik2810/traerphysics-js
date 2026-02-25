from __future__ import annotations
from abc import ABC, abstractmethod
from backend.physics.engine import PhysicsEngine


class SimulationMode(ABC):
    """Abstract base class for simulation modes."""

    name: str
    dim: int

    @abstractmethod
    def setup(self, engine: PhysicsEngine, params: dict) -> None:
        """Configure the engine with particles, springs, constraints for this mode."""

    @abstractmethod
    def default_params(self) -> dict:
        """Return default tunable parameters for this mode."""
