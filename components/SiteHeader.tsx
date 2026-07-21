import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <Link className="wordmark" href="/" aria-label="Paper-to-Prototype home">
          <span className="wordmark-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>
            Paper<span className="wordmark-connector">—to—</span>Prototype
          </span>
        </Link>
        <nav className="header-nav" aria-label="Primary navigation">
          <Link href="/#laboratories">Laboratories</Link>
          <span className="edition-label">Build 01</span>
        </nav>
      </div>
    </header>
  );
}

