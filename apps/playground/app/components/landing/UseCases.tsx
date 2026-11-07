const CASES = [
  {
    title: "Single scanning",
    body: "Decode one barcode at a time — product lookup, ticket check-in, or simple stock scans.",
  },
  {
    title: "Continuous scanning",
    body: "Keep the camera session open and receive results as codes enter the frame without restarting.",
  },
  {
    title: "Multi scanning",
    body: "Capture multiple barcodes in one frame with region detection — useful for packing slips and trays.",
  },
  {
    title: "Image upload",
    body: "Scan from a still image when camera access isn’t available or you need offline photo decode.",
  },
] as const;

export function UseCases() {
  return (
    <section className="pg-landing-section pg-landing-section--soft">
      <div className="pg-landing-inner">
        <p className="pg-landing-kicker">Use cases</p>
        <h2 className="pg-landing-heading">Scan modes that match your flow</h2>
        <p className="pg-landing-lead">
          Choose the mode that fits your workflow — all powered by the same
          client-side scanner API.
        </p>
        <div className="pg-use-grid">
          {CASES.map((c) => (
            <article key={c.title} className="pg-use-card">
              <h3>{c.title}</h3>
              <p>{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
