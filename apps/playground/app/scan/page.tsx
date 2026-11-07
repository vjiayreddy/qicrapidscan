import { ScannerDemo } from "./scanner-demo";

export default function ScanPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Live scan</h1>
      <p style={{ color: "#555" }}>
        Client Component using <code>@qicrapidscan/react</code>. Allow camera
        access when prompted.
      </p>
      <ScannerDemo />
    </main>
  );
}
