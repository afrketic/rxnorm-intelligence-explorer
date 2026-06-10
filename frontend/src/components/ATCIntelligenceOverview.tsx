import { useState, type ReactNode } from 'react';
import { Activity, Brain, Database, Info, ShieldCheck, X } from 'lucide-react';
import { DrugCard } from '../lib/api';
import TherapeuticPathway, { buildTherapeuticPathway } from './TherapeuticPathway';

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
  onSelectAtc?: (code: string) => void;
};

type MetricProps = {
  label: string;
  value: unknown;
  helper: string;
  icon: ReactNode;
};

function clean(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatScore(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) return String(value);

  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 1,
  });
}

function metricValue(drug: any, key: string) {
  return drug?.[key] ?? drug?.scorecard?.[key] ?? drug?.drug?.[key] ?? null;
}

function getDrugName(drug: any) {
  return clean(
    drug?.display_name ||
      drug?.rxnorm_name ||
      drug?.drug_name ||
      drug?.name ||
      drug?.drug?.rxnorm_name ||
      drug?.drug?.drug_name,
    'Selected medication'
  );
}

function getClassificationCount(drug: any) {
  const classifications = drug?.classifications || drug?.drug?.classifications || {};

  return Object.entries(classifications).reduce((sum, [key, value]) => {
    if (key === 'counts') return sum;
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

function MetricCard({ label, value, helper, icon }: MetricProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-300">
          {icon}
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black text-white">
            {formatScore(value)}
          </p>
          <p className="mt-2 text-sm leading-5 text-slate-400">
            {helper}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ATCIntelligenceOverview({ drug, onSelectAtc }: Props) {
  const [showPathwayModal, setShowPathwayModal] = useState(false);

  if (!drug) return null;

  const name = getDrugName(drug);
  const rxcui = clean(drug?.rxcui || drug?.drug?.rxcui);

  const tier = clean(
    drug?.benchmark_tier ||
      drug?.tier ||
      drug?.scorecard?.benchmark_tier ||
      drug?.drug?.benchmark_tier,
    'Unclassified'
  );

  const pathway = buildTherapeuticPathway(drug);
  const primaryAtc = pathway[pathway.length - 1];
  const domain = pathway[0];
  const classificationCount = getClassificationCount(drug);

  return (
    <>
      <section className="rounded-[2rem] border border-blue-900/50 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.20),_transparent_34%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.95)_48%,_rgba(2,6,23,0.98))] p-6 text-white shadow-2xl shadow-blue-950/20">
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">
              ATC Intelligence Overview
            </p>

            <div className="mt-4 rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Executive Takeaway
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-200">
                Strategic Priority medication with top-tier semantic coverage, enterprise
                readiness, and clinical relevance.
              </p>
            </div>

            <h2 className="mt-5 text-4xl font-black tracking-tight text-white">
              {name}
            </h2>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              Executive medication view focused on ATC position, semantic readiness,
              claims usefulness, and AI intelligence maturity. Deep clinical,
              relationship, graph, and production details now live in the workspace below.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black text-slate-100">
                RxCUI {rxcui}
              </span>

              <span className="rounded-full border border-blue-500/70 bg-blue-500/20 px-4 py-2 text-xs font-black text-blue-100">
                {tier}
              </span>

              <span className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black text-slate-100">
                Primary ATC {primaryAtc?.code || '—'}
              </span>

              <span className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black text-slate-100">
                Domain {domain?.label || '—'}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-xs font-black uppercase tracking-[0.20em] text-slate-500">
              Snapshot
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-400">
                    ATC depth
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowPathwayModal(true)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-blue-500/60 bg-blue-500/10 text-blue-300 transition hover:border-blue-300 hover:bg-blue-500/20 hover:text-white"
                    aria-label="View ATC pathway details"
                    title="View ATC pathway details"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-2 text-3xl font-black text-white">
                  {pathway.length || '—'}/4
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-bold text-slate-400">
                  Classifications
                </p>

                <p className="mt-2 text-3xl font-black text-white">
                  {classificationCount || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Overall intelligence"
            value={metricValue(drug, 'overall_intelligence_score')}
            helper="Combined enterprise score"
            icon={<Activity className="h-5 w-5" />}
          />

          <MetricCard
            label="Claims readiness"
            value={metricValue(drug, 'claims_readiness_score')}
            helper="Claims and operations fit"
            icon={<Database className="h-5 w-5" />}
          />

          <MetricCard
            label="AI readiness"
            value={metricValue(drug, 'ai_readiness_score')}
            helper="Model-ready semantic utility"
            icon={<Brain className="h-5 w-5" />}
          />

          <MetricCard
            label="Semantic richness"
            value={metricValue(drug, 'semantic_richness_score')}
            helper="Classification and context depth"
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        </div>
      </section>

      {showPathwayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-6 py-8 backdrop-blur-md">
          <div className="relative max-h-[88vh] w-full max-w-7xl overflow-y-auto rounded-[2rem] border border-blue-900/60 bg-slate-950 p-6 shadow-2xl shadow-blue-950/50">
            <button
              type="button"
              onClick={() => setShowPathwayModal(false)}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-blue-400 hover:text-white"
              aria-label="Close ATC pathway modal"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="pr-12">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">
                ATC Pathway Detail
              </p>

              <h3 className="mt-2 text-3xl font-black text-white">
                Therapeutic pathway for {name}
              </h3>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                The ATC hierarchy provides supporting evidence for therapeutic positioning,
                domain mapping, and clinical context.
              </p>
            </div>

            <div className="mt-6">
              <TherapeuticPathway
                drug={drug}
                onSelectAtc={(code) => {
                  setShowPathwayModal(false);
                  onSelectAtc?.(code);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}