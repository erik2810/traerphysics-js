from __future__ import annotations
import asyncio
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from backend.config import TICK_RATE, DEFAULT_MODE
from backend.physics.engine import PhysicsEngine
from backend.protocol.binary import pack_state_frame, pack_topology_frame
from backend.modes.triangle import TriangleMode
from backend.modes.attraction import AttractionMode
from backend.modes.rope import RopeMode
from backend.modes.cloth import ClothMode
from backend.modes.mesh3d import Mesh3DMode
from backend.api.routes import router as api_router, set_simulation_server
from backend.api.websocket import websocket_endpoint


class SimulationServer:
    def __init__(self) -> None:
        self.engine = PhysicsEngine()
        self.available_modes = {
            "triangle": TriangleMode(),
            "attraction": AttractionMode(),
            "rope": RopeMode(),
            "cloth": ClothMode(),
            "mesh3d": Mesh3DMode(),
        }
        self.current_mode_name: str = DEFAULT_MODE
        self.current_params: dict = {}
        self.paused: bool = False
        self.running: bool = True
        self.clients: set[WebSocket] = set()
        self.tick_rate: int = TICK_RATE

    async def switch_mode(self, mode_name: str, params: dict | None = None) -> None:
        mode = self.available_modes[mode_name]
        p = params or {}
        mode.setup(self.engine, p)
        self.current_mode_name = mode_name
        self.current_params = {**mode.default_params(), **p}

        # Broadcast topology to all connected clients
        topology_frame = pack_topology_frame(self.engine)
        for ws in list(self.clients):
            try:
                await ws.send_bytes(topology_frame)
            except Exception:
                self.clients.discard(ws)

    async def simulation_loop(self) -> None:
        """Main physics loop, runs as asyncio background task at fixed tick rate."""
        target_dt = 1.0 / self.tick_rate
        while self.running:
            start = time.monotonic()

            if not self.paused and self.engine.particles is not None:
                self.engine.step()
                frame = pack_state_frame(self.engine)

                # Broadcast to all connected clients
                for ws in list(self.clients):
                    try:
                        await ws.send_bytes(frame)
                    except Exception:
                        self.clients.discard(ws)

            elapsed = time.monotonic() - start
            sleep_time = max(0, target_dt - elapsed)
            await asyncio.sleep(sleep_time)


sim = SimulationServer()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    set_simulation_server(sim)
    await sim.switch_mode(DEFAULT_MODE)
    task = asyncio.create_task(sim.simulation_loop())
    yield
    # Shutdown
    sim.running = False
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="TraerPhysics Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket_endpoint(websocket, sim)
