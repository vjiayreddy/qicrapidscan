const FEATURES = [
  {
    icon: "◎",
    title: "On-device intelligence",
    body: "100% client-side decode — no servers, no tracking. Frames never leave the browser.",
  },
  {
    icon: "⧉",
    title: "Multi-barcode ready",
    body: "Detect and read multiple barcodes in a single frame with region overlays.",
  },
  {
    icon: "▭",
    title: "ROI guide & overlays",
    body: "Optional scan guide and result overlays so users know exactly what they scanned.",
  },
  {
    icon: "◉",
    title: "Camera + image upload",
    body: "Live camera scanning or decode from still images — same API surface either way.",
  },
  {
    icon: "TS",
    title: "TypeScript core",
    body: "Framework-independent @qicrapidscan/core with first-class React component and hook.",
  },
  {
    icon: "</>",
    title: "npm + CDN",
    body: "Ship via package managers or drop in an ESM/CDN build for quick prototypes.",
  },
] as const;

export function FeatureGrid() {
  return (
    <section className="pg-landing-section">
      <div className="pg-landing-inner">
        <p className="pg-landing-kicker">Capabilities</p>
        <h2 className="pg-landing-heading">Built for real browser workflows</h2>
        <p className="pg-landing-lead">
          Everything runs in the user&apos;s device. Integrate once, scan
          offline, keep barcode data private by default.
        </p>
        <div className="pg-feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="pg-feature-card">
              <span className="pg-feature-card__icon" aria-hidden>
                {f.icon}
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
