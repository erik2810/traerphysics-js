import type { SimulationState, Topology, InteractionEvent } from "../types";
import {
  isStateFrame,
  isTopologyFrame,
  decodeStateFrame,
  decodeTopologyFrame,
} from "./protocol";

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 10000;
  private shouldReconnect = true;

  onStateFrame: ((state: SimulationState) => void) | null = null;
  onTopologyFrame: ((topology: Topology) => void) | null = null;
  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    this.shouldReconnect = true;
    this._connect();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  sendInteraction(event: InteractionEvent): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private _connect(): void {
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.onConnect?.();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        this._handleBinaryMessage(event.data);
      }
      // Text messages (JSON) could be handled here for mode change acks
    };

    this.ws.onclose = () => {
      this.onDisconnect?.();
      if (this.shouldReconnect) {
        setTimeout(() => this._connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 1.5,
          this.maxReconnectDelay,
        );
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private _handleBinaryMessage(buffer: ArrayBuffer): void {
    if (isTopologyFrame(buffer)) {
      const topology = decodeTopologyFrame(buffer);
      this.onTopologyFrame?.(topology);
    } else if (isStateFrame(buffer)) {
      const state = decodeStateFrame(buffer);
      this.onStateFrame?.(state);
    }
  }
}
