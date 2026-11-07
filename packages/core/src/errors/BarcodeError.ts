export type BarcodeErrorCode =
  | "CAMERA_PERMISSION_DENIED"
  | "CAMERA_NOT_FOUND"
  | "CAMERA_IN_USE"
  | "CAMERA_CONSTRAINT_NOT_SUPPORTED"
  | "CAMERA_START_FAILED"
  | "DECODER_NOT_INITIALIZED"
  | "IMAGE_LOAD_FAILED"
  | "UNSUPPORTED_FORMAT"
  | "SCAN_FAILED"
  | "SCANNER_DESTROYED"
  | "UNSUPPORTED_BROWSER"
  | "NOT_IMPLEMENTED";

export class BarcodeError extends Error {
  readonly code: BarcodeErrorCode;

  constructor(code: BarcodeErrorCode, message: string) {
    super(message);
    this.name = "BarcodeError";
    this.code = code;
  }
}
