# TraerPhysics.js

Real-time particle physics simulation inspired by [Traer Physics](http://murderandcreate.com/physics/) for Processing. Renders with Three.js and WebGL.

**[Live Demo](https://erik2810.github.io/traerphysics-js/)** — runs entirely in your browser.

## Simulations

Five modes demonstrating different particle physics:

- **Triangle** — Three spring-connected particles with an angle constraint
- **Attraction** — Particles orbiting a pinned center under inverse-square forces
- **Rope** — A dangling chain of springs with gravity
- **Cloth** — 12x12 grid with structural, shear, and bending springs
- **3D Mesh** — 5x5x5 particle grid with elastic collisions

Click and drag particles to interact. Adjust physics parameters with the control panel.

## Architecture

Two execution modes:

**Standalone (browser only):** Physics runs in TypeScript using flat `Float32Array` buffers. This is what the live demo uses.

**Client-server:** A Python backend computes physics with PyTorch tensors and streams state over WebSocket at 60 Hz. The browser is a pure renderer.

```
Three.js (renderer)  <── WebSocket binary frames ──>  FastAPI + PyTorch (physics)
       ↕ REST                                                ↕
  lil-gui controls  ──── /api/mode, /api/params ───>  SimulationServer
```

## Running locally

### Browser only

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — standalone mode activates automatically when there's no backend.

### With Python backend

```sh
./setup.sh
./run.sh
```

This starts the FastAPI server on port 8000 and Vite dev server on port 5173. Windows users can use `setup.bat` and `run.bat`.

## HTTP API

The backend exposes a small REST API under `/api` (see `backend/api/routes.py`).

| Method | Path           | Body                          | Returns          |
|--------|----------------|-------------------------------|------------------|
| GET    | `/api/modes`   | —                             | list of modes    |
| GET    | `/api/mode`    | —                             | simulation state |
| POST   | `/api/mode`    | `{ mode, params }`            | simulation state |
| PATCH  | `/api/params`  | partial params (see below)    | `{ status }`     |
| POST   | `/api/reset`   | —                             | simulation state |
| POST   | `/api/pause`   | —                             | `{ paused }`     |
| POST   | `/api/resume`  | —                             | `{ paused }`     |

**Simulation state** response fields:

- `mode` — active mode name
- `num_particles` — particle count
- `num_springs` — total connection count (springs + distance constraints + angle constraints)
- `dim` — 2 or 3
- `paused` — whether the loop is paused
- `sim_time` — simulation clock in seconds
- `params` — current tunable parameters

**Parameter validation:** `gravity` must have the same length as the active
simulation's dimension (2 for 2D modes, 3 for `mesh3d`); a mismatched length is
rejected with `422`. `mass` is clamped to a small positive minimum.

**Auth:** when `TRAERPHYSICS_API_KEY` is set, mutating endpoints require a
matching `x-api-key` header.

## Configuration

Environment variables (read in `backend/config.py`):

| Variable                      | Default | Purpose                          |
|-------------------------------|---------|----------------------------------|
| `TRAERPHYSICS_TICK_RATE`      | `60`    | Physics loop rate (Hz)           |
| `TRAERPHYSICS_LOG_LEVEL`      | `INFO`  | Log verbosity                    |
| `TRAERPHYSICS_API_KEY`        | `""`    | API key for mutating endpoints   |
| `TRAERPHYSICS_MAX_PARTICLES`  | `4096`  | Upper bound on particle count    |

See `.env.example`. The frontend talks to the backend through the Vite proxy in
development (`/api`, `/ws` → `:8000`).

## Testing

Backend unit tests use pytest. From the repo root:

```sh
pip install -e "backend[dev]"
pytest
```

## Physics

Force-based Euler integration following the [Paul Bourke particle model](https://paulbourke.net/miscellaneous/particle/) and the [gorillasun spring tutorial](https://www.gorillasun.de/blog/spring-physics-and-connecting-particles-with-springs/).

- Hooke's law springs with velocity damping along the spring axis
- Inverse-square attraction with distance clamping
- Position-based distance and angle constraints (iterated Gauss-Seidel)
- Brute-force elastic collisions with impulse response
- Axis-aligned bounding box enforcement (clamp or reflection)

## Tech

- **Rendering:** Three.js — InstancedMesh for particles, LineSegments for springs
- **UI:** lil-gui
- **Build:** Vite + TypeScript
- **Backend:** Python, PyTorch, FastAPI, binary WebSocket protocol

## Status & roadmap

The browser-only standalone mode is the primary, fully-working path (it's what
the live demo runs). The Python backend is functional but rougher around the
edges — a few known gaps:

- Binary state frames stream positions only; velocities are not sent, so the
  client can't predict motion in `mesh3d`.
- Auth is partially wired (see the API section).
- No request/loop metrics yet.
- The legacy reference implementation lives in `traerphysics-js-main/` (the
  original Processing-style JS port) and is kept for comparison only.

Grep for `TODO` to find the rest.

## License

MIT
