const FORMATS = [
  "QR_CODE",
  "EAN_13",
  "EAN_8",
  "UPC_A",
  "UPC_E",
  "CODE_128",
  "CODE_39",
  "CODE_93",
  "ITF",
  "DATA_MATRIX",
  "PDF_417",
  "AZTEC",
] as const;

export function FormatChips() {
  return (
    <section className="pg-landing-section pg-landing-section--soft pg-landing-center">
      <div className="pg-landing-inner">
        <p className="pg-landing-kicker">Symbologies</p>
        <h2 className="pg-landing-heading">Scans major 1D &amp; 2D formats</h2>
        <p className="pg-landing-lead pg-landing-lead--center">
          Configure the exact set you need — defaults cover all currently
          supported symbologies via ZXing.
        </p>
        <ul className="pg-format-chips">
          {FORMATS.map((format) => (
            <li key={format} className="pg-format-chip">
              {format.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
