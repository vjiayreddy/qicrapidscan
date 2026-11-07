import { describe, expect, it } from "vitest";
import { objectFitRect } from "./objectFit.js";

describe("objectFitRect", () => {
  it("returns null for invalid sizes", () => {
    expect(objectFitRect(0, 100, 10, 10, "cover")).toBeNull();
  });

  it("covers the container while preserving aspect ratio", () => {
    const fitted = objectFitRect(200, 100, 100, 100, "cover");
    expect(fitted).toEqual({ left: 0, top: -50, width: 200, height: 200 });
  });

  it("contains the media inside the container", () => {
    const fitted = objectFitRect(200, 100, 100, 100, "contain");
    expect(fitted).toEqual({ left: 50, top: 0, width: 100, height: 100 });
  });
});
