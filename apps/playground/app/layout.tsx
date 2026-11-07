import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "QicRapidScan — Web Barcode Scanner SDK",
  description:
    "Client-side barcode scanning for the web. TypeScript core, React bindings, npm + CDN — no servers, no frame uploads.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <header className="pg-nav">
          <Link href="/" className="pg-nav__brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark.svg"
              alt=""
              width={32}
              height={32}
              className="pg-nav__logo"
            />
            <span>QicRapidScan</span>
          </Link>
          <ul className="pg-nav__links">
            <li>
              <Link href="/scan">Scan</Link>
            </li>
            <li>
              <Link href="/docs">Docs</Link>
            </li>
            <li>
              <Link href="/scan" className="pg-btn pg-btn--primary pg-nav__cta">
                Try now
              </Link>
            </li>
          </ul>
        </header>
        {children}
      </body>
    </html>
  );
}
