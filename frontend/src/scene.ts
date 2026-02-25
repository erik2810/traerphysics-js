import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { COLORS } from "./constants";

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  orbitControls: OrbitControls;
}

export function createScene(container: HTMLElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.background);

  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    10000,
  );
  // Default 2D view: camera looking down Z axis at XY plane
  camera.position.set(400, 300, 800);
  camera.lookAt(400, 300, 0);

  const orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.1;
  orbitControls.target.set(400, 300, 0);
  orbitControls.enabled = false; // Disabled for 2D modes

  // Lights
  const ambient = new THREE.AmbientLight(COLORS.ambient, 1.0);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(COLORS.directional, 1.5);
  directional.position.set(200, 400, 600);
  scene.add(directional);

  // Handle resize
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  return { scene, camera, renderer, orbitControls };
}

export function configure2D(ctx: SceneContext): void {
  ctx.camera.position.set(400, 300, 800);
  ctx.camera.lookAt(400, 300, 0);
  ctx.orbitControls.target.set(400, 300, 0);
  ctx.orbitControls.enabled = false;
  ctx.orbitControls.update();
}

export function configure3D(ctx: SceneContext): void {
  ctx.camera.position.set(300, 300, 500);
  ctx.camera.lookAt(0, 0, 0);
  ctx.orbitControls.target.set(0, 0, 0);
  ctx.orbitControls.enabled = true;
  ctx.orbitControls.update();
}
