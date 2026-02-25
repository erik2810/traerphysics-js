from __future__ import annotations
import json
import asyncio
from typing import TYPE_CHECKING
from fastapi import WebSocket, WebSocketDisconnect

if TYPE_CHECKING:
    from backend.main import SimulationServer


async def websocket_endpoint(websocket: WebSocket, sim: SimulationServer) -> None:
    await websocket.accept()
    sim.clients.add(websocket)

    # Send initial topology frame
    from backend.protocol.binary import pack_topology_frame
    try:
        topology = pack_topology_frame(sim.engine)
        await websocket.send_bytes(topology)
    except Exception:
        sim.clients.discard(websocket)
        return

    try:
        while True:
            # Receive interaction messages from client
            data = await websocket.receive()

            if "text" in data:
                msg = json.loads(data["text"])
                await _handle_interaction(msg, sim)
            elif "bytes" in data:
                # Binary interaction messages (future)
                pass

    except WebSocketDisconnect:
        pass
    finally:
        sim.clients.discard(websocket)


async def _handle_interaction(msg: dict, sim: SimulationServer) -> None:
    """Handle grab/drag/release interaction events from the client."""
    engine = sim.engine
    if engine.particles is None:
        return

    msg_type = msg.get("type")
    idx = msg.get("particleIndex")

    if idx is None or idx < 0 or idx >= engine.particles.count:
        return

    if msg_type == "grab":
        engine.particles.pin(idx)

    elif msg_type == "drag":
        pos = msg.get("position")
        if pos is not None:
            engine.particles.set_position(idx, pos)

    elif msg_type == "release":
        engine.particles.unpin(idx)
