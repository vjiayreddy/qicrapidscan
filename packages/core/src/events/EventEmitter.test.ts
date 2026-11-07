import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "./EventEmitter.js";

describe("EventEmitter", () => {
  it("subscribes and unsubscribes", () => {
    const emitter = new EventEmitter<{ result: string }>();
    const handler = vi.fn();
    const off = emitter.on("result", handler);
    emitter.emit("result", "a");
    off();
    emitter.emit("result", "b");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("a");
  });
});
