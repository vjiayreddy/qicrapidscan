import type { CameraDevice } from "../types/camera.types.js";
import type { BarcodeScannerOptions } from "../types/scanner.types.js";
import { assertCameraApiAvailable, mapGetUserMediaError } from "./mapCameraError.js";
import { BarcodeError } from "../errors/BarcodeError.js";

export type CameraOptions = NonNullable<BarcodeScannerOptions["camera"]>;

function buildConstraints(
  camera: CameraOptions | undefined,
  deviceId?: string,
): MediaStreamConstraints {
  const video: MediaTrackConstraints = {};

  const id = deviceId ?? camera?.deviceId;
  if (id) {
    video.deviceId = { exact: id };
  } else if (camera?.facingMode) {
    video.facingMode = { ideal: camera.facingMode };
  } else {
    video.facingMode = { ideal: "environment" };
  }

  if (camera?.width) video.width = { ideal: camera.width };
  if (camera?.height) video.height = { ideal: camera.height };
  if (camera?.frameRate) video.frameRate = { ideal: camera.frameRate };

  return { audio: false, video };
}

async function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(
        new BarcodeError("CAMERA_START_FAILED", "Video element failed to load camera stream."),
      );
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("error", onError);
  });
}

/**
 * Owns MediaStream lifecycle. Must not be constructed or started at module load.
 */
export class CameraManager {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private activeDeviceId: string | null = null;
  private cameraOptions: CameraOptions | undefined;

  setOptions(camera: CameraOptions | undefined): void {
    this.cameraOptions = camera;
  }

  getActiveDeviceId(): string | null {
    return this.activeDeviceId;
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async listDevices(): Promise<CameraDevice[]> {
    assertCameraApiAvailable();
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((device) => device.kind === "videoinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 4)}`,
          groupId: device.groupId,
        }));
    } catch (error) {
      throw mapGetUserMediaError(error);
    }
  }

  async start(video: HTMLVideoElement, deviceId?: string): Promise<void> {
    assertCameraApiAvailable();
    await this.stopTracksOnly();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        buildConstraints(this.cameraOptions, deviceId),
      );
    } catch (error) {
      throw mapGetUserMediaError(error);
    }

    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;

    try {
      await video.play();
      await waitForVideoReady(video);
    } catch (error) {
      await this.stop();
      if (error instanceof BarcodeError) throw error;
      throw new BarcodeError(
        "CAMERA_START_FAILED",
        error instanceof Error ? error.message : "Failed to start camera preview.",
      );
    }

    const track = stream.getVideoTracks()[0];
    this.activeDeviceId = track?.getSettings().deviceId ?? deviceId ?? null;
  }

  async switchCamera(deviceId: string): Promise<void> {
    if (!this.video) {
      throw new BarcodeError(
        "CAMERA_START_FAILED",
        "Cannot switch camera before start().",
      );
    }
    await this.start(this.video, deviceId);
  }

  async stop(): Promise<void> {
    await this.stopTracksOnly();
    if (this.video) {
      this.video.srcObject = null;
    }
    this.video = null;
    this.activeDeviceId = null;
  }

  private async stopTracksOnly(): Promise<void> {
    if (!this.stream) return;
    for (const track of this.stream.getTracks()) {
      track.stop();
    }
    this.stream = null;
  }
}
