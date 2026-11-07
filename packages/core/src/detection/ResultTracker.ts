import type { BarcodeFormat, BarcodeResult } from "../types/barcode.types.js";
import {
  boundingBoxFromPoints,
  toCornerPoints,
  type Point,
} from "./geometry.js";

export interface TrackedDecode {
  text: string;
  format: BarcodeFormat;
  cornerPoints: Point[];
  timestamp: number;
  rawBytes?: Uint8Array;
}

interface SpatialTrack {
  id: string;
  last: TrackedDecode;
  hits: number;
  misses: number;
  confirmed: boolean;
}

export interface TrackerOptions {
  dedupeWindowMs: number;
  confirmHits: number;
  missFrames: number;
  smooth: number;
}

export interface TrackerTick {
  overlay: BarcodeResult[];
  accepted: BarcodeResult[];
}

function centroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function boxExtent(points: Point[]): number {
  const first = points[0];
  if (!first) return 0;
  let minX = first.x;
  let maxX = first.x;
  let minY = first.y;
  let maxY = first.y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return Math.hypot(maxX - minX, maxY - minY);
}

/** TL → TR → BR → BL, independent of decoder corner labeling. */
export function canonicalizeCorners(points: Point[]): Point[] {
  if (points.length < 4) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }

  const center = centroid(points);
  const ordered = points
    .map((point) => ({
      point,
      angle: Math.atan2(point.y - center.y, point.x - center.x),
    }))
    .sort((a, b) => a.angle - b.angle)
    .map((entry) => entry.point);

  let start = 0;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < ordered.length; i += 1) {
    const candidate = ordered[i]!;
    const score = candidate.x + candidate.y;
    if (score < best) {
      best = score;
      start = i;
    }
  }

  const rotated: Point[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const point = ordered[(start + i) % ordered.length]!;
    rotated.push({ x: point.x, y: point.y });
  }
  return rotated;
}

function lerpPoints(previous: Point[], next: Point[], amount: number): Point[] {
  const aligned = canonicalizeCorners(next);
  const count = Math.min(previous.length, aligned.length);
  if (count === 0) return aligned;

  const mixed: Point[] = [];
  for (let i = 0; i < count; i += 1) {
    const prev = previous[i]!;
    const curr = aligned[i]!;
    mixed.push({
      x: prev.x * (1 - amount) + curr.x * amount,
      y: prev.y * (1 - amount) + curr.y * amount,
    });
  }
  return mixed;
}

function matchThreshold(track: SpatialTrack): number {
  return Math.max(56, boxExtent(track.last.cornerPoints) * 0.9);
}

function valueKey(format: BarcodeFormat, text: string): string {
  return `${format}\u0000${text}`;
}

function toResult(id: string, decode: TrackedDecode): BarcodeResult {
  return {
    id,
    text: decode.text,
    format: decode.format,
    rawBytes: decode.rawBytes,
    points: decode.cornerPoints,
    boundingBox: boundingBoxFromPoints(decode.cornerPoints),
    timestamp: decode.timestamp,
  };
}

function withCanonicalCorners(item: TrackedDecode): TrackedDecode {
  return {
    ...item,
    cornerPoints: canonicalizeCorners(item.cornerPoints),
  };
}

/** Convert a decoder result into a tracker detection (skips geometry-less hits). */
export function toTrackedDecode(result: BarcodeResult): TrackedDecode | null {
  const cornerPoints = toCornerPoints(result);
  if (cornerPoints.length < 2) return null;
  return {
    text: result.text,
    format: result.format,
    cornerPoints: canonicalizeCorners(cornerPoints),
    timestamp: result.timestamp,
    rawBytes: result.rawBytes,
  };
}

/**
 * Spatial track smoother for live AR overlays.
 * Ported from barcodesdk ResultTracker — overlay vs accepted are separate streams.
 */
export class ResultTracker {
  private tracks: SpatialTrack[] = [];
  private nextId = 1;
  private readonly lastAcceptedAt = new Map<string, number>();

  constructor(private options: TrackerOptions) {}

  reset(): void {
    this.tracks = [];
    this.nextId = 1;
    this.lastAcceptedAt.clear();
  }

  ingest(
    decoded: TrackedDecode[],
    now = decoded[0]?.timestamp ?? Date.now(),
  ): TrackerTick {
    const detections = decoded.map(withCanonicalCorners);
    const matchedIds = new Set<string>();
    const usedDetections = new Set<number>();
    const createdIds = new Set<string>();
    const newlyConfirmed: SpatialTrack[] = [];

    const pairs: Array<{ track: SpatialTrack; detectionIndex: number; dist: number }> =
      [];
    for (const track of this.tracks) {
      const trackCenter = centroid(track.last.cornerPoints);
      for (let detectionIndex = 0; detectionIndex < detections.length; detectionIndex += 1) {
        const detection = detections[detectionIndex];
        if (!detection) continue;
        pairs.push({
          track,
          detectionIndex,
          dist: distance(trackCenter, centroid(detection.cornerPoints)),
        });
      }
    }
    pairs.sort((a, b) => a.dist - b.dist);

    for (const pair of pairs) {
      if (matchedIds.has(pair.track.id) || usedDetections.has(pair.detectionIndex)) {
        continue;
      }
      if (pair.dist > matchThreshold(pair.track)) {
        continue;
      }

      const detection = detections[pair.detectionIndex];
      if (!detection) continue;

      matchedIds.add(pair.track.id);
      usedDetections.add(pair.detectionIndex);
      const wasConfirmed = pair.track.confirmed;
      this.updateTrack(pair.track, detection);
      if (!wasConfirmed && pair.track.confirmed) {
        newlyConfirmed.push(pair.track);
      }
    }

    for (let i = 0; i < detections.length; i += 1) {
      if (usedDetections.has(i)) continue;
      const detection = detections[i];
      if (!detection) continue;
      if (this.overlapsConfirmed(detection)) continue;
      const id = `track-${this.nextId}`;
      this.nextId += 1;
      createdIds.add(id);
      const track: SpatialTrack = {
        id,
        last: detection,
        hits: 1,
        misses: 0,
        confirmed: this.options.confirmHits <= 1,
      };
      this.tracks.push(track);
      if (track.confirmed) {
        newlyConfirmed.push(track);
      }
    }

    this.tracks = this.tracks.filter((track) => {
      if (matchedIds.has(track.id) || createdIds.has(track.id)) {
        return true;
      }
      track.misses += 1;
      if (!track.confirmed) return false;
      return track.misses < this.options.missFrames;
    });

    const overlay = this.tracks
      .filter((track) => track.confirmed)
      .map((track) => toResult(track.id, track.last));

    const accepted: BarcodeResult[] = [];
    for (const track of newlyConfirmed) {
      const key = valueKey(track.last.format, track.last.text);
      const previous = this.lastAcceptedAt.get(key) ?? Number.NEGATIVE_INFINITY;
      if (now - previous < this.options.dedupeWindowMs) {
        continue;
      }
      this.lastAcceptedAt.set(key, now);
      accepted.push(toResult(track.id, track.last));
    }

    return { overlay, accepted };
  }

  private updateTrack(track: SpatialTrack, detection: TrackedDecode): void {
    track.misses = 0;
    track.hits += 1;

    if (!track.confirmed) {
      track.last = detection;
      if (track.hits >= this.options.confirmHits) {
        track.confirmed = true;
      }
      return;
    }

    track.last = {
      ...track.last,
      cornerPoints: lerpPoints(
        track.last.cornerPoints,
        detection.cornerPoints,
        this.options.smooth,
      ),
      timestamp: detection.timestamp,
      text: detection.text,
      format: detection.format,
      rawBytes: detection.rawBytes,
    };
  }

  private overlapsConfirmed(detection: TrackedDecode): boolean {
    const center = centroid(detection.cornerPoints);
    return this.tracks.some(
      (track) =>
        track.confirmed &&
        distance(center, centroid(track.last.cornerPoints)) <= matchThreshold(track),
    );
  }
}
