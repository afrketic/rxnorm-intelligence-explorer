import type { ReactNode } from 'react';
import { Activity, Brain, Database, Network, ShieldCheck, Stethoscope } from 'lucide-react';
import { DrugCard } from '../lib/api';

type EnterpriseDashboardDrug = DrugCard & {
  drug?: Record<string, any>;
  scorecard?: Record<string, any>;
  graph_metrics?: Record<string, any>;
  graph?: {
    nodes?: any[];
    edges?: any[];
  };
  classifications?: Record<string, any>;
  relationships?: Record<string, any>;
};

type Props = {
  drug: EnterpriseDashboardDrug | null;
};

type MetricCardProps = {
  label: string;
  value: unknown;
  helper: string;
  icon: ReactNode;
};

function clean(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function formatNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 1,
  });
}

function getValue(drug: any, key: string) {
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

function getClassifications(drug: any) {
  return drug?.classifications || drug?.drug?.classifications || {};
}

function getBucketCount(drug: any, bucket: string) {
  const classifications = getClassifications(drug);
  const items = classifications?.[bucket];
  return Array.isArray(items) ? items.length : 0;
}

function getClassificationCount(drug: any) {
  const classifications = getClassifications(drug);
  return Object.entries(classifications).reduce((sum, [key, value]) => {
    if (key === 'counts') return sum;
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

function getRelationshipCount(drug: any) {
  const relationships = drug?.relationships || drug?.drug?.relationships || {};
  const counts = relationships?.counts || {};

  const fromCounts = Object.values(counts).reduce<number>((sum, value) => {
    const numeric = Number(value);
    return sum + (Number.isFinite(numeric) ? numeric : 0);
  }, 0);

  if (fromCounts > 0) return fromCounts;

  return Object.entries(relationships).reduce((sum, [key, value]) => {
    if (key === 'counts') return sum;
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

function MetricCard({ label, value, helper, icon }: MetricCardProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-300">{icon}</div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black text-white">{formatNumber(value)}</p>
          <p className="mt-2 text-sm leading-5 text-slate-400">{helper}</p>
        </div>
      </div>
    </div>
  );
}

export default function EnterpriseIntelligenceDashboard({ drug }: Props) {
  if (!drug) return null;

  const name = getDrugName(drug);
  const tier = clean(getValue(drug, 'benchmark_tier') || drug?.tier, 'Unclassified');
  const atcDepth = ['ATC1', 'ATC2', 'ATC3', 'ATC4'].filter((bucket) => getBucketCount(drug, bucket) > 0).length;
  const classificationCount = getClassificationCount(drug);
  const relationshipCount = getRelationshipCount(drug);
  const graphNodes =
    drug?.graph_metrics?.node_count ||
    drug?.graph_metrics?.nodes ||
    drug?.graph?.nodes?.length ||
    0;

  return (
    <section className="rounded-[2rem] border border-slate-800 bg-slate-900/70 p-6 text-white shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">Compact Executive Overview</p>
          <h3 className="mt-2 text-2xl font-black">Enterprise intelligence summary</h3>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
            {name} is summarized here as a compact executive profile. Detailed clinical evidence, relationships, graph analytics, AI readiness, executive ranking, and production readiness are organized into the workspace tabs below instead of one long dashboard.
          </p>
        </div>
        <span className="w-fit rounded-full border border-blue-500/60 bg-blue-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
          {tier}
        </span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Overall" value={getValue(drug, 'overall_intelligence_score')} helper="Enterprise intelligence score" icon={<Activity className="h-5 w-5" />} />
        <MetricCard label="Claims" value={getValue(drug, 'claims_readiness_score')} helper="Claims readiness score" icon={<Database className="h-5 w-5" />} />
        <MetricCard label="AI" value={getValue(drug, 'ai_readiness_score')} helper="AI readiness score" icon={<Brain className="h-5 w-5" />} />
        <MetricCard label="Semantic" value={getValue(drug, 'semantic_richness_score')} helper="Semantic richness score" icon={<ShieldCheck className="h-5 w-5" />} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="ATC depth" value={atcDepth ? `${atcDepth}/4` : '—'} helper="Populated therapeutic hierarchy" icon={<Stethoscope className="h-5 w-5" />} />
        <MetricCard label="Classifications" value={classificationCount || '—'} helper="Mapped classification records" icon={<ShieldCheck className="h-5 w-5" />} />
        <MetricCard label="Relationships" value={relationshipCount || '—'} helper="RxNorm relationship signals" icon={<Network className="h-5 w-5" />} />
        <MetricCard label="Graph nodes" value={graphNodes || '—'} helper="Knowledge graph footprint" icon={<Network className="h-5 w-5" />} />
      </div>
    </section>
  );
}
