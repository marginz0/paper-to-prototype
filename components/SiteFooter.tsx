import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <p>Paper to Prototype · Don’t just read the method. Run it.</p>
        <Link href="/#laboratories">Browse laboratories ↑</Link>
      </div>
    </footer>
  );
}
