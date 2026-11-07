type FrameCallback = () => void | Promise<void>;

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Schedules video frames with at most one in-flight decode callback.
 * Uses requestVideoFrameCallback when available, timer fallback otherwise.
 */
export class FrameProcessor {
  private video: HTMLVideoElement | null = null;
  private callback: FrameCallback | null = null;
  private running = false;
  private busy = false;
  private frameCallbackId: number | null = null;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private lastAcceptedAt = 0;
  private scanIntervalMs: number;

  constructor(scanIntervalMs = 100) {
    this.scanIntervalMs = Math.max(0, scanIntervalMs);
  }

  setScanInterval(ms: number): void {
    this.scanIntervalMs = Math.max(0, ms);
  }

  start(video: HTMLVideoElement, onFrame: FrameCallback): void {
    this.stop();
    this.video = video;
    this.callback = onFrame;
    this.running = true;
    this.busy = false;
    this.lastAcceptedAt = 0;
    this.scheduleNext();
  }

  stop(): void {
    this.running = false;
    this.busy = false;
    this.cancelScheduled();
    this.video = null;
    this.callback = null;
  }

  pause(): void {
    this.running = false;
    this.cancelScheduled();
  }

  resume(): void {
    if (!this.video || !this.callback) return;
    if (this.running) return;
    this.running = true;
    this.scheduleNext();
  }

  isRunning(): boolean {
    return this.running;
  }

  private scheduleNext(): void {
    if (!this.running || !this.video || !this.callback) return;

    const video = this.video as VideoWithFrameCallback;
    if (typeof video.requestVideoFrameCallback === "function") {
      this.frameCallbackId = video.requestVideoFrameCallback(() => {
        this.frameCallbackId = null;
        void this.deliverFrame();
      });
      return;
    }

    const interval = Math.max(16, this.scanIntervalMs || 33);
    this.timerId = setTimeout(() => {
      this.timerId = null;
      void this.deliverFrame();
    }, interval);
  }

  private async deliverFrame(): Promise<void> {
    if (!this.running || !this.video || !this.callback) return;

    const now = Date.now();
    if (this.scanIntervalMs > 0 && now - this.lastAcceptedAt < this.scanIntervalMs) {
      this.scheduleNext();
      return;
    }

    if (this.busy) {
      this.scheduleNext();
      return;
    }

    this.busy = true;
    this.lastAcceptedAt = now;
    try {
      await this.callback();
    } finally {
      this.busy = false;
      this.scheduleNext();
    }
  }

  private cancelScheduled(): void {
    if (this.frameCallbackId !== null && this.video) {
      const video = this.video as VideoWithFrameCallback;
      video.cancelVideoFrameCallback?.(this.frameCallbackId);
      this.frameCallbackId = null;
    }
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }
}
