export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId?: string;
  facingMode?: "user" | "environment" | string;
}
