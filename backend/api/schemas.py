from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class ModeInfo(BaseModel):
    name: str
    dim: int
    default_params: dict


class SwitchModeRequest(BaseModel):
    mode: str
    params: dict = {}


class UpdateParamsRequest(BaseModel):
    gravity: Optional[list[float]] = None
    drag: Optional[float] = None
    wind_strength: Optional[float] = None
    max_speed: Optional[float] = None
    constraint_iterations: Optional[int] = None
    spring_k: Optional[float] = None
    spring_damping: Optional[float] = None
    mass: Optional[float] = None
    attraction_strength: Optional[float] = None


class SimulationState(BaseModel):
    mode: str
    num_particles: int
    num_springs: int
    dim: int
    paused: bool
    params: dict
