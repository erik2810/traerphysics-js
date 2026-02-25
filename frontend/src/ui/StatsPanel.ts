export class StatsPanel {
  private el: HTMLElement;
  private frames = 0;
  private lastTime = performance.now();
  private fps = 0;
  private particleCount = 0;
  private springCount = 0;
  private connected = false;
  private local: boolean;

  constructor(elementId: string, local: boolean = false) {
    this.el = document.getElementById(elementId) ?? document.body;
    this.local = local;
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
  }

  setCounts(particles: number, springs: number): void {
    this.particleCount = particles;
    this.springCount = springs;
  }

  tick(): void {
    this.frames++;
    const now = performance.now();
    if (now - this.lastTime >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastTime = now;
      this._render();
    }
  }

  private _render(): void {
    const status = this.local ? "local" : this.connected ? "connected" : "disconnected";
    this.el.textContent = [
      `FPS: ${this.fps}`,
      `Particles: ${this.particleCount}`,
      `Springs: ${this.springCount}`,
      status,
    ].join("  |  ");
  }
}
