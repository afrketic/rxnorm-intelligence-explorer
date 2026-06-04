import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  Trophy,
} from 'lucide-react';
import { DrugCard, getAtcClass, type AtcClassPayload } from '../lib/api';
import { buildTherapeuticPathway } from './TherapeuticPathway';

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
  contextBadge?: string;
};

type PathwayNode = {
  code: string;
  label: string;
  level: string | number;
  class_type?: string;
  drug_count?: number;
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

function scoreNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getEnterpriseTier(value: unknown) {
  const score = scoreNumber(value);
  if (score === null) return 'Enterprise tier pending';
  if (score >= 90) return 'Elite ATC class';
  if (score >= 80) return 'Enterprise-ready class';
  if (score >= 65) return 'Developing class';
  return 'Foundational class';
}

function getPercentileContext(value: unknown) {
  const score = scoreNumber(value);
  if (score === null) return 'Percentile pending';
  if (score >= 95) return 'Top 5% of ATC classes';
  if (score >= 90) return 'Top 8% of ATC classes';
  if (score >= 85) return 'Top 15% of ATC classes';
  if (score >= 75) return 'Top quartile ATC class';
  if (score >= 60) return 'Above baseline ATC class';
  return 'Foundational ATC class';
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

function normalizeAtcNode(item: any, index: number): PathwayNode | null {
  const code = clean(item?.code || item?.class_id || item?.atc_code, '');
  const label = clean(item?.label || item?.class_name || item?.atc_name || code, code);
  if (!code) return null;
  return {
    code,
    label,
    level: item?.level ?? item?.class_type ?? `ATC${index + 1}`,
    class_type: item?.class_type,
    drug_count: item?.drug_count,
  };
}

function normalizeBackendPathway(atcData: AtcClassPayload | null): PathwayNode[] {
  const source = atcData?.parent_pathway || atcData?.pathway || [];
  if (!Array.isArray(source)) return [];
  return source.map(normalizeAtcNode).filter(Boolean) as PathwayNode[];
}

function normalizeFallbackPathway(drug: any): PathwayNode[] {
  return buildTherapeuticPathway(drug).map((node: any) => ({
    code: node.code,
    label: node.label,
    level: node.level,
  }));
}

function getSelectedAtc(pathway: PathwayNode[], atcCode: string | null, atcData: AtcClassPayload | null) {
  const targetCode = clean(atcData?.atc_code || atcData?.code || atcData?.class_id || atcCode, '');
  if (targetCode) {
    const existing = pathway.find((node) => node.code === targetCode);
    if (existing) return existing;
    return {
      code: targetCode,
      label: clean(atcData?.atc_name || atcData?.class_name || atcData?.label || targetCode, targetCode),
      level: atcData?.level || 'ATC',
      class_type: atcData?.class_type,
    };
  }
  if (!pathway.length) return null;
  return pathway[pathway.length - 1];
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
    drug_count: node.drug_count,
  }));

  const childCards = childRows.map((row) => ({
    code: row.code || row.class_id,
    label: row.label || row.class_name,
    eyebrow: 'Child ATC class',
    type: 'child',
    drug_count: row.drug_count,
  }));

  const unique = new Map<string, { code: string; label: string; eyebrow: string; type: string; drug_count?: number }>();
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

function getAtcMetric(atcData: AtcClassPayload | null, keys: string[]) {
  if (!atcData) return null;
  for (const key of keys) {
    const value = atcData?.[key] ?? atcData?.metrics?.[key];
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

function MetricCard({ label, value, helper, icon, contextBadge }: MetricCardProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-300">{icon}</div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-white">{formatMetric(value)}</p>
          {contextBadge ? (
            <p className="mt-2 inline-flex rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] text-emerald-100">
              {contextBadge}
            </p>
          ) : null}
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
        Intelligence {formatMetric(score)}
      </p>
    </button>
  );
}

export default function ATCExplorerPage({ drug, atcCode, onBackToDrug, onSelectAtc, onSelectDrug }: Props) {
  const [atcData, setAtcData] = useState<AtcClassPayload | null>(null);
  const [isLoadingAtc, setIsLoadingAtc] = useState(false);
  const [atcError, setAtcError] = useState<string | null>(null);
  const medicationRankingsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const code = String(atcCode || '').trim();
    if (!code) {
      setAtcData(null);
      setAtcError(null);
      return;
    }

    let cancelled = false;
    setIsLoadingAtc(true);
    setAtcError(null);

    getAtcClass(code, 25)
      .then((payload) => {
        if (!cancelled) setAtcData(payload);
      })
      .catch((error) => {
        if (!cancelled) {
          setAtcData(null);
          setAtcError(error instanceof Error ? error.message : 'ATC class request failed');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAtc(false);
      });

    return () => {
      cancelled = true;
    };
  }, [atcCode]);

  const fallbackPathway = useMemo(() => normalizeFallbackPathway(drug), [drug]);
  const backendPathway = useMemo(() => normalizeBackendPathway(atcData), [atcData]);
  const pathway = backendPathway.length ? backendPathway : fallbackPathway;
  const selectedAtc = getSelectedAtc(pathway, atcCode, atcData);
  const selectedCode = selectedAtc?.code || atcCode || 'ATC';
  const selectedLabel = clean(atcData?.atc_name || atcData?.class_name || atcData?.label || selectedAtc?.label, 'ATC class intelligence');
  const selectedIndex = selectedAtc ? pathway.findIndex((node) => node.code === selectedAtc.code) : -1;
  const parentPathway = selectedIndex >= 0 ? pathway.slice(0, selectedIndex + 1) : pathway;
  const backendChildren = Array.isArray(atcData?.children || atcData?.child_classes)
    ? ((atcData?.children || atcData?.child_classes) as any[]).map((item, index) => normalizeAtcNode(item, index)).filter(Boolean)
    : [];
  const childRows = backendChildren.length ? backendChildren : getClassRows(drug, selectedCode);
  const peers = getPeerRows(pathway, selectedAtc);
  const classCards = buildClassCards(pathway, childRows, selectedCode);

  const fallbackCohort = buildMedicationCohort(drug);
  const backendCohort = Array.isArray(atcData?.drugs) ? atcData!.drugs! : [];
  const cohort = backendCohort.length ? backendCohort : fallbackCohort;
  const sortedTop = sortByScore(cohort, 'desc');
  const sortedBottom = sortByScore(cohort, 'asc').filter((item) => !sortedTop.slice(0, 5).includes(item));
  const topDrugs = atcData?.top_drugs?.length ? atcData.top_drugs : sortedTop.slice(0, 5);
  const bottomDrugs = atcData?.bottom_drugs?.length ? atcData.bottom_drugs : sortedBottom.slice(0, 5);
  const sourceDrugName = getDrugName(drug);
  const cohortCount = atcData?.drug_count ?? atcData?.metrics?.drug_count ?? cohort.length;
  const cohortHelper = atcData
    ? `Calculated from ${formatMetric(cohortCount)} medication rows mapped to ${selectedCode}.`
    : cohort.length > 1
      ? `Derived from ${cohort.length} available class/peer medication rows in the current payload.`
      : 'Derived from the origin drug while the ATC aggregation endpoint loads.';

  const avgOverall = getAtcMetric(atcData, ['average_intelligence', 'average_overall_intelligence_score']) ?? averageScore(cohort, 'overall_intelligence_score') ?? metricValue(drug, 'overall_intelligence_score');
  const avgClaims = getAtcMetric(atcData, ['average_claims_readiness', 'average_claims_readiness_score']) ?? averageScore(cohort, 'claims_readiness_score') ?? metricValue(drug, 'claims_readiness_score');
  const avgAi = getAtcMetric(atcData, ['average_ai_readiness', 'average_ai_readiness_score']) ?? averageScore(cohort, 'ai_readiness_score') ?? metricValue(drug, 'ai_readiness_score');
  const avgSemantic = getAtcMetric(atcData, ['average_semantic_richness', 'average_semantic_richness_score']) ?? averageScore(cohort, 'semantic_richness_score') ?? metricValue(drug, 'semantic_richness_score');
  const avgInterop = getAtcMetric(atcData, ['average_interoperability', 'average_interoperability_score']) ?? averageScore(cohort, 'interoperability_score') ?? metricValue(drug, 'interoperability_score');
  const atcPercentileContext = getPercentileContext(avgOverall);
  const atcEnterpriseTier = getEnterpriseTier(avgOverall);
  const scrollToMedicationRankings = () => medicationRankingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
            <span className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100">
              {atcData ? 'Real ATC aggregation active' : isLoadingAtc ? 'Loading ATC aggregation' : 'Fallback class context'}
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
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-black text-cyan-100">
                {formatMetric(cohortCount)} medications
              </span>
              <span className="inline-flex items-center rounded-full border border-blue-300/30 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-100">
                {formatMetric(avgOverall)} average intelligence
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-100">
                <Trophy className="h-3.5 w-3.5" /> {atcEnterpriseTier}
              </span>
            </div>
            <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-300">
              This is a true class-level therapeutic intelligence page. Metrics are calculated across all medications mapped to the selected ATC class when the backend aggregation endpoint is available.
            </p>
            {atcError ? <p className="mt-3 text-sm text-amber-200">ATC aggregation fallback active: {atcError}</p> : null}
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
              <button
                type="button"
                onClick={scrollToMedicationRankings}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left transition hover:border-cyan-300 hover:bg-cyan-950/20 focus:outline-none focus:ring-2 focus:ring-cyan-300"
              >
                <p className="text-xs font-bold text-slate-400">Medication set</p>
                <p className="mt-2 text-2xl font-black text-white">{formatMetric(cohortCount)}</p>
                <p className="mt-2 text-xs font-black text-cyan-200">View all {formatMetric(cohortCount)} medications →</p>
              </button>
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
        <MetricCard label="Avg intelligence" value={avgOverall} helper={cohortHelper} icon={<Activity className="h-5 w-5" />} contextBadge={atcPercentileContext} />
        <MetricCard label="Avg claims readiness" value={avgClaims} helper={cohortHelper} icon={<Database className="h-5 w-5" />} contextBadge={getEnterpriseTier(avgClaims)} />
        <MetricCard label="Avg AI readiness" value={avgAi} helper={cohortHelper} icon={<Brain className="h-5 w-5" />} contextBadge={getEnterpriseTier(avgAi)} />
        <MetricCard label="Avg semantic richness" value={avgSemantic} helper={cohortHelper} icon={<ShieldCheck className="h-5 w-5" />} contextBadge={getEnterpriseTier(avgSemantic)} />
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
            Use these class cards to move up and down the therapeutic hierarchy. Child cards are now populated from the backend ATC class endpoint when available.
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
                {card.drug_count !== undefined ? <p className="mt-2 text-xs font-black text-cyan-200">{formatMetric(card.drug_count)} medications</p> : null}
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

        <section ref={medicationRankingsRef} className="scroll-mt-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Medication rankings</p>
          <h3 className="mt-2 text-2xl font-black text-white">Top / bottom medication context</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Rankings are now sourced from the ATC class aggregation endpoint when available, so top and bottom cohorts represent the selected class rather than the origin drug.
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
        <p className="mt-2 text-sm text-slate-400">Current distribution reflects the selected ATC class aggregation.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ['Claims', avgClaims],
            ['AI', avgAi],
            ['Semantic', avgSemantic],
            ['Interoperability', avgInterop],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
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
