import { DrugCard, ClassificationBuckets, ClassificationItem } from '../lib/api';

type SimilarMedication = {
  rxcui?: string | number;
  drug_name?: string;
  rxnorm_name?: string;
  name?: string;
  tty?: string;
  similarity_score?: number;
  overall_similarity?: number;
  mechanism_similarity?: number;
  disease_similarity?: number;
  therapeutic_similarity?: number;
  classification_similarity?: number;
  similarity_tier?: string;
  similarity_reason_type?: string;
  similarity_explanation?: string;
  reason?: string;
  shared_classes?: Array<{
    class_type?: string;
    class_id?: string;
    class_name?: string;
  }>;
};

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
  onSelectSimilarDrug?: (drug: DrugCard) => void;
};

const ATC_BUCKETS = ['ATC1', 'ATC2', 'ATC3', 'ATC4'] as const;
const CLINICAL_BUCKETS = ['DISEASE', 'MOA', 'PE', 'EPC'] as const;

function getBucketItems(
  classifications: ClassificationBuckets | undefined,
  bucket: string
): ClassificationItem[] {
  const value = (classifications || {})[bucket] || (classifications || {})[bucket.toLowerCase()];
  return Array.isArray(value) ? (value as ClassificationItem[]) : [];
}

function getDisplayName(drug: any) {
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

function getPrimaryName(items: ClassificationItem[], fallback = 'Not available') {
  return (
    items.find((item) => item.class_name)?.class_name ||
    items.find((item) => item.class_id)?.class_id ||
    fallback
  );
}

function getClassNames(items: ClassificationItem[], limit = 8) {
  return items
    .map((item) => item.class_name || item.class_id)
    .filter(Boolean)
    .slice(0, limit) as string[];
}

function getAtcMeta(bucket: string) {
  if (bucket === 'ATC1') return { step: 1, label: 'Main Group' };
  if (bucket === 'ATC2') return { step: 2, label: 'Therapeutic Group' };
  if (bucket === 'ATC3') return { step: 3, label: 'Pharmacologic Subgroup' };
  return { step: 4, label: 'Chemical Subgroup' };
}

function buildAtcPathway(classifications: ClassificationBuckets | undefined) {
  const buckets = classifications || {};
  const atc4Rows = getBucketItems(buckets, 'ATC4');
  const preferredAtc4 = atc4Rows[0];
  const atc4Code = preferredAtc4?.class_id || '';

  const exactByBucket = ATC_BUCKETS.map((bucket) => {
    const rows = getBucketItems(buckets, bucket);
    if (bucket === 'ATC1') {
      const code = atc4Code.slice(0, 1);
      return rows.find((item) => item.class_id === code) || rows[0];
    }
    if (bucket === 'ATC2') {
      const code = atc4Code.slice(0, 3);
      return rows.find((item) => item.class_id === code) || rows[0];
    }
    if (bucket === 'ATC3') {
      const code = atc4Code.slice(0, 4);
      return rows.find((item) => item.class_id === code) || rows[0];
    }
    return preferredAtc4 || rows[0];
  });

  return exactByBucket
    .map((item, index) => {
      const bucket = ATC_BUCKETS[index];
      const meta = getAtcMeta(bucket);
      return {
        bucket,
        code: item?.class_id || '--',
        name: item?.class_name || item?.class_id || 'Not populated',
        populated: Boolean(item?.class_name || item?.class_id),
        ...meta,
      };
    });
}

function getRelationshipCount(drug: any) {
  const relationships = drug?.relationships || {};
  const counts = relationships?.counts || {};
  const direct = Number(
    counts.raw_relationship_rows ||
      counts.related_concepts ||
      counts.ingredients ||
      counts.tradenames ||
      counts.dose_forms ||
      0
  );

  if (Number.isFinite(direct) && direct > 0) return direct;

  return ['ingredients', 'tradenames', 'dose_forms', 'related_concepts'].reduce(
    (sum, key) => sum + (Array.isArray(relationships[key]) ? relationships[key].length : 0),
    0
  );
}

function getSimilarMedications(drug: any): SimilarMedication[] {
  const source = drug?.similar_medications || drug?.related_medications || [];
  return Array.isArray(source)
    ? source.filter((item): item is SimilarMedication => typeof item === 'object' && item !== null)
    : [];
}

function getSimilarityName(item: SimilarMedication) {
  return item.drug_name || item.rxnorm_name || item.name || (item.rxcui ? `RxCUI ${item.rxcui}` : 'Similar medication');
}

function asPercent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${Math.round(numeric)}%`;
}

function scoreTier(score: number) {
  if (score >= 90) return 'Clinical Intelligence Ready';
  if (score >= 75) return 'Strong Clinical Coverage';
  if (score >= 55) return 'Developing Clinical Coverage';
  return 'Foundational Clinical Coverage';
}

function calculateClinicalReadiness({
  atcDepth,
  diseaseCount,
  moaCount,
  epcCount,
  peCount,
  similarCount,
  relationshipCount,
}: {
  atcDepth: number;
  diseaseCount: number;
  moaCount: number;
  epcCount: number;
  peCount: number;
  similarCount: number;
  relationshipCount: number;
}) {
  const atcScore = Math.min(20, atcDepth * 5);
  const diseaseScore = diseaseCount > 0 ? 15 : 0;
  const moaScore = moaCount > 0 ? 15 : 0;
  const epcScore = epcCount > 0 ? 15 : 0;
  const peScore = peCount > 0 ? 10 : 0;
  const similarityScore = Math.min(10, similarCount * 2);
  const relationshipScore = relationshipCount >= 20 ? 15 : relationshipCount > 0 ? 8 : 0;

  return Math.min(100, Math.round(atcScore + diseaseScore + moaScore + epcScore + peScore + similarityScore + relationshipScore));
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/60 p-5 shadow-inner shadow-slate-950/40">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{label}</p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">{detail}</p>
    </div>
  );
}

function ClinicalField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">{label}</p>
      <p className="mt-3 text-lg font-black leading-7 text-white">{value || 'Not available'}</p>
    </div>
  );
}

function SignalList({ title, eyebrow, items }: { title: string; eyebrow: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/55 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
      <h4 className="mt-2 text-xl font-black text-white">{title}</h4>
      <div className="mt-4 flex flex-wrap gap-2">
        {(items.length > 0 ? items : ['Not populated']).map((item) => (
          <span
            key={item}
            className="rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-100"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function SimilarMedicationCard({ item, onSelectSimilarDrug }: { item: SimilarMedication; onSelectSimilarDrug?: (drug: DrugCard) => void }) {
  const sharedClasses = Array.isArray(item.shared_classes) ? item.shared_classes : [];
  const sharedLabels = sharedClasses
    .map((shared) => shared.class_name || shared.class_id || shared.class_type)
    .filter(Boolean)
    .slice(0, 4) as string[];

  return (
    <button
      type="button"
      onClick={() => onSelectSimilarDrug?.(item as DrugCard)}
      className="w-full rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-slate-950"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Similar Medication</p>
          <h4 className="mt-2 text-xl font-black text-white">{getSimilarityName(item)}</h4>
          <p className="mt-2 text-sm font-semibold text-slate-400">{item.similarity_reason_type || item.similarity_tier || 'Weighted clinical similarity'}</p>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Overall</p>
          <p className="mt-1 text-2xl font-black text-white">{asPercent(item.overall_similarity ?? item.similarity_score)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <MetricCard label="Mechanism" value={asPercent(item.mechanism_similarity)} detail="MOA match" />
        <MetricCard label="Disease" value={asPercent(item.disease_similarity)} detail="Disease overlap" />
        <MetricCard label="Therapeutic" value={asPercent(item.therapeutic_similarity)} detail="ATC pathway" />
        <MetricCard label="Classification" value={asPercent(item.classification_similarity)} detail="Class evidence" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(sharedLabels.length > 0 ? sharedLabels : ['No shared class labels available']).map((label) => (
          <span key={label} className="rounded-full border border-slate-600/60 bg-slate-900 px-3 py-1 text-xs font-bold text-slate-200">
            {label}
          </span>
        ))}
      </div>

      {(item.similarity_explanation || item.reason) && (
        <p className="mt-4 text-sm font-medium leading-6 text-slate-300">
          {item.similarity_explanation || item.reason}
        </p>
      )}
    </button>
  );
}

export default function ClinicalIntelligenceDashboard({ drug, onSelectSimilarDrug }: Props) {
  if (!drug) return null;

  const classifications = drug.classifications || {};
  const displayName = getDisplayName(drug);
  const executiveIntelligence = drug.executive_intelligence || {};
  const executiveClinicalIdentity = executiveIntelligence.executive_clinical_identity || {};
  const executiveSummary = drug.medication_intelligence_summary || {};

  const atcPathway = buildAtcPathway(classifications);
  const atcDepth = atcPathway.filter((step) => step.populated).length;
  const diseaseItems = getBucketItems(classifications, 'DISEASE');
  const moaItems = getBucketItems(classifications, 'MOA');
  const peItems = getBucketItems(classifications, 'PE');
  const epcItems = getBucketItems(classifications, 'EPC');
  const similarMedications = getSimilarMedications(drug);
  const relationshipCount = getRelationshipCount(drug);

  const clinicalIdentity =
    executiveClinicalIdentity.clinical_identity ||
    executiveClinicalIdentity.title ||
    `${displayName} clinical intelligence profile`;
  const therapeuticDomain =
    executiveClinicalIdentity.therapeutic_domain ||
    executiveSummary.primary_therapeutic_domain ||
    getPrimaryName(getBucketItems(classifications, 'ATC1'));
  const diseaseFocus =
    executiveClinicalIdentity.disease_focus ||
    executiveSummary.primary_disease_focus ||
    getPrimaryName(diseaseItems);
  const mechanism =
    executiveClinicalIdentity.mechanism ||
    executiveSummary.primary_mechanism ||
    getPrimaryName(moaItems);
  const pharmacologicClass =
    executiveClinicalIdentity.pharmacologic_class ||
    executiveSummary.primary_pharmacologic_class ||
    getPrimaryName(epcItems);

  const clinicalReadinessScore = calculateClinicalReadiness({
    atcDepth,
    diseaseCount: diseaseItems.length,
    moaCount: moaItems.length,
    epcCount: epcItems.length,
    peCount: peItems.length,
    similarCount: similarMedications.length,
    relationshipCount,
  });

  const assessment =
    executiveIntelligence.clinical_intelligence_summary ||
    `${displayName} demonstrates ${clinicalReadinessScore >= 85 ? 'strong' : clinicalReadinessScore >= 65 ? 'developing' : 'foundational'} clinical intelligence coverage with ${atcDepth}/4 ATC hierarchy levels, ${diseaseItems.length} disease mapping${diseaseItems.length === 1 ? '' : 's'}, ${moaItems.length} mechanism mapping${moaItems.length === 1 ? '' : 's'}, ${epcItems.length} established pharmacologic class mapping${epcItems.length === 1 ? '' : 's'}, and ${similarMedications.length} weighted similar medication match${similarMedications.length === 1 ? '' : 'es'}. The medication is ${clinicalReadinessScore >= 85 ? 'well suited' : 'positioned'} for clinical decision support, therapeutic substitution analysis, and research intelligence workflows.`;

  return (
    <section className="space-y-6 text-white">
      <div className="overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_34%),linear-gradient(135deg,#020617,#07152d_48%,#020617)] p-7 shadow-2xl shadow-slate-950/40">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Clinical Intelligence Dashboard</p>
            <h3 className="mt-3 text-4xl font-black tracking-tight text-white">{displayName}</h3>
            <p className="mt-3 text-base font-semibold leading-7 text-slate-300">
              Clinical assessment of therapeutic identity, ATC pathway completeness, disease evidence, pharmacologic mechanism, similar medication context, and relationship density.
            </p>
          </div>

          <div className="rounded-[2rem] border border-cyan-300/25 bg-cyan-500/10 px-7 py-6 text-center shadow-[0_0_24px_rgba(34,211,238,0.14)]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Clinical Readiness</p>
            <p className="mt-2 text-5xl font-black text-white">{clinicalReadinessScore}</p>
            <p className="text-sm font-black text-cyan-100">/ 100</p>
            <p className="mt-3 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100">
              {scoreTier(clinicalReadinessScore)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="ATC Coverage" value={`${atcDepth}/4`} detail="Therapeutic hierarchy depth" />
        <MetricCard label="Disease Mappings" value={diseaseItems.length} detail="DISEASE classification evidence" />
        <MetricCard label="MOA / EPC" value={`${moaItems.length}/${epcItems.length}`} detail="Mechanism and EPC coverage" />
        <MetricCard label="Relationships" value={relationshipCount} detail="RxNorm linkage density" />
      </div>

      <section className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-6 shadow-[0_0_24px_rgba(14,165,233,0.12)]">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Section 1</p>
        <h3 className="mt-2 text-2xl font-black text-white">Clinical Identity</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ClinicalField label="Clinical Identity" value={clinicalIdentity} />
          <ClinicalField label="Therapeutic Domain" value={therapeuticDomain} />
          <ClinicalField label="Disease Focus" value={diseaseFocus} />
          <ClinicalField label="Mechanism" value={mechanism} />
          <ClinicalField label="Pharmacologic Class" value={pharmacologicClass} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-6 shadow-[0_0_24px_rgba(14,165,233,0.12)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Section 2</p>
            <h3 className="mt-2 text-2xl font-black text-white">Therapeutic Pathway</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
              ATC progression from main therapeutic group through chemical subgroup.
            </p>
          </div>
          <span className="w-fit rounded-2xl border border-blue-300/25 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-100">
            {atcDepth}/4 ATC levels populated
          </span>
        </div>

        <div className="mt-6 overflow-x-auto pb-2">
          <div className="flex min-w-full gap-5">
            {atcPathway.map((step, index) => (
              <div key={`${step.bucket}-${step.code}-${index}`} className="relative min-w-[16rem] flex-1 rounded-3xl border border-white/10 bg-slate-900/60 p-5">
                {index < atcPathway.length - 1 && (
                  <div className="absolute left-[calc(100%-0.15rem)] top-10 hidden h-0.5 w-8 bg-gradient-to-r from-blue-500 to-cyan-400 xl:block" />
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-400 text-xl font-black text-white">
                    {step.step}
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${step.populated ? 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100' : 'border-slate-600 bg-slate-800 text-slate-400'}`}>
                    {step.populated ? 'Populated' : 'Missing'}
                  </span>
                </div>
                <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{step.bucket} · {step.code}</p>
                <h4 className="mt-2 text-xl font-black leading-tight text-white">{step.name}</h4>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-400">{step.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-6 shadow-[0_0_24px_rgba(14,165,233,0.12)]">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Section 3</p>
        <h3 className="mt-2 text-2xl font-black text-white">Disease Intelligence</h3>
        <div className="mt-5 grid gap-4 xl:grid-cols-4">
          <SignalList title="Disease Focus" eyebrow="DISEASE" items={getClassNames(diseaseItems)} />
          <SignalList title="Mechanism of Action" eyebrow="MOA" items={getClassNames(moaItems)} />
          <SignalList title="Pharmacologic Effects" eyebrow="PE" items={getClassNames(peItems)} />
          <SignalList title="Established Pharmacologic Class" eyebrow="EPC" items={getClassNames(epcItems)} />
        </div>
      </section>

      <section className="rounded-[2rem] border border-cyan-300/20 bg-slate-950/70 p-6 shadow-[0_0_24px_rgba(14,165,233,0.12)]">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Section 4</p>
        <h3 className="mt-2 text-2xl font-black text-white">Similar Medication Intelligence</h3>
        <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-300">
          Weighted similarity evidence using mechanism, disease, therapeutic pathway, and classification reasoning.
        </p>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {similarMedications.length > 0 ? (
            similarMedications.slice(0, 6).map((item, index) => (
              <SimilarMedicationCard
                key={`${item.rxcui || item.drug_name || item.rxnorm_name || index}`}
                item={item}
                onSelectSimilarDrug={onSelectSimilarDrug}
              />
            ))
          ) : (
            <div className="xl:col-span-2 rounded-3xl border border-blue-300/20 bg-blue-500/10 p-5 text-sm font-bold text-blue-100">
              Similar medications will populate when weighted similarity evidence is available for this medication.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(135deg,_rgba(14,165,233,0.13),_rgba(15,23,42,0.9))] p-6 shadow-[0_0_24px_rgba(14,165,233,0.12)]">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Section 5</p>
        <h3 className="mt-2 text-2xl font-black text-white">Clinical Intelligence Assessment</h3>
        <p className="mt-4 text-base font-semibold leading-8 text-slate-200">{assessment}</p>
      </section>
    </section>
  );
}
