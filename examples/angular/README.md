# Angular example (core API)

Phase 4 ships a framework-neutral core. Use `@qicrapidscan/core` inside an Angular component or service lifecycle — no dedicated Angular package in v1.

```ts
import { Component, ElementRef, OnDestroy, ViewChild } from "@angular/core";
import { BarcodeScanner, BarcodeResult } from "@qicrapidscan/core";

@Component({
  selector: "app-scanner",
  template: `
    <video #preview muted playsinline></video>
    <button type="button" (click)="start()">Start</button>
    <button type="button" (click)="stop()">Stop</button>
    <ul>
      <li *ngFor="let r of results">{{ r.format }}: {{ r.text }}</li>
    </ul>
  `,
})
export class ScannerComponent implements OnDestroy {
  @ViewChild("preview", { static: true }) preview!: ElementRef<HTMLVideoElement>;
  results: BarcodeResult[] = [];
  private scanner = new BarcodeScanner({
    formats: ["QR_CODE", "EAN_13", "CODE_128"],
    detection: { multiple: true },
  });

  constructor() {
    this.scanner.on("result", (next) => {
      this.results = [...next, ...this.results].slice(0, 10);
    });
  }

  async start() {
    await this.scanner.start(this.preview.nativeElement);
  }

  async stop() {
    await this.scanner.stop();
  }

  ngOnDestroy() {
    void this.scanner.destroy();
  }
}
```

Install in an Angular app:

```bash
pnpm add @qicrapidscan/core
```
