import { ScannerDemo } from "./scanner-demo";

export default function ScanPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Scan demo</h1>
      <p style={{ color: "#555" }}>
        Live camera and image upload with 1D + 2D formats, ROI guidelines, and
        detection overlays via <code>@qicrapidscan/react</code>. Allow camera
        access when prompted.
      </p>
      <ScannerDemo />
    </main>
  );
}
