import { createScene } from "./scene";
import { setupCameraForDim } from "./controls";
import { ParticleRenderer } from "./renderer/ParticleRenderer";
import { SpringRenderer } from "./renderer/SpringRenderer";
import { WebSocketClient } from "./network/WebSocketClient";
import { ApiClient } from "./network/ApiClient";
import { LocalSimulation } from "./physics/LocalSimulation";
import { MousePicker } from "./interaction/MousePicker";
import { setupDragHandler } from "./interaction/DragHandler";
import { GuiPanel } from "./ui/GuiPanel";
import { StatsPanel } from "./ui/StatsPanel";
import { WS_URL } from "./constants";
import type { DataSource } from "./SimulationAPI";
import type { Topology } from "./types";

function shouldUseLocal(): boolean {
  const params = new URLSearchParams(location.search);
  if (params.has("standalone")) return true;
  if (!location.host) return true; // file:// protocol
  if (location.hostname.endsWith("github.io")) return true;
  return false;
}

function createRemoteDataSource(): DataSource {
  const api = new ApiClient();
  const ws = new WebSocketClient(WS_URL);
  return {
    onStateFrame: (cb) => { ws.onStateFrame = cb; },
    onTopologyFrame: (cb) => { ws.onTopologyFrame = cb; },
    onConnect: (cb) => { ws.onConnect = cb; },
    onDisconnect: (cb) => { ws.onDisconnect = cb; },
    sendInteraction: (e) => ws.sendInteraction(e),
    api,
    start: () => ws.connect(),
    isLocal: false,
  };
}

async function main(): Promise<void> {
  const container = document.getElementById("app")!;

  const ctx = createScene(container);

  const particleRenderer = new ParticleRenderer(ctx.scene);
  const springRenderer = new SpringRenderer(ctx.scene);

  const useLocal = shouldUseLocal();
  let ds: DataSource;
  if (useLocal) {
    const sim = new LocalSimulation();
    ds = sim.createDataSource();
  } else {
    ds = createRemoteDataSource();
  }

  let currentTopology: Topology | null = null;

  const stats = new StatsPanel("stats", useLocal);

  const picker = new MousePicker(ctx.camera, ctx.renderer, particleRenderer);
  setupDragHandler(picker, ds);

  ds.onTopologyFrame((topology) => {
    currentTopology = topology;
    particleRenderer.updateTopology(topology);
    springRenderer.updateTopology(topology);
    picker.setDim(topology.dim);
    setupCameraForDim(ctx, topology.dim);
    stats.setCounts(topology.numParticles, topology.numSprings);
  });

  ds.onStateFrame((state) => {
    particleRenderer.updatePositions(state.positions, state.dim);
    if (currentTopology) {
      springRenderer.updatePositions(state.positions, state.dim);
    }
  });

  ds.onConnect(() => stats.setConnected(true));
  ds.onDisconnect(() => stats.setConnected(false));

  const gui = new GuiPanel(ds.api);
  gui.onShowSpringsChange = (v) => springRenderer.setVisible(v);
  gui.onModeChanged = () => {};

  ds.start();
  await gui.init();

  function animate(): void {
    requestAnimationFrame(animate);
    ctx.orbitControls.update();
    ctx.renderer.render(ctx.scene, ctx.camera);
    stats.tick();
  }
  animate();
}

main();
