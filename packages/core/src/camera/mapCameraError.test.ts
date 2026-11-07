import { describe, expect, it } from "vitest";
import { mapGetUserMediaError } from "./mapCameraError.js";

describe("mapGetUserMediaError", () => {
  it("maps NotAllowedError", () => {
    const error = mapGetUserMediaError(
      Object.assign(new Error("denied"), { name: "NotAllowedError" }),
    );
    expect(error.code).toBe("CAMERA_PERMISSION_DENIED");
  });

  it("maps OverconstrainedError", () => {
    const error = mapGetUserMediaError(
      Object.assign(new Error("bad"), { name: "OverconstrainedError" }),
    );
    expect(error.code).toBe("CAMERA_CONSTRAINT_NOT_SUPPORTED");
  });
});
