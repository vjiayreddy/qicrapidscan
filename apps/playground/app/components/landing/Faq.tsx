const FAQS = [
  {
    q: "What is QicRapidScan?",
    a: "A client-side web barcode scanning SDK. It turns any device with a camera (or an uploaded image) into a barcode reader using TypeScript — with an optional React component and hook.",
  },
  {
    q: "Does scanning work offline?",
    a: "Yes. Decoding runs entirely in the browser. Once the SDK assets are loaded, scans do not require a network call or remote server.",
  },
  {
    q: "Which frameworks are supported?",
    a: "React has first-class bindings (@qicrapidscan/react). Vue, Angular, Svelte, and vanilla JS use @qicrapidscan/core directly. CDN builds are available for quick prototypes.",
  },
  {
    q: "Why do I need HTTPS for the camera?",
    a: "Browsers only expose getUserMedia in a secure context (HTTPS or localhost). Grant camera permission when prompted; image upload works without a camera.",
  },
  {
    q: "Can it read multiple barcodes at once?",
    a: "Yes. Multi-barcode region detection is supported so several codes in one frame can be returned together with overlay-friendly bounds.",
  },
  {
    q: "Which barcode formats are supported?",
    a: "QR Code, EAN-8/13, UPC-A/E, Code 128/39/93, ITF, Data Matrix, PDF417, and Aztec — configurable per scanner instance.",
  },
] as const;

export function Faq() {
  return (
    <section className="pg-landing-section">
      <div className="pg-landing-inner pg-landing-inner--narrow">
        <p className="pg-landing-kicker">FAQ</p>
        <h2 className="pg-landing-heading">Frequently asked questions</h2>
        <div className="pg-faq">
          {FAQS.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
