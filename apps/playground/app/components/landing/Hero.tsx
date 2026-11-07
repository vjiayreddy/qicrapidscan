import Link from "next/link";

export function Hero() {
  return (
    <section className="pg-landing-hero">
      <div className="pg-landing-hero__inner">
        <span className="pg-landing-badge">Web barcode SDK</span>
        <h1 className="pg-display pg-display--hero">
          Fast and reliable barcode scanning for the web
        </h1>
        <p className="pg-body">
          Turn browsers into barcode readers — fully client-side TypeScript,
          no servers, no frame uploads. Camera and image scanning with React
          bindings or a framework-agnostic core.
        </p>
        <div className="pg-btn-row">
          <Link href="/scan" className="pg-btn pg-btn--primary pg-btn--lg">
            Try now →
          </Link>
          <Link href="/docs" className="pg-btn pg-btn--slate pg-btn--lg">
            Quick docs
          </Link>
        </div>
      </div>
    </section>
  );
}
