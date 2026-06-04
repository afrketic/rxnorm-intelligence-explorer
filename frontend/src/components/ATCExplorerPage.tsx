import type { ReactNode } from 'react';
import { ArrowLeft, Activity, Brain, Database, Network, ShieldCheck } from 'lucide-react';
import { DrugCard } from '../lib/api';
import { buildTherapeuticPathway, type PathwayNode } from './TherapeuticPathway';

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
  atcCode: string | null;
  onBackToDrug: () => void;
  onSelectAtc?: (code: string) => void;
  onSelectDrug?: (drug: Record<string, any>) => void;
};

type MetricCardProps = {
  label: string;
  value: unknown;
  helper: string;
  icon: ReactNode;
};

function clean(value: unknown, fallback = 'Not available') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatMetric(value: unknown) {
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
      drug?.drug?.display_name ||
      drug?.drug?.rxnorm_name ||
      drug?.drug?.drug_name,
    'Selected medication'
  );
}

function getSelectedAtc(pathway: PathwayNode[], atcCode: string | null) {
  if (!pathway.length) return null;
  return pathway.find((node) => node.code === atcCode) || pathway[pathway.length - 1];
}

function getRelatedDrugs(drug: any) {
  const similar = drug?.similar_medications || drug?.drug?.similar_medications || [];
  return Array.isArray(similar) ? similar : [];
}

function getClassRows(drug: any, selectedCode: string) {
  const classifications = drug?.classifications || drug?.drug?.classifications || {};
  const rows = Object.entries(classifications)
    .filter(([bucket]) => bucket !== 'counts' && bucket !== 'raw_rows')
    .flatMap(([bucket, value]) => {
      if (!Array.isArray(value)) return [];
      return value.map((item: any) => ({
        ...item,
        bucket,
        code: String(item?.class_id || item?.classId || '').trim(),
        label: String(item?.class_name || item?.className || item?.class_id || '').trim(),
      }));
    })
    .filter((item) => item.code && item.code !== selectedCode && item.code.startsWith(selectedCode));

  const unique = new Map<string, any>();
  rows.forEach((row) => {
    if (!unique.has(row.code)) unique.set(row.code, row);
  });

  return Array.from(unique.values()).slice(0, 12);
}

function getPeerRows(pathway: PathwayNode[], selected: PathwayNode | null) {
  if (!selected) return [];
  const index = pathway.findIndex((node) => node.code === selected.code);
  if (index < 0) return [];
  return pathway.filter((_, itemIndex) => itemIndex !== index);
}

function MetricCard({ label, value, helper, icon }: MetricCardProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-300">{icon}</div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-white">{formatMetric(value)}</p>
          <p className="mt-2 text-sm leading-5 text-slate-400">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function DrugPill({ item, onSelectDrug }: { item: any; onSelectDrug?: (drug: Record<string, any>) => void }) {
  const name = item?.drug_name || item?.rxnorm_name || item?.display_name || item?.name || 'Related medication';
  const score = item?.overall_intelligence_score ?? item?.overall_similarity ?? item?.similarity_score;

  return (
    <button
      type="button"
      onClick={() => onSelectDrug?.(item)}
      className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-left transition hover:border-blue-400 hover:bg-blue-950/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <p className="text-sm font-black text-white">{name}</p>
      <p className="mt-1 text-xs text-slate-400">Score / similarity {formatMetric(score)}</p>
    </button>
  );
}

export default function ATCExplorerPage({ drug, atcCode, onBackToDrug, onSelectAtc, onSelectDrug }: Props) {
  const pathway = buildTherapeuticPathway(drug);
  const selectedAtc = getSelectedAtc(pathway, atcCode);
  const selectedCode = selectedAtc?.code || atcCode || 'ATC';
  const selectedLabel = selectedAtc?.label || 'ATC class intelligence';
  const selectedIndex = selectedAtc ? pathway.findIndex((node) => node.code === selectedAtc.code) : -1;
  const parentPathway = selectedIndex >= 0 ? pathway.slice(0, selectedIndex + 1) : pathway;
  const childRows = getClassRows(drug, selectedCode);
  const peers = getPeerRows(pathway, selectedAtc);
  const relatedDrugs = getRelatedDrugs(drug);
  const topDrugs = relatedDrugs.slice(0, 5);
  const bottomDrugs = relatedDrugs.slice(5, 10);
  const sourceDrugName = getDrugName(drug);

  if (!drug || !selectedAtc) {
    return (
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-white shadow-sm">
          <button
            type="button"
            onClick={onBackToDrug}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-black text-slate-200 hover:border-blue-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Drug Explorer
          </button>
          <h2 className="mt-5 text-3xl font-black">ATC Explorer not available</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">Select a medication with a populated ATC pathway to open class-level intelligence.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 text-white">
      <div className="rounded-[2rem] border border-cyan-400/30 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_34%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96)_48%,_rgba(8,47,73,0.62))] p-6 shadow-2xl shadow-cyan-950/20">
        <button
          type="button"
          onClick={onBackToDrug}
          className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/40 bg-slate-950/70 px-4 py-2 text-sm font-black text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-950/30 focus:outline-none focus:ring-2 focus:ring-cyan-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Drug Explorer
        </button>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">ATC Explorer</p>
            <h2 className="mt-3 text-5xl font-black tracking-tight text-white">{selectedCode}</h2>
            <p className="mt-2 text-2xl font-black text-cyan-100">{selectedLabel}</p>
            <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">
              Class-level intelligence view generated from the selected medication pathway. This page is structured for ATC aggregation endpoints when Sprint 2 backend expansion is added.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
            <p className="text-xs font-black uppercase tracking-[0.20em] text-slate-500">Class context</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-bold text-slate-400">ATC level</p>
                <p className="mt-2 text-2xl font-black text-white">{selectedAtc.level}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-bold text-slate-400">Source drug</p>
                <p className="mt-2 text-lg font-black text-white">{sourceDrugName}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-bold text-slate-400">Pathway position</p>
                <p className="mt-2 text-2xl font-black text-white">{selectedIndex + 1} of {pathway.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-bold text-slate-400">Drug count</p>
                <p className="mt-2 text-2xl font-black text-white">—</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {parentPathway.map((node, index) => (
            <button
              key={`${node.level}-${node.code}`}
              type="button"
              onClick={() => onSelectAtc?.(node.code)}
              className={`rounded-full border px-4 py-2 text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-cyan-300 ${
                node.code === selectedCode
                  ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100'
                  : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-cyan-300 hover:text-white'
              }`}
            >
              {index > 0 ? '→ ' : ''}{node.code} · {node.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Avg intelligence" value={metricValue(drug, 'overall_intelligence_score')} helper="Current drug proxy until ATC aggregation is available" icon={<Activity className="h-5 w-5" />} />
        <MetricCard label="Avg claims readiness" value={metricValue(drug, 'claims_readiness_score')} helper="Class metric placeholder using selected drug context" icon={<Database className="h-5 w-5" />} />
        <MetricCard label="Avg AI readiness" value={metricValue(drug, 'ai_readiness_score')} helper="Class metric placeholder using selected drug context" icon={<Brain className="h-5 w-5" />} />
        <MetricCard label="Avg semantic richness" value={metricValue(drug, 'semantic_richness_score')} helper="Class metric placeholder using selected drug context" icon={<ShieldCheck className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Class ecosystem</p>
              <h3 className="mt-2 text-2xl font-black text-white">Hierarchy and related classes</h3>
            </div>
            <Network className="h-6 w-6 text-cyan-300" />
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Child ATC classes</p>
              {childRows.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {childRows.map((row) => (
                    <button
                      key={`${row.bucket}-${row.code}`}
                      type="button"
                      onClick={() => onSelectAtc?.(row.code)}
                      className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-left transition hover:border-cyan-300 hover:bg-cyan-950/20"
                    >
                      <p className="text-sm font-black text-white">{row.code}</p>
                      <p className="mt-1 text-xs text-slate-400">{row.label}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-400">
                  Child class rows are not available from the current drug payload. This area is ready for a future `/atc/:code` backend endpoint.
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Peer pathway nodes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {peers.map((node) => (
                  <button
                    key={node.code}
                    type="button"
                    onClick={() => onSelectAtc?.(node.code)}
                    className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black text-slate-200 hover:border-cyan-300 hover:text-white"
                  >
                    {node.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Medication rankings</p>
          <h3 className="mt-2 text-2xl font-black text-white">Top and related medications</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Current list uses the selected drug's similarity engine until true class-level top/bottom ranking endpoints are added.
          </p>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Top medications</p>
              <div className="mt-3 grid gap-2">
                {topDrugs.length > 0 ? (
                  topDrugs.map((item: any, index: number) => (
                    <DrugPill key={`${item.rxcui || item.drug_name || index}`} item={item} onSelectDrug={onSelectDrug} />
                  ))
                ) : (
                  <p className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">No related medication rows available yet.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Additional / bottom context</p>
              <div className="mt-3 grid gap-2">
                {bottomDrugs.length > 0 ? (
                  bottomDrugs.map((item: any, index: number) => (
                    <DrugPill key={`${item.rxcui || item.drug_name || index}`} item={item} onSelectDrug={onSelectDrug} />
                  ))
                ) : (
                  <p className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">Bottom-drug rankings require ATC class aggregation data.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Distribution</p>
        <h3 className="mt-2 text-2xl font-black text-white">Readiness distribution placeholder</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ['Claims', metricValue(drug, 'claims_readiness_score')],
            ['AI', metricValue(drug, 'ai_readiness_score')],
            ['Semantic', metricValue(drug, 'semantic_richness_score')],
            ['Interoperability', metricValue(drug, 'interoperability_score')],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-cyan-300" style={{ width: `${Math.max(0, Math.min(100, Number(value) || 0))}%` }} />
              </div>
              <p className="mt-2 text-lg font-black text-white">{formatMetric(value)}</p>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
