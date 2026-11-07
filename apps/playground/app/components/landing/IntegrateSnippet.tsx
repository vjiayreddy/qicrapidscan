import Link from "next/link";

export function IntegrateSnippet() {
  return (
    <section className="pg-landing-section">
      <div className="pg-landing-inner">
        <div className="pg-integrate">
          <div>
            <p className="pg-landing-kicker">Get started</p>
            <h2 className="pg-landing-heading">Integrate this morning</h2>
            <p className="pg-landing-lead">
              Install the React package or the framework-agnostic core. Drop in
              a component — or drive the scanner from a hook.
            </p>
            <Link href="/docs" className="pg-btn pg-btn--primary">
              Open quick docs
            </Link>
          </div>
          <pre className="pg-pre">{`pnpm add @qicrapidscan/react

import { BarcodeScanner } from "@qicrapidscan/react";

<BarcodeScanner
  formats={["QR_CODE", "EAN_13"]}
  onResult={(results) => console.log(results)}
/>`}</pre>
        </div>
      </div>
    </section>
  );
}
