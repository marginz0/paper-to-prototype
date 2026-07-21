import type { Metadata } from "next";

import { ArxivAnalyzer } from "@/components/analysis/ArxivAnalyzer";

export const metadata: Metadata = {
  title: "Analyze an arXiv paper",
  description:
    "Experimentally match an arXiv paper's central method to one of three verified interactive learning laboratories.",
};

export default function AnalyzePage() {
  return (
    <main id="main-content" className="analysis-page">
      <section className="site-container analysis-intro">
        <div>
          <p className="eyebrow analysis-experimental-label">
            Experimental / structured paper analysis
          </p>
          <h1>Bring a paper. Find the method you can run.</h1>
        </div>
        <div className="analysis-intro-copy">
          <p>
            Paper-to-Prototype can currently recognize three exact method families:
            standard k-Means, standard A*, and scaled dot-product attention.
          </p>
          <p>
            GPT-5.6 returns validated educational data only. Trusted application code
            decides whether one of the existing laboratories is a faithful match—no
            generated code is compiled or executed.
          </p>
        </div>
      </section>

      <ArxivAnalyzer />
    </main>
  );
}
