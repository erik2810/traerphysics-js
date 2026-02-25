export const WS_URL = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`;
export const API_BASE = "/api";

export const COLORS = {
  background: 0x1a1a1a,
  particle: 0x6496ff,
  particlePinned: 0xffa040,
  particleGrabbed: 0xff6464,
  spring: 0x507090,
  ambient: 0x404060,
  directional: 0xffffff,
} as const;

export const PARTICLE_RADIUS_BASE = 3;
export const SPRING_OPACITY = 0.5;
export const POINTS_THRESHOLD = 200;
