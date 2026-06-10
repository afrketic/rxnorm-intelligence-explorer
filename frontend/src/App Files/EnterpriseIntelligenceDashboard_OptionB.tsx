import { useMemo } from 'react';
import { DrugCard } from '../lib/api';

type GraphMetrics = {
  rxcui?: string;
  node_count?: number;
  edge_count?: number;
  classification_node_count?: number;
  relationship_node_count?: number;
  intelligence_domain_count?: number;
  classification_depth?: number;
  graph_connectivity_score?: number;
  graph_builder_version?: string;
  graph_build_timestamp?: string;
};

type EnterpriseDashboardDrug = DrugCard & {
  drug?: Record<string, any>;
  scorecard?: Record<string, any>;
  graph_metrics?: GraphMetrics;
  graph?: {
    nodes?: any[];
    edges?: any[];
  };
  classifications?: {
    counts?: Record<string, number>;
    [key: string]: any;
  };
  relationships?: {
    counts?: Record<string, number>;
    [key: string]: any;
  };
};

type Props = {
  drug: EnterpriseDashboardDrug | null;
};

function getValue(drug: EnterpriseDashboardDrug | null, keys: string[], fallback: any = null) {
  if (!drug) return fallback;

  for (const key of keys) {
    if (!key) continue;

    if ((drug as any)[key] !== undefined && (drug as any)[key] !== null && (drug as any)[key] !== '') {
      return (drug as any)[key];
    }

    if (drug.drug && drug.drug[key] !== undefined && drug.drug[key] !== null && drug.drug[key] !== '') {
      return drug.drug[key];
    }

    if (drug.scorecard && drug.scorecard[key] !== undefined && drug.scorecard[key] !== null && drug.scorecard[key] !== '') {
      return drug.scorecard[key];
    }
  }

  return fallback;
}

function toNumber(value: any, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatScore(value: any) {
  const numeric = toNumber(value, 0);
  return `${Math.round(numeric)}%`;
}

function formatDecimal(value: any) {
  const numeric = toNumber(value, 0);
  return numeric.toFixed(2);
}

function formatCount(value: any) {
  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString(undefined, {
      maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    });
  }

  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function scoreLabel(score: number) {
  if (score >= 95) return 'Platinum';
  if (score >= 90) return 'Enterprise Ready';
  if (score >= 75) return 'Gold';
  if (score >= 50) return 'Developing';
  if (score >= 25) return 'Limited';
  return 'Foundational';
}

function getTierStyle(tier: string) {
  const normalized = tier.toLowerCase();

  if (normalized.includes('platinum')) {
    return 'border-slate-300 bg-slate-950 text-white';
  }

  if (normalized.includes('enterprise')) {
    return 'border-blue-200 bg-blue-50 text-blue-900';
  }

  if (normalized.includes('gold') || normalized.includes('strong')) {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }

  if (normalized.includes('silver') || normalized.includes('developing')) {
    return 'border-slate-200 bg-slate-50 text-slate-800';
  }

  return 'border-slate-200 bg-white text-slate-700';
}

function getClassificationCount(drug: EnterpriseDashboardDrug, key: string, fallbackKey?: string) {
  const direct = getValue(drug, [key, fallbackKey || ''], null);
  if (direct !== null) return toNumber(direct, 0);

  const countKey = key.replace('_count', '').toUpperCase();
  return toNumber(drug.classifications?.counts?.[countKey], 0);
}

function getAtcDepth(drug: EnterpriseDashboardDrug, metrics: GraphMetrics | null) {
  const directDepth = getValue(
    drug,
    ['atc_hierarchy_depth', 'atc_depth', 'classification_atc_max_depth'],
    null
  );

  if (directDepth !== null) return toNumber(directDepth, 0);

  const classifications = drug.classifications || {};
  const derivedDepth = ['ATC1', 'ATC2', 'ATC3', 'ATC4'].filter(
    (bucket) => Array.isArray((classifications as any)[bucket]) && (classifications as any)[bucket].length > 0
  ).length;

  return derivedDepth || toNumber(metrics?.classification_depth, 0);
}

export default function EnterpriseIntelligenceDashboard({ drug }: Props) {
  const metrics = useMemo<GraphMetrics | null>(() => {
    if (!drug) return null;

    if (drug.graph_metrics) {
      return drug.graph_metrics;
    }

    const graphNodeCount = drug.graph?.nodes?.length || 0;
    const graphEdgeCount = drug.graph?.edges?.length || 0;

    if (graphNodeCount || graphEdgeCount) {
      return {
        node_count: graphNodeCount,
        edge_count: graphEdgeCount,
        classification_node_count: getClassificationCount(drug, 'classification_count'),
        relationship_node_count: drug.relationships?.counts
          ? Object.values(drug.relationships.counts).reduce((sum, value) => sum + toNumber(value, 0), 0)
          : 0,
        intelligence_domain_count: getClassificationCount(drug, 'class_type_count'),
        classification_depth: toNumber(getValue(drug, ['atc_hierarchy_depth', 'classification_atc_max_depth'], 0)),
        graph_connectivity_score: 0,
      };
    }

    return null;
  }, [drug]);

  if (!drug) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-slate-500">
          Select a medication to view the Enterprise Intelligence Dashboard.
        </p>
      </section>
    );
  }

  const rxcui = String(getValue(drug, ['rxcui'], ''));
  const drugName = String(getValue(drug, ['rxnorm_name', 'drug_name', 'name', 'label'], `RxCUI ${rxcui}`));
  const termType = String(getValue(drug, ['tty', 'term_type'], 'Medication'));
  const overallScore = toNumber(getValue(drug, ['overall_intelligence_score'], 0));
  const tier = String(getValue(drug, ['benchmark_tier'], scoreLabel(overallScore)));

  const claimsScore = getValue(drug, ['claims_readiness_score'], 0);
  const aiScore = getValue(drug, ['ai_readiness_score'], 0);
  const semanticScore = getValue(drug, ['semantic_richness_score'], 0);
  const interoperabilityScore = getValue(
    drug,
    ['interoperability_score', 'interoperability_readiness_score', 'graph_connectivity_score'],
    metrics?.graph_connectivity_score ?? 0
  );

  const classificationCount = getClassificationCount(drug, 'classification_count', 'classification_record_count');
  const classTypeCount = getClassificationCount(drug, 'class_type_count', 'classification_class_type_count');
  const diseaseCount = getClassificationCount(drug, 'disease_count', 'classification_DISEASE_count');
  const relationshipCount = toNumber(
    getValue(drug, ['relationship_count', 'relationship_count_for_scoring'], metrics?.relationship_node_count || 0)
  );
  const atcDepth = getAtcDepth(drug, metrics);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-950 px-7 py-7 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">
              Medication Intelligence Scorecard
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
              {drugName}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                RxCUI {rxcui || '—'}
              </span>

              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                {termType}
              </span>

              <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${getTierStyle(tier)}`}>
                {tier}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 text-right backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
              Overall Intelligence
            </p>
            <p className="mt-1 text-5xl font-black text-white">
              {formatScore(overallScore)}
            </p>
            <p className="mt-1 text-sm font-semibold text-blue-200">
              {formatDecimal(overallScore)} raw score
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HeroMetric label="Claims Readiness" value={formatScore(claimsScore)} />
          <HeroMetric label="AI Readiness" value={formatScore(aiScore)} />
          <HeroMetric label="Semantic Richness" value={formatScore(semanticScore)} />
          <HeroMetric label="Interoperability" value={formatScore(interoperabilityScore)} />
        </div>
      </div>

      <div className="p-7">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">
                Knowledge Graph
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Enterprise Medication Footprint
              </h2>
            </div>

            <p className="text-sm font-semibold text-slate-500">
              Classifications, domains, disease maps, relationships, and ATC depth.
            </p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <EnterpriseKpi label="Classifications" value={classificationCount} />
            <EnterpriseKpi label="Domains" value={classTypeCount} />
            <EnterpriseKpi label="Disease Maps" value={diseaseCount} />
            <EnterpriseKpi label="Relationships" value={relationshipCount} />
            <EnterpriseKpi label="ATC Depth" value={`${formatCount(atcDepth)}/4`} />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-white">
        {value}
      </p>
    </div>
  );
}

function EnterpriseKpi({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{formatCount(value)}</p>
    </div>
  );
}
