import { DrugCard } from '../lib/api';
import MetricGauge from './MetricGauge';

export default function IntelligenceCard({ drug }: { drug: DrugCard | null }) {
  if (!drug) {
    return <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Select a drug to view intelligence metrics.</div>;
  }
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">RxNorm Intelligence Explorer</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-950">{drug.drug_name || drug.rxnorm_name}</h2>
          <p className="mt-2 text-slate-500">RxCUI {drug.rxcui} · {drug.tty_normalized || drug.term_type_normalized}</p>
        </div>
        <div className="rounded-2xl bg-slate-950 px-5 py-3 text-right text-white">
          <p className="text-xs uppercase tracking-wide text-slate-300">Benchmark Tier</p>
          <p className="text-xl font-bold">{drug.benchmark_tier || 'Unassigned'}</p>
        </div>
      </div>
      <div className="mt-6 rounded-3xl bg-gradient-to-br from-slate-950 to-blue-950 p-6 text-white">
        <p className="text-sm font-medium text-blue-100">Overall Intelligence Score</p>
        <p className="mt-2 text-6xl font-bold">{Number(drug.overall_intelligence_score || 0).toFixed(1)}</p>
        <p className="mt-2 text-sm text-blue-100">Score band: {drug.score_band || 'N/A'}</p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricGauge label="Claims Readiness" value={drug.claims_readiness_score} />
        <MetricGauge label="AI Readiness" value={drug.ai_readiness_score} />
        <MetricGauge label="Semantic Richness" value={drug.semantic_richness_score} />
        <MetricGauge label="Interoperability" value={drug.interoperability_score} />
        <MetricGauge label="Clinical Semantics" value={drug.clinical_semantics_score} />
        <MetricGauge label="Relationship Density" value={drug.relationship_density_score} />
        <MetricGauge label="Classification Density" value={drug.classification_density_score} />
        <MetricGauge label="Class Type Coverage" value={Math.min(100, Number(drug.class_type_count || 0) * 12.5)} helper={`${drug.class_type_count || 0} class types`} />
      </div>
    </section>
  );
}
