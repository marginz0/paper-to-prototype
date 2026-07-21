export default function LabLoading() {
  return (
    <main id="main-content" className="site-container lab-loading" aria-busy="true">
      <span className="sr-only">Loading laboratory</span>
      <div className="loading-line loading-line-short" />
      <div className="loading-line loading-line-title" />
      <div className="loading-lab-panel" />
    </main>
  );
}

