import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="site-container not-found-page">
      <p className="eyebrow">Error 404 · Field note missing</p>
      <h1>This experiment is not in the lab.</h1>
      <p>
        The laboratory you requested does not exist, or it has not entered the
        verified collection yet.
      </p>
      <Link className="button button-primary" href="/">
        Return to the gallery <span aria-hidden="true">→</span>
      </Link>
    </main>
  );
}

