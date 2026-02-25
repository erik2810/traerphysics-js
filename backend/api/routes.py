from __future__ import annotations
from typing import TYPE_CHECKING
from fastapi import APIRouter, HTTPException
from .schemas import ModeInfo, SwitchModeRequest, UpdateParamsRequest, SimulationState

if TYPE_CHECKING:
    from backend.main import SimulationServer

router = APIRouter()

# Will be set by main.py on startup
_sim: SimulationServer | None = None


def set_simulation_server(sim: SimulationServer) -> None:
    global _sim
    _sim = sim


def _get_sim() -> SimulationServer:
    if _sim is None:
        raise HTTPException(status_code=503, detail="Simulation not initialized")
    return _sim


@router.get("/modes")
async def list_modes() -> list[ModeInfo]:
    sim = _get_sim()
    return [
        ModeInfo(
            name=mode.name,
            dim=mode.dim,
            default_params=mode.default_params(),
        )
        for mode in sim.available_modes.values()
    ]


@router.get("/mode")
async def get_current_mode() -> SimulationState:
    sim = _get_sim()
    engine = sim.engine
    n_springs = engine.springs.count + engine.distance_constraints.count
    return SimulationState(
        mode=sim.current_mode_name,
        num_particles=engine.particles.count if engine.particles else 0,
        num_springs=n_springs,
        dim=engine.dim,
        paused=sim.paused,
        params=sim.current_params,
    )


@router.post("/mode")
async def switch_mode(req: SwitchModeRequest) -> SimulationState:
    sim = _get_sim()
    if req.mode not in sim.available_modes:
        raise HTTPException(status_code=400, detail=f"Unknown mode: {req.mode}")
    await sim.switch_mode(req.mode, req.params)
    return await get_current_mode()


@router.patch("/params")
async def update_params(req: UpdateParamsRequest) -> dict:
    sim = _get_sim()
    engine = sim.engine
    import torch

    if req.gravity is not None:
        engine.gravity = torch.tensor(req.gravity, dtype=torch.float32)
    if req.drag is not None:
        engine.drag_coefficient = req.drag
    if req.wind_strength is not None:
        engine.wind_strength = req.wind_strength
    if req.max_speed is not None:
        engine.max_speed = req.max_speed
    if req.constraint_iterations is not None:
        engine.constraint_iterations = req.constraint_iterations
    if req.spring_k is not None and engine.springs.count > 0:
        engine.springs.stiffnesses.fill_(req.spring_k)
    if req.spring_damping is not None and engine.springs.count > 0:
        engine.springs.dampings.fill_(req.spring_damping)
    if req.mass is not None and engine.particles is not None:
        ps = engine.particles
        new_mass = max(req.mass, 0.01)
        unpinned = ~ps.pinned
        ps.masses[unpinned] = new_mass
        ps.inv_masses[unpinned] = 1.0 / new_mass
    if req.attraction_strength is not None and engine.attractions.count > 0:
        engine.attractions.strengths.fill_(req.attraction_strength)

    # Track changes in current_params for GUI sync
    updates: dict = {}
    if req.gravity is not None:
        g = req.gravity
        updates["gravity_x"] = g[0]
        updates["gravity_y"] = g[1]
        if len(g) > 2:
            updates["gravity_z"] = g[2]
    if req.drag is not None:
        updates["drag"] = req.drag
    if req.wind_strength is not None:
        updates["wind_strength"] = req.wind_strength
    if req.max_speed is not None:
        updates["max_speed"] = req.max_speed
    if req.constraint_iterations is not None:
        updates["constraint_iterations"] = req.constraint_iterations
    if req.spring_k is not None:
        updates["spring_k"] = req.spring_k
    if req.spring_damping is not None:
        updates["spring_damping"] = req.spring_damping
    if req.mass is not None:
        updates["mass"] = req.mass
    if req.attraction_strength is not None:
        updates["attraction_strength"] = req.attraction_strength
    sim.current_params.update(updates)

    return {"status": "ok"}


@router.post("/reset")
async def reset_mode() -> SimulationState:
    sim = _get_sim()
    await sim.switch_mode(sim.current_mode_name, sim.current_params)
    return await get_current_mode()


@router.post("/pause")
async def pause() -> dict:
    sim = _get_sim()
    sim.paused = True
    return {"paused": True}


@router.post("/resume")
async def resume() -> dict:
    sim = _get_sim()
    sim.paused = False
    return {"paused": False}
