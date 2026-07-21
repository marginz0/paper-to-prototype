export default function Loading() {
  return (
    <main id="main-content" className="site-container loading-page" aria-busy="true">
      <span className="sr-only">Loading Paper-to-Prototype</span>
      <div className="loading-line loading-line-short" />
      <div className="loading-line loading-line-title" />
      <div className="loading-line loading-line-copy" />
      <div className="loading-grid">
        <div className="loading-card" />
        <div className="loading-card" />
        <div className="loading-card" />
      </div>
    </main>
  );
}

