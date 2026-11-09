import { describe, expect, it } from "vitest";
import {
  localizerLabelToFormat,
  localizerLabelUsesOpencvCascade,
  localizerLabelUsesSquareCrop,
  resolveClassLabel,
  PHARMA_LOCALIZER_CLASS_NAMES,
} from "./classNames.js";

describe("localizerLabelToFormat", () => {
  it("maps pharma YOLO labels to SDK formats", () => {
    expect(localizerLabelToFormat("Code128")).toBe("CODE_128");
    expect(localizerLabelToFormat("PDF417")).toBe("PDF_417");
    expect(localizerLabelToFormat("QRCode")).toBe("QR_CODE");
    expect(localizerLabelToFormat("UPCA")).toBe("UPC_A");
    expect(localizerLabelToFormat("datamatrix")).toBe("DATA_MATRIX");
  });
});

describe("crop / cascade helpers", () => {
  it("uses square crops for matrix codes only", () => {
    expect(localizerLabelUsesSquareCrop("datamatrix")).toBe(true);
    expect(localizerLabelUsesSquareCrop("QRCode")).toBe(true);
    expect(localizerLabelUsesSquareCrop("Code128")).toBe(false);
    expect(localizerLabelUsesSquareCrop("PDF417")).toBe(false);
  });

  it("enables OpenCV cascade only for DataMatrix", () => {
    expect(localizerLabelUsesOpencvCascade("datamatrix")).toBe(true);
    expect(localizerLabelUsesOpencvCascade("Code128")).toBe(false);
  });
});

describe("resolveClassLabel", () => {
  it("resolves pharma class ids", () => {
    expect(resolveClassLabel(0, PHARMA_LOCALIZER_CLASS_NAMES)).toBe("Code128");
    expect(resolveClassLabel(4, PHARMA_LOCALIZER_CLASS_NAMES)).toBe(
      "datamatrix",
    );
  });
});
