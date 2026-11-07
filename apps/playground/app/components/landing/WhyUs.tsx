const REASONS = [
  {
    title: "Privacy by default",
    body: "Decoding happens on-device. No cloud ML pipeline and no obligatory telemetry on scan frames.",
  },
  {
    title: "Framework-agnostic core",
    body: "Use @qicrapidscan/core from Vue, Angular, Svelte, or plain JS — React is optional.",
  },
  {
    title: "npm and CDN",
    body: "Ship as a package or load via CDN for demos and embeddable scanners without a build step.",
  },
] as const;

export function WhyUs() {
  return (
    <section className="pg-landing-section pg-landing-section--dark">
      <div className="pg-landing-inner">
        <p className="pg-landing-kicker">Why QicRapidScan</p>
        <h2 className="pg-landing-heading">A web SDK that stays out of your way</h2>
        <p className="pg-landing-lead">
          Focused on browser apps: TypeScript APIs, predictable lifecycle, and
          real examples you can try in this playground.
        </p>
        <div className="pg-why-grid">
          {REASONS.map((r) => (
            <article key={r.title} className="pg-why-card">
              <h3>{r.title}</h3>
              <p>{r.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
