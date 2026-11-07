import { BarcodeError } from "../errors/BarcodeError.js";

export function mapGetUserMediaError(error: unknown): BarcodeError {
  if (error instanceof BarcodeError) return error;

  const domError = error as DOMException | undefined;
  const name = domError?.name ?? "";
  const message = domError?.message ?? "Camera access failed.";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return new BarcodeError(
        "CAMERA_PERMISSION_DENIED",
        "Camera permission was denied. Grant access in browser settings or use image upload.",
      );
    case "NotFoundError":
    case "DevicesNotFoundError":
      return new BarcodeError("CAMERA_NOT_FOUND", "No camera device is available.");
    case "NotReadableError":
    case "TrackStartError":
      return new BarcodeError(
        "CAMERA_IN_USE",
        "Camera is in use by another application.",
      );
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return new BarcodeError(
        "CAMERA_CONSTRAINT_NOT_SUPPORTED",
        "Requested camera constraints are not supported by this device.",
      );
    default:
      return new BarcodeError("CAMERA_START_FAILED", message);
  }
}

export function assertCameraApiAvailable(): void {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new BarcodeError(
      "UNSUPPORTED_BROWSER",
      "This browser does not support camera access (MediaDevices.getUserMedia).",
    );
  }
}
