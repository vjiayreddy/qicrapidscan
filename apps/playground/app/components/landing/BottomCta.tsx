import Link from "next/link";

export function BottomCta() {
  return (
    <section className="pg-cta-band">
      <div className="pg-landing-inner pg-landing-inner--narrow">
        <h2 className="pg-landing-heading">Ready to try?</h2>
        <p className="pg-landing-lead pg-landing-lead--center">
          Open the live scanner in your browser, or skim the install snippets
          and start integrating today.
        </p>
        <div className="pg-btn-row">
          <Link href="/scan" className="pg-btn pg-btn--primary pg-btn--lg">
            Try the scanner
          </Link>
          <Link href="/docs" className="pg-btn pg-btn--secondary pg-btn--lg">
            Quick docs
          </Link>
        </div>
      </div>
    </section>
  );
}
