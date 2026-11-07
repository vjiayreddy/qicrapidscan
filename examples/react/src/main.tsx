import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { BarcodeResult } from "@qicrapidscan/core";
import { BarcodeScanner } from "@qicrapidscan/react";

function App() {
  const [results, setResults] = useState<BarcodeResult[]>([]);

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "24px auto" }}>
      <h1>React example</h1>
      <BarcodeScanner
        formats={["QR_CODE", "EAN_13", "CODE_128"]}
        multiple
        onResult={(next) => setResults((prev) => [...next, ...prev].slice(0, 10))}
      />
      <ul>
        {results.map((r, i) => (
          <li key={`${r.id}-${i}`}>
            {r.format}: {r.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
