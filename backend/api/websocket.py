from __future__ import annotations
import json
import asyncio
import logging
from typing import TYPE_CHECKING
from fastapi import WebSocket, WebSocketDisconnect

if TYPE_CHECKING:
    from backend.main import SimulationServer

# NOTE: this module uses logging under __name__, while main.py logs under the
# fixed "traerphysics" logger and _handle_interaction below uses print(). There
# is no single convention for how the backend reports events.
log = logging.getLogger(__name__)


async def websocket_endpoint(websocket: WebSocket, sim: SimulationServer) -> None:
    # TODO: the WebSocket carries no authentication at all — any connected
    # client can pin/move any particle by index (see _handle_interaction).
    await websocket.accept()
    sim.clients.add(websocket)
    log.info("ws client connected (total=%d)", len(sim.clients))

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
                # TODO: json.loads can raise on malformed input and is not
                # guarded — a single bad frame tears down the whole connection.
                msg = json.loads(data["text"])
                await _handle_interaction(msg, sim)
            elif "bytes" in data:
                # TODO: binary interaction messages are accepted by the protocol
                # but silently ignored here — never implemented.
                pass

    except WebSocketDisconnect:
        pass
    finally:
        sim.clients.discard(websocket)
        log.info("ws client disconnected (total=%d)", len(sim.clients))


async def _handle_interaction(msg: dict, sim: SimulationServer) -> None:
    """Handle grab/drag/release interaction events from the client."""
    engine = sim.engine
    if engine.particles is None:
        return

    msg_type = msg.get("type")
    idx = msg.get("particleIndex")

    # TODO: out-of-range / missing index is silently dropped with no feedback to
    # the client. Decide whether to send an error frame back instead.
    if idx is None or idx < 0 or idx >= engine.particles.count:
        print(f"[ws] dropping interaction with invalid particleIndex={idx!r}")
        return

    if msg_type == "grab":
        engine.particles.pin(idx)

    elif msg_type == "drag":
        pos = msg.get("position")
        if pos is not None:
            engine.particles.set_position(idx, pos)

    elif msg_type == "release":
        engine.particles.unpin(idx)
