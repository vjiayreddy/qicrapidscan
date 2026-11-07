import Link from "next/link";

export function Footer() {
  return (
    <footer className="pg-footer">
      <div className="pg-footer__inner">
        <Link href="/" className="pg-footer__brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-mark.svg"
            alt=""
            width={28}
            height={28}
            className="pg-nav__logo"
          />
          QicRapidScan
        </Link>
        <ul className="pg-footer__links">
          <li>
            <Link href="/scan">Scan</Link>
          </li>
          <li>
            <Link href="/docs">Docs</Link>
          </li>
        </ul>
        <p className="pg-footer__copy">
          © {new Date().getFullYear()} QicRapidScan. Client-side barcode
          scanning for the web.
        </p>
      </div>
    </footer>
  );
}
