import { DrugCard, ClassificationBuckets, ClassificationItem } from '../lib/api';

type SimilarMedication = {
  rxcui?: string | number;
  drug_name?: string;
  similarity_badges?: string[];
  rxnorm_name?: string;
  name?: string;
  tty?: string;
  benchmark_tier?: string;
  similarity_score?: number;
  mechanism_similarity?: number;
  disease_similarity?: number;
  therapeutic_similarity?: number;
  classification_similarity?: number;
  overall_similarity?: number;
  similarity_tier?: string;
  similarity_reason_type?: string;
  similarity_explanation?: string;
  reason?: string;
  shared_attributes?: string[];
  shared_classes?: Array<{
    class_type?: string;
    class_id?: string;
    class_name?: string;
    weight?: number;
  }>;
};

function getBucketItems(
  classifications: ClassificationBuckets,
  bucket: string
): ClassificationItem[] {
  return (classifications[bucket] as ClassificationItem[]) || [];
}

function getPrimaryItem(items: ClassificationItem[]) {
  return items.find((item) => item.class_name) || items[0];
}

function getAllNames(classifications: ClassificationBuckets, bucket: string) {
  return getBucketItems(classifications, bucket)
    .map((item) => item.class_name || item.class_id)
    .filter(Boolean) as string[];
}

function getDrugDisplayName(drug: any) {
  return (
    drug?.rxnorm_name ||
    drug?.drug_name ||
    drug?.display_name ||
    drug?.name ||
    drug?.drug?.rxnorm_name ||
    drug?.drug?.drug_name ||
    'This medication'
  );
}

function getAtcStepMeta(bucket: string, stepName: string) {
  const normalizedName = stepName || 'this therapeutic class';

  if (bucket === 'ATC1') {
    return {
      stepNumber: 1,
      tag: 'Main Group',
      description: `The medication belongs to the ${normalizedName} therapeutic main group.`,
    };
  }

  if (bucket === 'ATC2') {
    return {
      stepNumber: 2,
      tag: 'Therapeutic Group',
      description: `Specifically categorized under ${normalizedName} therapeutic subgroup.`,
    };
  }

  if (bucket === 'ATC3') {
    return {
      stepNumber: 3,
      tag: 'Pharmacologic Subgroup',
      description: `Part of the ${normalizedName} category within the ATC hierarchy.`,
    };
  }

  return {
    stepNumber: 4,
    tag: 'Chemical Subgroup',
    description: `Final classification within the ${normalizedName} therapeutic sub-subgroup.`,
  };
}

function getOrdinalSuffix(value: number) {
  if (value === 1) return 'st';
  if (value === 2) return 'nd';
  if (value === 3) return 'rd';
  return 'th';
}

function formatScore(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${Math.round(numeric)}%`;
}

function getSimilarMedicationName(item: SimilarMedication | string) {
  if (typeof item === 'string') return item;

  return (
    item.drug_name ||
    item.rxnorm_name ||
    item.name ||
    (item.rxcui ? `RxCUI ${item.rxcui}` : 'Similar medication')
  );
}


function getPrimaryAtcPathway(classifications: any) {
  const buckets = classifications || {};

  const atc1 = buckets.ATC1 || buckets.atc1 || [];
  const atc2 = buckets.ATC2 || buckets.atc2 || [];
  const atc3 = buckets.ATC3 || buckets.atc3 || [];
  const atc4 = buckets.ATC4 || buckets.atc4 || [];

  const preferredAtc4 =
    atc4.find((item: any) => String(item.class_id || item.code || '').startsWith('M01AE')) ||
    atc4.find((item: any) => String(item.class_id || item.code || '').startsWith('M01A')) ||
    atc4.find((item: any) => String(item.class_id || item.code || '').startsWith('M01')) ||
    atc4[0];

  const atc4Code = String(preferredAtc4?.class_id || preferredAtc4?.code || '');

  const atc3Code = atc4Code.slice(0, 4);
  const atc2Code = atc4Code.slice(0, 3);
  const atc1Code = atc4Code.slice(0, 1);

  const selectedAtc3 =
    atc3.find((item: any) => String(item.class_id || item.code || '') === atc3Code) ||
    atc3[0];

  const selectedAtc2 =
    atc2.find((item: any) => String(item.class_id || item.code || '') === atc2Code) ||
    atc2[0];

  const selectedAtc1 =
    atc1.find((item: any) => String(item.class_id || item.code || '') === atc1Code) ||
    atc1[0];

  return {
    atc1: selectedAtc1,
    atc2: selectedAtc2,
    atc3: selectedAtc3,
    atc4: preferredAtc4,
  };
}


function SimilarityScoreRow({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
          {label}
        </p>
        <p className="text-xs font-black text-white">{formatScore(value)}</p>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function SimilarityRadarChart({ item }: { item: SimilarMedication }) {
  const scores = [
    {
      label: 'Mechanism',
      value: Number(item.mechanism_similarity || 0),
      x: 100,
      y: 18,
    },
    {
      label: 'Therapeutic',
      value: Number(item.therapeutic_similarity || 0),
      x: 182,
      y: 100,
    },
    {
      label: 'Classification',
      value: Number(item.classification_similarity || 0),
      x: 100,
      y: 182,
    },
    {
      label: 'Disease',
      value: Number(item.disease_similarity || 0),
      x: 18,
      y: 100,
    },
  ];

  const center = { x: 100, y: 100 };

  const points = scores
    .map((score) => {
      const ratio = Math.max(0, Math.min(100, score.value)) / 100;
      const x = center.x + (score.x - center.x) * ratio;
      const y = center.y + (score.y - center.y) * ratio;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="mx-auto w-full max-w-[15rem]">
          <svg viewBox="0 0 200 200" className="h-56 w-full">
            <polygon
              points="100,18 182,100 100,182 18,100"
              fill="none"
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="1"
            />
            <polygon
              points="100,45 155,100 100,155 45,100"
              fill="none"
              stroke="rgba(148,163,184,0.22)"
              strokeWidth="1"
            />
            <polygon
              points="100,72 128,100 100,128 72,100"
              fill="none"
              stroke="rgba(148,163,184,0.18)"
              strokeWidth="1"
            />

            <line x1="100" y1="18" x2="100" y2="182" stroke="rgba(148,163,184,0.22)" />
            <line x1="18" y1="100" x2="182" y2="100" stroke="rgba(148,163,184,0.22)" />

            <polygon
              points={points}
              fill="rgba(34,211,238,0.22)"
              stroke="rgba(34,211,238,0.95)"
              strokeWidth="3"
            />

            {scores.map((score) => (
              <circle
                key={score.label}
                cx={center.x + (score.x - center.x) * (Math.max(0, Math.min(100, score.value)) / 100)}
                cy={center.y + (score.y - center.y) * (Math.max(0, Math.min(100, score.value)) / 100)}
                r="4"
                fill="white"
              />
            ))}

            <text x="100" y="10" textAnchor="middle" className="fill-cyan-100 text-[9px] font-black">
              Mechanism
            </text>
            <text x="190" y="103" textAnchor="end" className="fill-cyan-100 text-[9px] font-black">
              Therapeutic
            </text>
            <text x="100" y="197" textAnchor="middle" className="fill-cyan-100 text-[9px] font-black">
              Classification
            </text>
            <text x="10" y="103" textAnchor="start" className="fill-cyan-100 text-[9px] font-black">
              Disease
            </text>
          </svg>
        </div>

        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            Similarity Radar
          </p>

          <p className="mt-2 text-sm font-medium leading-6 text-slate-300">
            Radar shape shows why this medication is similar across pharmacology, disease,
            therapeutic hierarchy, and classification evidence.
          </p>
        </div>
      </div>
    </div>
  );
}

function SimilarMedicationCard({
  item,
  onSelectSimilarDrug,
}: {
  item: SimilarMedication;
  onSelectSimilarDrug?: (drug: SimilarMedication) => void;
}) {
  const sharedClasses = Array.isArray(item.shared_classes) ? item.shared_classes : [];
  const sharedLabels = sharedClasses
    .map((shared) => shared.class_name || shared.class_id || shared.class_type)
    .filter(Boolean)
    .slice(0, 5);

  return (
    <button
      type="button"
      onClick={() => onSelectSimilarDrug?.(item)}
      className="w-full rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-5 text-left shadow-inner shadow-slate-950/50 transition hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-slate-950/90"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            Similar Medication
          </p>

          <h4 className="mt-2 text-2xl font-black leading-tight text-white">
            {getSimilarMedicationName(item)}
          </h4>

          <div className="mt-3 flex flex-wrap gap-2">
            {item.similarity_tier && (
              <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-100">
                {item.similarity_tier}
              </span>
            )}

            {item.tty && (
              <span className="rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-[11px] font-black text-blue-100">
                {item.tty}
              </span>
            )}

            {item.benchmark_tier && (
              <span className="rounded-full border border-purple-300/20 bg-purple-500/10 px-3 py-1 text-[11px] font-black text-purple-100">
                {item.benchmark_tier}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-5 py-4 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
            Overall
          </p>
          <p className="mt-1 text-3xl font-black text-white">
            {formatScore(item.overall_similarity ?? item.similarity_score)}
          </p>
        </div>
      </div>

      <SimilarityRadarChart item={item} />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SimilarityScoreRow label="Mechanism" value={item.mechanism_similarity} />
        <SimilarityScoreRow label="Disease" value={item.disease_similarity} />
        <SimilarityScoreRow label="Therapeutic" value={item.therapeutic_similarity} />
        <SimilarityScoreRow label="Classification" value={item.classification_similarity} />
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          Shared Classes
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {(sharedLabels.length > 0 ? sharedLabels : ['No shared class labels available']).map(
            (label) => (
              <span
                key={label}
                className="rounded-full border border-slate-600/60 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-200"
              >
                {label}
              </span>
            )
          )}
        </div>
      </div>
    {(item.similarity_reason_type || item.similarity_explanation || item.reason) && (
      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/65 p-4">
        {item.similarity_reason_type && (
          <p className="text-sm font-black text-white">
            {item.similarity_reason_type}
          </p>
        )}

        {item.similarity_explanation && (
          <p className="mt-2 text-sm font-medium leading-6 text-slate-200">
            {item.similarity_explanation}
          </p>
        )}

        {item.reason && (
          <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
            {item.reason}
          </p>
        )}
      </div>
    )}
  </button>
  );
  }
    
function SimilarMedicationIntelligenceCards({
  medications,
  onSelectSimilarDrug,
}: {
  medications: Array<SimilarMedication | string>;
  onSelectSimilarDrug?: (drug: SimilarMedication) => void;
}) {
  const normalized = medications.filter(
    (item): item is SimilarMedication =>
      typeof item === 'object' && item !== null
  );

  if (normalized.length === 0) {
    return (
      <div className="rounded-3xl border border-blue-300/20 bg-blue-500/10 p-5 text-sm font-bold text-blue-100">
        Related medications will populate from the weighted medication similarity engine when available.
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {normalized.slice(0, 10).map((item, index) => (
        <SimilarMedicationCard
        key={`${item.rxcui || item.drug_name || item.rxnorm_name || index}`}
        item={item}
        onSelectSimilarDrug={onSelectSimilarDrug}
        />
      ))}
    </div>
  );
}

function AtcTimelineStep({
  step,
  isLast,
}: {
  step: {
    bucket: string;
    name: string;
    code: string;
    stepNumber: number;
    tag: string;
    description: string;
  };
  isLast: boolean;
}) {
  return (
    <div className="relative flex min-w-[17rem] flex-1 flex-col rounded-3xl border border-white/10 bg-slate-900/45 p-5 shadow-sm shadow-slate-950/40 backdrop-blur transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-slate-900/70">
      {!isLast && (
        <div className="absolute left-[calc(100%-0.25rem)] top-10 hidden h-0.5 w-10 bg-gradient-to-r from-blue-500 to-cyan-400 xl:block" />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-xl font-black text-white shadow-lg shadow-blue-950/40">
          {step.stepNumber}
        </div>

        <span className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-blue-200">
          {step.tag}
        </span>
      </div>

      <div className="mt-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
          {step.bucket} · {step.code}
        </p>

        <h4 className="mt-3 text-xl font-black leading-tight text-white">
          {step.name}
        </h4>

        <p className="mt-4 text-sm font-medium leading-6 text-slate-300">
          {step.description}
        </p>
      </div>
    </div>
  );
}

function IntelligenceInsightCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 shadow-inner shadow-slate-950/40">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
        {eyebrow}
      </p>
      <h4 className="mt-2 text-xl font-black text-white">{title}</h4>
      <div className="mt-4 text-sm font-medium leading-7 text-slate-300">
        {children}
      </div>
    </div>
  );
}

function ClaimsReadinessChecklist({ claimsReadiness }: { claimsReadiness: any }) {
  const layers = claimsReadiness?.available_layers || {};

  const items = [
    { label: 'RxNorm', value: layers.rxnorm },
    { label: 'ATC', value: layers.atc },
    { label: 'Disease', value: layers.disease },
    { label: 'Mechanism', value: layers.mechanism },
    { label: 'NDC', value: layers.ndc },
    { label: 'ICD10', value: layers.icd10 },
    { label: 'HCPCS', value: layers.hcpcs },
    { label: 'DRG', value: layers.drg || layers.drgs },
    { label: 'Revenue Codes', value: layers.revenue_codes },
  ];

  return (
    <div className="mt-4 grid gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-slate-300">{item.label}</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-black ${
              item.value
                ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-300/25'
                : 'bg-slate-800/70 text-slate-400 border border-slate-600/40'
            }`}
          >
            {item.value ? '✓ Available' : '○ Missing'}
          </span>
        </div>
      ))}
    </div>
  );
}

function TherapeuticIntelligenceLayer({
  drug,
  classifications,
  pathway,
  onSelectSimilarDrug,
}: {
  drug: any;
  classifications: ClassificationBuckets;
  pathway: Array<{
    bucket: string;
    name: string;
    code: string;
    stepNumber: number;
    tag: string;
    description: string;
  }>;
  onSelectSimilarDrug?: (drug: SimilarMedication) => void;
}) {
  const displayName = getDrugDisplayName(drug);
  const atcDepth = pathway.length;

  const executiveSummary = drug?.medication_intelligence_summary || {};
  const therapeuticNarrative = drug?.therapeutic_narrative || {};
  const graphIntelligence = drug?.graph_intelligence || {};
  const claimsReadiness = drug?.claims_readiness_layer || {};

  const hasDrg = claimsReadiness?.available_layers?.drg || claimsReadiness?.available_layers?.drgs || false;

  const totalClassifications = Object.entries(classifications).reduce(
    (sum, [key, value]) =>
      key === 'counts' ? sum : sum + (Array.isArray(value) ? value.length : 0),
    0
  );

  const classTypeCount = Object.entries(classifications).filter(
    ([key, value]) => key !== 'counts' && Array.isArray(value) && value.length > 0
  ).length;

  const clinicalSignals = [
    ...getAllNames(classifications, 'DISEASE'),
    ...getAllNames(classifications, 'MOA'),
    ...getAllNames(classifications, 'EPC'),
    ...getAllNames(classifications, 'PE'),
    ...getAllNames(classifications, 'VA'),
  ].slice(0, 5);

  const atc1 =
    executiveSummary?.primary_therapeutic_domain ||
    pathway?.[0]?.name ||
    'its primary therapeutic domain';

  const atc4 =
    pathway?.[3]?.name ||
    pathway?.[pathway.length - 1]?.name ||
    'its most specific available ATC classification';

  const primaryMechanism =
    executiveSummary?.primary_mechanism || 'Mechanism evidence not yet populated';

  const primaryDiseaseFocus =
    executiveSummary?.primary_disease_focus || 'Disease focus not yet populated';

  const primaryPharmacologicClass =
    executiveSummary?.primary_pharmacologic_class || 'Pharmacologic class not yet populated';

  const classificationBreadth =
    executiveSummary?.classification_breadth ?? totalClassifications;

  const populatedDomains =
    executiveSummary?.populated_intelligence_domains ?? classTypeCount;

  const claimsReadinessScore =
    claimsReadiness?.claims_readiness_score ?? '—';

  const claimsReadinessTier =
    claimsReadiness?.claims_readiness_tier || 'Foundational';

  const relatedMedications =
    (drug?.similar_medications as Array<SimilarMedication | string> | undefined) ||
    (drug?.related_medications as Array<SimilarMedication | string> | undefined) ||
    [];

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="xl:col-span-3 rounded-[2rem] border border-cyan-300/25 bg-[linear-gradient(135deg,_rgba(14,165,233,0.16),_rgba(15,23,42,0.82))] p-6 shadow-[0_0_28px_rgba(14,165,233,0.18)]">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
          Therapeutic Intelligence Summary
        </p>

        <p className="mt-3 text-base font-semibold leading-8 text-slate-200">
          {therapeuticNarrative?.narrative ||
            `${displayName} demonstrates a ${
              atcDepth === 4 ? 'fully classified' : 'partially classified'
            } ATC hierarchy (${atcDepth}/4 levels) with ${totalClassifications} total classification mappings across ${classTypeCount} populated intelligence domains.`}
        </p>
      </div>

      <div className="xl:col-span-3 grid gap-4 md:grid-cols-4">
        <IntelligenceInsightCard eyebrow="Domain" title="Primary Therapeutic Domain">
          {atc1}
        </IntelligenceInsightCard>

        <IntelligenceInsightCard eyebrow="Mechanism" title="Primary Mechanism">
          {primaryMechanism}
        </IntelligenceInsightCard>

        <IntelligenceInsightCard eyebrow="Disease Focus" title="Primary Disease Focus">
          <p>{executiveSummary?.primary_disease_focus || 'Disease focus not yet populated'}</p>
        </IntelligenceInsightCard>

        <IntelligenceInsightCard eyebrow="Claims Readiness" title="Operational Readiness">
          <div>
            <p className="text-base font-black text-white">
              {claimsReadinessTier} · {claimsReadinessScore}%
            </p>
            <ClaimsReadinessChecklist claimsReadiness={claimsReadiness} />
          </div>
        </IntelligenceInsightCard>
      </div>

      <div className="xl:col-span-3 grid gap-4 md:grid-cols-4">
        <IntelligenceInsightCard eyebrow="Graph" title="Most Connected Domain">
          {graphIntelligence?.most_connected_domain?.label || 'Not available'}
        </IntelligenceInsightCard>

        <IntelligenceInsightCard eyebrow="Graph" title="Most Connected Disease">
          {graphIntelligence?.most_connected_disease?.label || 'Not available'}
        </IntelligenceInsightCard>

        <IntelligenceInsightCard eyebrow="Graph" title="Most Connected Mechanism">
          {graphIntelligence?.most_connected_mechanism?.label || 'Not available'}
        </IntelligenceInsightCard>

        <IntelligenceInsightCard eyebrow="Graph" title="Most Connected Therapeutic Class">
          {graphIntelligence?.most_connected_therapeutic_class?.label || 'Not available'}
        </IntelligenceInsightCard>
      </div>

      <IntelligenceInsightCard eyebrow="Narrative" title="Therapeutic Path Narrative">
        {therapeuticNarrative?.narrative || (
          <>
            {displayName} is classified within the{' '}
            <span className="font-black text-white">{atc1}</span> therapeutic domain and
            ultimately maps to <span className="font-black text-white">{atc4}</span> at the
            most specific available ATC level. This pathway helps translate raw
            classification data into clinical, claims, and AI-ready medication intelligence.
          </>
        )}
      </IntelligenceInsightCard>

      <IntelligenceInsightCard eyebrow="Executive Summary" title="Medication Intelligence">
        <div className="space-y-3">
          <p>
            <span className="font-black text-white">Classification Breadth:</span>{' '}
            {classificationBreadth} mappings
          </p>
          <p>
            <span className="font-black text-white">Populated Domains:</span>{' '}
            {populatedDomains}
          </p>
          <p>
            <span className="font-black text-white">Primary Pharmacologic Class:</span>{' '}
            {primaryPharmacologicClass}
          </p>
        </div>
      </IntelligenceInsightCard>

      <IntelligenceInsightCard eyebrow="Clinical" title="Top Clinical Signals">
        <div className="flex flex-wrap gap-2">
          {(clinicalSignals.length > 0 ? clinicalSignals : ['No clinical signals available']).map(
            (item) => (
              <span
                key={item}
                className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-100"
              >
                {item}
              </span>
            )
          )}
        </div>
      </IntelligenceInsightCard>

      <div className="xl:col-span-3 rounded-[2rem] border border-cyan-300/20 bg-slate-950/45 p-6 shadow-[0_0_24px_rgba(14,165,233,0.12)]">
        <div className="mb-5">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
            Similar Medication Intelligence
          </p>
          <h3 className="mt-2 text-2xl font-black text-white">
            Weighted Similarity Matches
          </h3>
          <p className="mt-2 max-w-4xl text-sm font-medium leading-6 text-slate-300">
            Each card explains why another medication is similar using overall, mechanism,
            disease, therapeutic, and classification similarity domains.
          </p>
        </div>

        <SimilarMedicationIntelligenceCards
          medications={relatedMedications}
          onSelectSimilarDrug={onSelectSimilarDrug}
        />
      </div>
    </div>
  );
}

function TherapeuticPathway({
  drug,
  classifications,
  onSelectSimilarDrug,
}: {
  drug: any;
  classifications: ClassificationBuckets;
  onSelectSimilarDrug?: (drug: any) => void;
}) {
  function buildFallbackAtcPathway(classifications: ClassificationBuckets) {
    const atc1Rows = getBucketItems(classifications, 'ATC1');
    const atc2Rows = getBucketItems(classifications, 'ATC2');
    const atc3Rows = getBucketItems(classifications, 'ATC3');
    const atc4Rows = getBucketItems(classifications, 'ATC4');

    if (!atc4Rows.length) return [];

    const preferredAtc4 =
      atc4Rows.find((x) => x.class_id?.startsWith('M01AE')) ||
      atc4Rows.find((x) => x.class_id?.startsWith('M01A')) ||
      atc4Rows.find((x) => x.class_id?.startsWith('M01')) ||
      atc4Rows[0];

    const atc4Code = preferredAtc4?.class_id || '';
    const atc3Code = atc4Code.substring(0, 4);
    const atc2Code = atc4Code.substring(0, 3);
    const atc1Code = atc4Code.substring(0, 1);

    const pathwayRows = [
      atc1Rows.find((x) => x.class_id === atc1Code),
      atc2Rows.find((x) => x.class_id === atc2Code),
      atc3Rows.find((x) => x.class_id === atc3Code),
      preferredAtc4,
    ].filter(Boolean) as ClassificationItem[];

    return pathwayRows.map((item) => {
      const bucket = item.class_type || 'ATC';
      const name =
        item.class_name ||
        (item as any).atc_full_name ||
        item.class_id ||
        'Unknown Classification';

      const meta = getAtcStepMeta(bucket, name);

      return {
        bucket,
        name,
        code: item.class_id || '--',
        ...meta,
      };
    });
  }

  console.log(
    'PRIMARY THERAPEUTIC PATHWAY',
    drug?.primary_therapeutic_pathway
  );

  const backendPathway = (drug as any)?.primary_therapeutic_pathway?.pathway;

  const pathway =
    Array.isArray(backendPathway) && backendPathway.length > 0
      ? backendPathway.map((item: any) => {
          const bucket = item?.class_type || 'ATC';
          const name =
            item?.class_name ||
            item?.atc_full_name ||
            item?.class_id ||
            'Unknown Classification';

          const meta = getAtcStepMeta(bucket, name);

          return {
            bucket,
            name,
            code: item?.class_id || '--',
            ...meta,
          };
        })
      : buildFallbackAtcPathway(classifications);

  const atcDepth = pathway.length;
  const isComplete = atcDepth === 4;

  if (pathway.length === 0) {
    return (
      <section className="overflow-hidden rounded-[2rem] border border-white/20 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.20),_transparent_34%),linear-gradient(135deg,#020617,#07152d_48%,#020617)] p-7 text-white shadow-2xl shadow-slate-950/40">
        <div>
          <h3 className="text-2xl font-black tracking-tight text-white">
            Therapeutic Pathway
          </h3>
          <p className="mt-2 text-sm font-semibold text-blue-300">
            ATC hierarchy is not populated for this medication.
          </p>
        </div>

        <div className="mt-6 rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-amber-100">
          <p className="text-sm font-bold">
            ATC hierarchy data is unavailable for this medication profile.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <TherapeuticIntelligenceLayer
        drug={drug}
        classifications={classifications}
        pathway={pathway}
        onSelectSimilarDrug={onSelectSimilarDrug}
      />

      <div className="overflow-hidden rounded-[2rem] border border-white/20 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.20),_transparent_34%),linear-gradient(135deg,#020617,#07152d_48%,#020617)] p-7 text-white shadow-2xl shadow-slate-950/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-400">
              Classification Pathway
            </p>

            <h3 className="mt-2 text-3xl font-black tracking-tight text-white">
              Therapeutic Pathway
            </h3>

            <p className="mt-2 text-base font-semibold text-blue-200">
              Connected ATC hierarchy showing the medication&apos;s therapeutic position.
            </p>
          </div>

          <div
            className={`inline-flex w-fit items-center gap-3 rounded-2xl border px-5 py-3 text-sm font-black uppercase tracking-wide shadow-sm ${
              isComplete
                ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-200 shadow-emerald-950/20'
                : 'border-amber-300/40 bg-amber-500/15 text-amber-200 shadow-amber-950/20'
            }`}
          >
            <span>{isComplete ? '✓' : '!'}</span>
            <span>{isComplete ? 'ATC Hierarchy Complete' : 'ATC Hierarchy Partial'}</span>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto pb-2">
          <div className="flex min-w-full gap-6 xl:overflow-visible">
            {pathway.map((step, index) => (
              <AtcTimelineStep
                key={`${step.bucket}-${step.code}`}
                step={step}
                isLast={index === pathway.length - 1}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-blue-950/40 p-5 shadow-inner shadow-slate-950/30 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-2xl text-blue-300">
              ⎇
            </div>

            <div>
              <h4 className="text-xl font-black text-white">
                {isComplete ? 'ATC Hierarchy Complete' : 'ATC Hierarchy Partially Populated'}
              </h4>

              <p className="mt-1 text-sm font-medium leading-6 text-slate-300">
                This medication is classified at the {atcDepth}
                {getOrdinalSuffix(atcDepth)} level of the ATC hierarchy, providing{' '}
                {isComplete ? 'detailed' : 'partial'} therapeutic positioning.
              </p>
            </div>
          </div>

          <div
            className={`inline-flex w-fit items-center gap-2 rounded-2xl border px-5 py-3 text-lg font-black ${
              isComplete
                ? 'border-emerald-300/40 bg-emerald-500/15 text-emerald-200'
                : 'border-amber-300/40 bg-amber-500/15 text-amber-200'
            }`}
          >
            <span>{isComplete ? '✓' : '!'}</span>
            <span>{atcDepth}/4 Levels</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ClassificationPanel({
  drug,
  onSelectSimilarDrug,
}: {
  drug: (DrugCard & { classifications?: ClassificationBuckets }) | null;
  onSelectSimilarDrug?: (drug: any) => void;
}) {
  const classifications = drug?.classifications || {};

  return (
    <TherapeuticPathway
      drug={drug}
      classifications={classifications}
      onSelectSimilarDrug={onSelectSimilarDrug}
    />
  );
}