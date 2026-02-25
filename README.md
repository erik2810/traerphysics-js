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

## License

MIT
