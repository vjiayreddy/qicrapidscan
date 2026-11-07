import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <h1 style={{ marginTop: 0 }}>QicRapidScan</h1>
      <p>Phase 4 playground — client-side barcode scanning demo.</p>
      <ul>
        <li>
          <Link href="/scan">Live camera scanner</Link>
        </li>
        <li>
          <Link href="/docs">Quick docs</Link>
        </li>
      </ul>
      <p style={{ color: "#666", fontSize: 14 }}>
        Camera access requires HTTPS or localhost and a user permission grant.
      </p>
    </main>
  );
}
