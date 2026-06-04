import type { ReactNode } from 'react';
import {
  ArrowLeft,
  Activity,
  Brain,
  Database,
  Network,
  ShieldCheck,
  Layers3,
  ArrowRight,
  GitBranch,
} from 'lucide-react';
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

type CohortDrug = Record<string, any> & {
  drug_name?: string;
  rxnorm_name?: string;
  display_name?: string;
  rxcui?: string | number;
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

function scoreValue(item: any, key: string) {
  return (
    item?.[key] ??
    item?.scorecard?.[key] ??
    item?.drug?.[key] ??
    item?.[`avg_${key}`] ??
    item?.[`average_${key}`] ??
    null
  );
}

function metricValue(drug: any, key: string) {
  return scoreValue(drug, key);
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

function getDrugRxcui(drug: any) {
  return String(drug?.rxcui || drug?.drug?.rxcui || '').trim();
}

function getSelectedAtc(pathway: PathwayNode[], atcCode: string | null) {
  if (!pathway.length) return null;
  return pathway.find((node) => node.code === atcCode) || pathway[pathway.length - 1];
}

function getRelatedDrugs(drug: any): CohortDrug[] {
  const possibleSources = [
    drug?.atc_class_drugs,
    drug?.class_medications,
    drug?.peer_medications,
    drug?.similar_medications,
    drug?.drug?.atc_class_drugs,
    drug?.drug?.class_medications,
    drug?.drug?.peer_medications,
    drug?.drug?.similar_medications,
  ];

  const firstArray = possibleSources.find((value) => Array.isArray(value));
  return firstArray || [];
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

function buildClassCards(pathway: PathwayNode[], childRows: any[], selectedCode: string) {
  const pathwayCards = pathway.map((node) => ({
    code: node.code,
    label: node.label,
    eyebrow: node.code === selectedCode ? 'Current ATC class' : `ATC ${node.level}`,
    type: 'pathway',
  }));

  const childCards = childRows.map((row) => ({
    code: row.code,
    label: row.label,
    eyebrow: 'Child ATC class',
    type: 'child',
  }));

  const unique = new Map<string, { code: string; label: string; eyebrow: string; type: string }>();
  [...pathwayCards, ...childCards].forEach((card) => {
    if (card.code && !unique.has(card.code)) unique.set(card.code, card);
  });

  return Array.from(unique.values());
}

function makeOriginDrug(drug: any): CohortDrug | null {
  if (!drug) return null;
  const name = getDrugName(drug);
  const rxcui = getDrugRxcui(drug);
  return {
    ...drug,
    drug_name: name,
    rxnorm_name: name,
    display_name: name,
    rxcui,
    _source: 'origin',
  };
}

function buildMedicationCohort(drug: any): CohortDrug[] {
  const origin = makeOriginDrug(drug);
  const related = getRelatedDrugs(drug);
  const unique = new Map<string, CohortDrug>();

  [origin, ...related].forEach((item) => {
    if (!item) return;
    const key = String(item.rxcui || item.rxnorm_name || item.drug_name || item.display_name || item.name || Math.random()).trim();
    if (!unique.has(key)) unique.set(key, item);
  });

  return Array.from(unique.values());
}

function averageScore(items: CohortDrug[], key: string) {
  const values = items
    .map((item) => Number(scoreValue(item, key) ?? item.overall_similarity ?? item.similarity_score))
    .filter((value) => Number.isFinite(value));

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sortByScore(items: CohortDrug[], direction: 'desc' | 'asc') {
  return [...items].sort((a, b) => {
    const aScore = Number(scoreValue(a, 'overall_intelligence_score') ?? a.overall_similarity ?? a.similarity_score ?? 0);
    const bScore = Number(scoreValue(b, 'overall_intelligence_score') ?? b.overall_similarity ?? b.similarity_score ?? 0);
    return direction === 'desc' ? bScore - aScore : aScore - bScore;
  });
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

function DrugPill({ item, onSelectDrug }: { item: CohortDrug; onSelectDrug?: (drug: Record<string, any>) => void }) {
  const name = item?.drug_name || item?.rxnorm_name || item?.display_name || item?.name || 'Related medication';
  const score = scoreValue(item, 'overall_intelligence_score') ?? item?.overall_similarity ?? item?.similarity_score;
  const rxcui = item?.rxcui;

  return (
    <button
      type="button"
      onClick={() => onSelectDrug?.(item)}
      className="group rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-left transition hover:border-blue-400 hover:bg-blue-950/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">{name}</p>
          {rxcui ? <p className="mt-1 text-xs text-slate-500">RxCUI {rxcui}</p> : null}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-slate-600 transition group-hover:text-blue-300" />
      </div>
      <p className="mt-2 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan-200">
        Score / similarity {formatMetric(score)}
      </p>
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
  const classCards = buildClassCards(pathway, childRows, selectedCode);
  const cohort = buildMedicationCohort(drug);
  const sortedTop = sortByScore(cohort, 'desc');
  const sortedBottom = sortByScore(cohort, 'asc').filter((item) => !sortedTop.slice(0, 5).includes(item));
  const topDrugs = sortedTop.slice(0, 5);
  const bottomDrugs = sortedBottom.slice(0, 5);
  const sourceDrugName = getDrugName(drug);
  const cohortCount = cohort.length;
  const cohortHelper = cohortCount > 1
    ? `Derived from ${cohortCount} available class/peer medication rows in the current payload.`
    : 'Derived from the origin drug until the backend ATC aggregation endpoint is added.';

  const avgOverall = averageScore(cohort, 'overall_intelligence_score') ?? metricValue(drug, 'overall_intelligence_score');
  const avgClaims = averageScore(cohort, 'claims_readiness_score') ?? metricValue(drug, 'claims_readiness_score');
  const avgAi = averageScore(cohort, 'ai_readiness_score') ?? metricValue(drug, 'ai_readiness_score');
  const avgSemantic = averageScore(cohort, 'semantic_richness_score') ?? metricValue(drug, 'semantic_richness_score');

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
              <Layers3 className="h-3.5 w-3.5" /> You are viewing an ATC class
            </span>
            <span className="inline-flex rounded-full border border-blue-300/30 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-100">
              Originally from {sourceDrugName}
            </span>
          </div>
          <button
            type="button"
            onClick={onBackToDrug}
            className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/40 bg-slate-950/70 px-4 py-2 text-sm font-black text-cyan-100 transition hover:border-cyan-200 hover:bg-cyan-950/30 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          >
            <ArrowLeft className="h-4 w-4" /> Return to original drug
          </button>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">ATC Explorer</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="text-5xl font-black tracking-tight text-white">{selectedCode}</h2>
              <span className="rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-100">ATC Level {selectedAtc.level}</span>
            </div>
            <p className="mt-2 text-2xl font-black text-cyan-100">{selectedLabel}</p>
            <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">
              This is a class-level therapeutic intelligence page. Breadcrumb nodes are clickable therapeutic navigation targets, medication rankings are built from available peer/class rows, and the layout is ready for true backend ATC aggregation endpoints.
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
                <p className="text-xs font-bold text-slate-400">Origin drug</p>
                <p className="mt-2 text-lg font-black text-white">{sourceDrugName}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-bold text-slate-400">Pathway position</p>
                <p className="mt-2 text-2xl font-black text-white">{selectedIndex + 1} of {pathway.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <p className="text-xs font-bold text-slate-400">Medication set</p>
                <p className="mt-2 text-2xl font-black text-white">{formatMetric(cohortCount)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            <GitBranch className="h-4 w-4" /> Therapeutic breadcrumb
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            {parentPathway.map((node, index) => (
              <div key={`${node.level}-${node.code}`} className="flex items-center gap-2">
                {index > 0 ? <ArrowRight className="h-4 w-4 text-cyan-400/70" /> : null}
                <button
                  type="button"
                  onClick={() => onSelectAtc?.(node.code)}
                  className={`min-w-[9rem] rounded-2xl border px-4 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-300 ${
                    node.code === selectedCode
                      ? 'border-cyan-300 bg-cyan-400/20 text-cyan-100'
                      : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-cyan-300 hover:text-white'
                  }`}
                  aria-label={`Open ATC Explorer for ${node.code} ${node.label}`}
                >
                  <p className="text-sm font-black text-white">{node.code}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-400">{node.label}</p>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Avg intelligence" value={avgOverall} helper={cohortHelper} icon={<Activity className="h-5 w-5" />} />
        <MetricCard label="Avg claims readiness" value={avgClaims} helper={cohortHelper} icon={<Database className="h-5 w-5" />} />
        <MetricCard label="Avg AI readiness" value={avgAi} helper={cohortHelper} icon={<Brain className="h-5 w-5" />} />
        <MetricCard label="Avg semantic richness" value={avgSemantic} helper={cohortHelper} icon={<ShieldCheck className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Class ecosystem</p>
              <h3 className="mt-2 text-2xl font-black text-white">ATC class cards</h3>
            </div>
            <Network className="h-6 w-6 text-cyan-300" />
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Use these class cards to move up and down the therapeutic hierarchy. Child class cards will expand automatically as backend ATC class endpoints are added.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {classCards.map((card) => (
              <button
                key={`${card.type}-${card.code}`}
                type="button"
                onClick={() => onSelectAtc?.(card.code)}
                className={`rounded-2xl border px-4 py-4 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-300 ${
                  card.code === selectedCode
                    ? 'border-cyan-300 bg-cyan-400/15'
                    : 'border-slate-800 bg-slate-950/70 hover:border-cyan-300 hover:bg-cyan-950/20'
                }`}
              >
                <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-300">{card.eyebrow}</p>
                <p className="mt-2 text-lg font-black text-white">{card.code}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{card.label}</p>
              </button>
            ))}
          </div>

          <div className="mt-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Parent / peer pathway nodes</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {peers.map((node) => (
                <button
                  key={node.code}
                  type="button"
                  onClick={() => onSelectAtc?.(node.code)}
                  className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-black text-slate-200 hover:border-cyan-300 hover:text-white"
                >
                  {node.code} · {node.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Medication rankings</p>
          <h3 className="mt-2 text-2xl font-black text-white">Top / bottom medication context</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Rankings are sorted from available class, peer, and similarity medication rows. When backend ATC aggregation is added, this section can switch to true class-level top/bottom cohorts without changing the UI.
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
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Bottom / additional context</p>
              <div className="mt-3 grid gap-2">
                {bottomDrugs.length > 0 ? (
                  bottomDrugs.map((item: any, index: number) => (
                    <DrugPill key={`${item.rxcui || item.drug_name || index}`} item={item} onSelectDrug={onSelectDrug} />
                  ))
                ) : (
                  <p className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">Bottom-drug rankings require more than one available cohort row.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Distribution</p>
        <h3 className="mt-2 text-2xl font-black text-white">Readiness distribution</h3>
        <p className="mt-2 text-sm text-slate-400">Current distribution reflects the available medication cohort for this class view.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ['Claims', avgClaims],
            ['AI', avgAi],
            ['Semantic', avgSemantic],
            ['Interoperability', averageScore(cohort, 'interoperability_score') ?? metricValue(drug, 'interoperability_score')],
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
