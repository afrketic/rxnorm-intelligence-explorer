import { DrugCard } from '../lib/api';

type ExecutiveMedicationSummaryProps = {
  drug: (DrugCard & {
    classifications?: Record<string, any[]>;
    relationships?: any;
    graph?: any;
    graph_metrics?: Record<string, any>;
    scorecard?: Record<string, any>;
    [key: string]: any;
  }) | null;
};

const CLASSIFICATION_BUCKETS = [
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
];

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function formatPercent(value: unknown) {
  const parsed = asNumber(value);
  if (parsed === null) return '—';

  return `${Math.round(parsed)}%`;
}

function formatScore(value: unknown) {
  const parsed = asNumber(value);
  if (parsed === null) return '—';

  return parsed.toFixed(2).replace(/\.00$/, '');
}

function maturityLabel(value: unknown) {
  const parsed = asNumber(value);

  if (parsed === null) return 'not yet scored';
  if (parsed >= 90) return 'enterprise-ready';
  if (parsed >= 75) return 'strong';
  if (parsed >= 50) return 'developing';
  if (parsed >= 25) return 'limited';
  return 'foundational';
}

function getDrugName(drug: NonNullable<ExecutiveMedicationSummaryProps['drug']>) {
  return (
    drug.display_name ||
    drug.rxnorm_name ||
    drug.drug_name ||
    drug.name ||
    drug.drug?.rxnorm_name ||
    drug.drug?.drug_name ||
    'This medication'
  );
}

function getTier(drug: NonNullable<ExecutiveMedicationSummaryProps['drug']>) {
  return (
    drug.benchmark_tier ||
    drug.tier ||
    drug.scorecard?.benchmark_tier ||
    drug.drug?.benchmark_tier ||
    'Unclassified'
  );
}

function getClassifications(drug: NonNullable<ExecutiveMedicationSummaryProps['drug']>) {
  return (
    drug.classifications ||
    drug.drug?.classifications ||
    drug.classification_payload ||
    {}
  );
}

function getBucketCount(classifications: Record<string, any>, bucket: string) {
  const items =
    classifications[bucket] ||
    classifications[bucket.toLowerCase()] ||
    classifications[bucket.toUpperCase()] ||
    [];

  return Array.isArray(items) ? items.length : 0;
}

function getTotalClassifications(drug: NonNullable<ExecutiveMedicationSummaryProps['drug']>) {
  const explicit =
    asNumber(drug.classification_count) ??
    asNumber(drug.total_classifications) ??
    asNumber(drug.classification_record_count) ??
    asNumber(drug.classification_count_for_scoring) ??
    asNumber(drug.drug?.classification_count) ??
    asNumber(drug.drug?.classification_record_count);

  if (explicit !== null) return explicit;

  const classifications = getClassifications(drug);

  return CLASSIFICATION_BUCKETS.reduce(
    (sum, bucket) => sum + getBucketCount(classifications, bucket),
    0
  );
}

function getAtcDepth(drug: NonNullable<ExecutiveMedicationSummaryProps['drug']>) {
  const explicit =
    asNumber(drug.atc_hierarchy_depth) ??
    asNumber(drug.atc_depth) ??
    asNumber(drug.classification_atc_max_depth) ??
    asNumber(drug.drug?.atc_hierarchy_depth) ??
    asNumber(drug.drug?.classification_atc_max_depth);

  if (explicit !== null) return explicit;

  const classifications = getClassifications(drug);

  return ['ATC1', 'ATC2', 'ATC3', 'ATC4'].filter(
    (bucket) => getBucketCount(classifications, bucket) > 0
  ).length;
}

function getDomainCount(drug: NonNullable<ExecutiveMedicationSummaryProps['drug']>) {
  const explicit =
    asNumber(drug.class_type_count) ??
    asNumber(drug.class_type_count_for_scoring) ??
    asNumber(drug.classification_class_type_count) ??
    asNumber(drug.drug?.class_type_count) ??
    asNumber(drug.drug?.classification_class_type_count);

  if (explicit !== null) return explicit;

  const classifications = getClassifications(drug);

  return CLASSIFICATION_BUCKETS.filter(
    (bucket) => getBucketCount(classifications, bucket) > 0
  ).length;
}

function getDiseaseCount(drug: NonNullable<ExecutiveMedicationSummaryProps['drug']>) {
  const explicit =
    asNumber(drug.disease_count) ??
    asNumber(drug.classification_DISEASE_count) ??
    asNumber(drug.drug?.disease_count) ??
    asNumber(drug.drug?.classification_DISEASE_count);

  if (explicit !== null) return explicit;

  return getBucketCount(getClassifications(drug), 'DISEASE');
}

function getNdcCount(drug: NonNullable<ExecutiveMedicationSummaryProps['drug']>) {
  return (
    asNumber(drug.ndc_record_count) ??
    asNumber(drug.ndc_count) ??
    asNumber(drug.package_count) ??
    asNumber(drug.drug?.ndc_record_count) ??
    asNumber(drug.drug?.ndc_count)
  );
}

function getGraphConnectivity(drug: NonNullable<ExecutiveMedicationSummaryProps['drug']>) {
  return (
    asNumber(drug.graph_connectivity_score) ??
    asNumber(drug.graph_metrics?.graph_connectivity_score) ??
    asNumber(drug.graph_metrics?.connectivity_score) ??
    asNumber(drug.relationship_density_score) ??
    asNumber(drug.drug?.relationship_density_score)
  );
}

function buildExecutiveSummary(drug: NonNullable<ExecutiveMedicationSummaryProps['drug']>) {
  const name = getDrugName(drug);
  const tier = getTier(drug);
  const overall =
    drug.overall_intelligence_score ??
    drug.scorecard?.overall_intelligence_score ??
    drug.drug?.overall_intelligence_score;
  const claims =
    drug.claims_readiness_score ??
    drug.scorecard?.claims_readiness_score ??
    drug.drug?.claims_readiness_score;
  const ai =
    drug.ai_readiness_score ??
    drug.scorecard?.ai_readiness_score ??
    drug.drug?.ai_readiness_score;
  const semantic =
    drug.semantic_richness_score ??
    drug.scorecard?.semantic_richness_score ??
    drug.drug?.semantic_richness_score;
  const interoperability =
    drug.interoperability_score ??
    drug.scorecard?.interoperability_score ??
    drug.drug?.interoperability_score;

  const totalClassifications = getTotalClassifications(drug);
  const domainCount = getDomainCount(drug);
  const atcDepth = getAtcDepth(drug);
  const diseaseCount = getDiseaseCount(drug);
  const ndcCount = getNdcCount(drug);
  const graphConnectivity = getGraphConnectivity(drug);

  const graphPhrase =
    graphConnectivity !== null
      ? `, with graph connectivity at ${formatPercent(graphConnectivity)}`
      : '';

  const ndcPhrase =
    ndcCount !== null
      ? `${ndcCount} package or claims-mapping record${ndcCount === 1 ? '' : 's'}`
      : 'available package identifier coverage';

  return [
    `${name} demonstrates ${tier}-tier medication intelligence maturity with an overall intelligence score of ${formatScore(overall)}, placing it in the ${maturityLabel(overall)} range for the RxNorm Intelligence Explorer.`,
    `Its claims readiness (${formatPercent(claims)}), AI readiness (${formatPercent(ai)}), semantic richness (${formatPercent(semantic)}), and interoperability profile (${formatPercent(interoperability)}) summarize its ability to support claims analytics, standardized reporting, explainability, and downstream AI workflows.`,
    `The classification layer contains ${totalClassifications} mapped records across ${domainCount} populated intelligence domains, including a ${atcDepth}/4 ATC hierarchy and ${diseaseCount} disease association mapping${diseaseCount === 1 ? '' : 's'}.`,
    `The therapeutic pathway translates the ATC hierarchy into an executive-readable clinical positioning view, connecting the medication from broad therapeutic group through more specific pharmacologic and chemical subgroup context.`,
    `The knowledge graph and relationship layers show how RxNorm concepts, classifications, and related metadata connect into a broader medication intelligence footprint${graphPhrase}.`,
    `NDC intelligence currently reflects ${ndcPhrase} to support pharmacy claims crosswalks, operational reporting, and production analytics readiness.`,
    `Together, these signals position ${name} as a structured medication intelligence asset for enterprise dashboards, clinical-semantic interpretation, claims-readiness evaluation, and publication-quality validation workflows.`,
  ].join(' ');
}

export default function ExecutiveMedicationSummary({
  drug,
}: ExecutiveMedicationSummaryProps) {
  if (!drug) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-600">
            Executive Summary
          </p>

          <h3 className="mt-2 text-2xl font-black text-slate-950">
            Medication Intelligence Executive Brief
          </h3>
        </div>

        <div className="flex w-fit flex-wrap gap-2">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
            {getTier(drug)}
          </span>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
            {getAtcDepth(drug)}/4 ATC
          </span>

          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black text-slate-700">
            {getTotalClassifications(drug)} classifications
          </span>
        </div>
      </div>

      <p className="mt-5 text-base font-medium leading-8 text-slate-700">
        {buildExecutiveSummary(drug)}
      </p>
    </section>
  );
}
