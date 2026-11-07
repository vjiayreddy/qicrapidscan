export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
}

export interface MultiDetectLimits {
  maxResults: number;
  maxRegions: number;
  maxDepth: number;
  overlap: number;
  /** Hard wall-clock budget for one multi-detect pass (ms). */
  maxTimeMs: number;
}

export interface MultiDetectStats {
  regionsScanned: number;
  resultsBeforeDedupe: number;
  resultsAfterDedupe: number;
  elapsedMs: number;
  stoppedReason: "complete" | "maxResults" | "maxRegions" | "maxTime";
}
