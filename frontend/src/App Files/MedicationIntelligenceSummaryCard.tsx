import { DrugCard, ClassificationBuckets, ClassificationItem } from '../lib/api';

function getBucketItems(
  classifications: ClassificationBuckets | undefined,
  bucket: string
): ClassificationItem[] {
  return ((classifications || {})[bucket] as ClassificationItem[]) || [];
}

function getFirstAvailableValue(
  source: Record<string, any> | undefined,
  keys: string[],
  fallback: string | number | null = null
) {
  if (!source) return fallback;

  for (const key of keys) {
    const value = source[key];

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return fallback;
}

function toScore(value: string | number | undefined | null): number | null {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }

  if (value !== undefined && value !== null && value !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function formatScore(value: string | number | undefined | null) {
  const numericValue = toScore(value);
  return numericValue !== null ? `${Math.round(numericValue)}%` : '—';
}

function formatMetric(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === '') return '—';

  const numericValue = Number(value);

  if (Number.isFinite(numericValue)) {
    return numericValue.toLocaleString(undefined, {
      maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2,
    });
  }

  return String(value);
}

function scoreLabel(score: number | null) {
  if (score === null || Number.isNaN(score)) {
    return 'Not Available';
  }

  if (score >= 90) return 'Enterprise Ready';
  if (score >= 75) return 'Strong';
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

function getClassificationCount(
  classifications: ClassificationBuckets,
  bucket: string,
  fallback?: string | number | null
) {
  const explicitFallback = Number(fallback);

  if (Number.isFinite(explicitFallback) && explicitFallback > 0) {
    return explicitFallback;
  }

  return getBucketItems(classifications, bucket).length;
}

function ScoreMetric({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined | null;
}) {
  const numericValue = toScore(value);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-300">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-white">
        {formatScore(value)}
      </p>
      <p className="mt-1 text-xs font-semibold text-blue-100">
        {scoreLabel(numericValue)}
      </p>
    </div>
  );
}

function KnowledgeMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-slate-950">
        {formatMetric(value)}
      </p>
      {helper && (
        <p className="mt-1 text-xs font-medium text-slate-500">
          {helper}
        </p>
      )}
    </div>
  );
}

export default function MedicationIntelligenceSummaryCard({
  drug,
}: {
  drug:
    | (DrugCard & {
        classifications?: ClassificationBuckets;
        scorecard?: Record<string, string | number | null | undefined>;
        drug?: Record<string, string | number | null | undefined>;
        relationships?: Record<string, any>;
        graph_metrics?: Record<string, any>;
      })
    | null;
}) {
  if (!drug) {
    return null;
  }

  const classifications = drug.classifications || {};
  const scorecard = drug.scorecard || {};
  const drugData = drug.drug || drug;
  const relationships = (drug as any).relationships || {};
  const relationshipCounts = relationships.counts || {};
  const graphMetrics = (drug as any).graph_metrics || {};

  const displayName =
    getFirstAvailableValue(drugData, ['rxnorm_name', 'drug_name', 'name', 'display_name', 'label']) ||
    drug.rxcui ||
    'Selected Medication';

  const rxcui =
    getFirstAvailableValue(drugData, ['rxcui']) ||
    drug.rxcui ||
    'N/A';

  const termType =
    getFirstAvailableValue(drugData, ['tty', 'term_type'], 'Medication') ||
    'Medication';

  const overallScore =
    getFirstAvailableValue(scorecard, ['overall_intelligence_score']) ??
    getFirstAvailableValue(drugData, ['overall_intelligence_score']);

  const claimsScore =
    getFirstAvailableValue(scorecard, ['claims_readiness_score']) ??
    getFirstAvailableValue(drugData, ['claims_readiness_score']);

  const aiScore =
    getFirstAvailableValue(scorecard, ['ai_readiness_score']) ??
    getFirstAvailableValue(drugData, ['ai_readiness_score']);

  const semanticScore =
    getFirstAvailableValue(scorecard, ['semantic_richness_score']) ??
    getFirstAvailableValue(drugData, ['semantic_richness_score']);

  const interoperabilityScore =
    getFirstAvailableValue(scorecard, ['interoperability_score']) ??
    getFirstAvailableValue(drugData, ['interoperability_score']);

  const benchmarkTier =
    String(
      getFirstAvailableValue(scorecard, ['benchmark_tier']) ||
        getFirstAvailableValue(drugData, ['benchmark_tier', 'tier']) ||
        scoreLabel(toScore(overallScore))
    );

  const atcDepth =
    Number(
      getFirstAvailableValue(drugData, ['atc_hierarchy_depth', 'classification_atc_max_depth', 'atc_depth'], null)
    ) ||
    ['ATC1', 'ATC2', 'ATC3', 'ATC4'].filter(
      (bucket) => getBucketItems(classifications, bucket).length > 0
    ).length;

  const totalClassifications =
    Number(
      getFirstAvailableValue(drugData, ['classification_count', 'total_classifications', 'classification_record_count'], null)
    ) ||
    [
      'ATC1',
      'ATC2',
      'ATC3',
      'ATC4',
      'MOA',
      'EPC',
      'DISEASE',
      'TC',
      'PE',
      'CHEM',
      'VA',
      'PK',
      'SCHEDULE',
      'DISPOS',
      'STRUCT',
      'CVX',
      'other',
    ].reduce((sum, bucket) => sum + getBucketItems(classifications, bucket).length, 0);

  const populatedDomains =
    Number(
      getFirstAvailableValue(drugData, ['class_type_count', 'classification_class_type_count'], null)
    ) ||
    [
      'ATC1',
      'ATC2',
      'ATC3',
      'ATC4',
      'MOA',
      'EPC',
      'DISEASE',
      'TC',
      'PE',
      'CHEM',
      'VA',
      'PK',
      'SCHEDULE',
      'DISPOS',
      'STRUCT',
      'CVX',
      'other',
    ].filter((bucket) => getBucketItems(classifications, bucket).length > 0).length;

  const diseaseCount =
    Number(getFirstAvailableValue(drugData, ['disease_count', 'classification_DISEASE_count'], null)) ||
    getClassificationCount(classifications, 'DISEASE');

  const relationshipTotal =
    Number(
      getFirstAvailableValue(drugData, ['relationship_count', 'relationship_count_for_scoring'], null)
    ) ||
    Number(graphMetrics.relationship_node_count) ||
    Number(relationshipCounts.raw_relationship_rows) ||
    Number(relationshipCounts.related_concepts) ||
    Number(relationshipCounts.ingredients) ||
    0;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-950 px-7 py-7 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">
              Medication Intelligence Scorecard
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">
              {String(displayName)}
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                RxCUI {String(rxcui)}
              </span>

              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                {String(termType)}
              </span>

              <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${getTierStyle(benchmarkTier)}`}>
                {benchmarkTier}
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
              {scoreLabel(toScore(overallScore))}
            </p>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreMetric label="Claims Readiness" value={claimsScore} />
          <ScoreMetric label="AI Readiness" value={aiScore} />
          <ScoreMetric label="Semantic Richness" value={semanticScore} />
          <ScoreMetric label="Interoperability" value={interoperabilityScore} />
        </div>
      </div>

      <div className="p-7">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-700">
              Knowledge Graph
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">
              Medication Intelligence Footprint
            </h3>
          </div>

          <p className="text-sm font-semibold text-slate-500">
            Consolidated classification, domain, disease, relationship, and ATC coverage.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KnowledgeMetric
            label="Classifications"
            value={totalClassifications}
            helper="Mapped evidence records"
          />

          <KnowledgeMetric
            label="Domains"
            value={populatedDomains}
            helper="Populated intelligence domains"
          />

          <KnowledgeMetric
            label="Disease Maps"
            value={diseaseCount}
            helper="Clinical interpretation signals"
          />

          <KnowledgeMetric
            label="Relationships"
            value={relationshipTotal}
            helper="RxNorm linked concepts"
          />

          <KnowledgeMetric
            label="ATC Depth"
            value={`${atcDepth}/4`}
            helper="Therapeutic hierarchy"
          />
        </div>
      </div>
    </section>
  );
}
