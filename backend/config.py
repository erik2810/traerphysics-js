from __future__ import annotations
import os

# Simulation tick rate (Hz). Overridable per-environment.
TICK_RATE = int(os.environ.get("TRAERPHYSICS_TICK_RATE", "60"))
DEFAULT_MODE = "triangle"
DEFAULT_DT = 1.0 / TICK_RATE

# NOTE: host/port are hardcoded here but run.sh also passes --host/--port to
# uvicorn, so these two values are not actually authoritative when launched
# via the script. Kept for `python -m backend.main` style runs.
WS_HOST = "0.0.0.0"
WS_PORT = 8000

# Observability. LOG_LEVEL is read here but nothing calls logging.basicConfig(),
# so this currently has no effect on what actually gets emitted.
LOG_LEVEL = os.environ.get("TRAERPHYSICS_LOG_LEVEL", "INFO")

# Auth. When API_KEY is non-empty, mutating endpoints are *supposed* to require
# an x-api-key header. Today only POST /api/reset checks it (see api/routes.py).
API_KEY = os.environ.get("TRAERPHYSICS_API_KEY", "")

# Safety cap on particle count. TODO: nothing enforces this yet — modes can
# allocate arbitrarily large grids (e.g. cloth rows*cols) without checking it.
MAX_PARTICLES = int(os.environ.get("TRAERPHYSICS_MAX_PARTICLES", "4096"))
