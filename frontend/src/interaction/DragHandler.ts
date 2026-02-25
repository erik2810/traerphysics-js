import { MousePicker } from "./MousePicker";
import type { InteractionEvent } from "../types";

interface InteractionSink {
  sendInteraction(event: InteractionEvent): void;
}

export function setupDragHandler(
  picker: MousePicker,
  sink: InteractionSink,
): void {
  picker.onGrab = (index) => {
    sink.sendInteraction({ type: "grab", particleIndex: index });
  };

  picker.onDrag = (index, position) => {
    sink.sendInteraction({ type: "drag", particleIndex: index, position });
  };

  picker.onRelease = (index) => {
    sink.sendInteraction({ type: "release", particleIndex: index });
  };
}
