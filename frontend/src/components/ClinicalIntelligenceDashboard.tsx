import type { ReactNode } from 'react';
import { DrugCard, ClassificationBuckets, ClassificationItem } from '../lib/api';
import TherapeuticPathway from './TherapeuticPathway';

type SimilarMedication = {
  rxcui?: string | number;
  drug_name?: string;
  rxnorm_name?: string;
  name?: string;
  tty?: string;
  similarity_tier?: string;
  similarity_reason_type?: string;
  similarity_explanation?: string;
  reason?: string;
  shared_classes?: Array<{
    class_type?: string;
    class_id?: string;
    class_name?: string;
  }>;
  [key: string]: any;
};

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
  onSelectSimilarDrug?: (drug: DrugCard) => void;
  onSelectAtc?: (code: string) => void;
};

function clean(value: unknown, fallback = 'Not available') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function getDisplayName(drug: any) {
  return clean(
    drug?.rxnorm_name ||
      drug?.drug_name ||
      drug?.display_name ||
      drug?.name ||
      drug?.drug?.rxnorm_name ||
      drug?.drug?.drug_name,
    'This medication'
  );
}

function getClassifications(drug: any): ClassificationBuckets {
  return drug?.classifications || drug?.drug?.classifications || {};
}

function getBucketItems(
  classifications: ClassificationBuckets | undefined,
  bucket: string
): ClassificationItem[] {
  const value = (classifications || {})[bucket] || (classifications || {})[bucket.toLowerCase()];
  return Array.isArray(value) ? (value as ClassificationItem[]) : [];
}

function getPrimaryName(items: ClassificationItem[], fallback = 'Not available') {
  return (
    items.find((item) => item.class_name)?.class_name ||
    items.find((item) => item.class_id)?.class_id ||
    fallback
  );
}

function unique(values: Array<string | null | undefined>, fallback?: string[]) {
  const output = values
    .map((value) => clean(value, ''))
    .filter(Boolean)
    .filter((value, index, arr) => arr.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);

  return output.length > 0 ? output : fallback || ['Not available'];
}

function getClinicalIdentity(drug: any) {
  const classifications = getClassifications(drug);
  const summary = drug?.medication_intelligence_summary || drug?.drug?.medication_intelligence_summary || {};
  const identity =
    drug?.clinical_identity ||
    drug?.clinical_briefing?.clinical_identity ||
    drug?.executive_intelligence?.executive_clinical_identity ||
    drug?.drug?.executive_intelligence?.executive_clinical_identity ||
    {};

  return {
    therapeuticDomain: clean(
      identity.therapeutic_domain ||
        summary.primary_therapeutic_domain ||
        getPrimaryName(getBucketItems(classifications, 'ATC1'))
    ),
    diseaseFocus: clean(
      identity.disease_focus ||
        summary.primary_disease_focus ||
        getPrimaryName(getBucketItems(classifications, 'DISEASE'))
    ),
    mechanism: clean(
      identity.mechanism ||
        summary.primary_mechanism ||
        getPrimaryName(getBucketItems(classifications, 'MOA')) ||
        getPrimaryName(getBucketItems(classifications, 'EPC'))
    ),
    pharmacologicClass: clean(
      identity.pharmacologic_class ||
        summary.primary_pharmacologic_class ||
        getPrimaryName(getBucketItems(classifications, 'EPC'))
    ),
    clinicalIdentity: clean(identity.clinical_identity || '', ''),
  };
}

function getClinicalSummary(drug: any, displayName: string, identity: ReturnType<typeof getClinicalIdentity>) {
  const narrative =
    drug?.clinical_summary ||
    drug?.clinical_briefing?.clinical_summary ||
    drug?.executive_intelligence?.executive_therapeutic_narrative ||
    drug?.therapeutic_narrative?.narrative ||
    drug?.executive_intelligence?.clinical_intelligence_summary ||
    drug?.drug?.executive_intelligence?.executive_therapeutic_narrative ||
    '';

  if (clean(narrative, '')) return narrative;

  return `${displayName} is clinically positioned within ${identity.therapeuticDomain}, with disease focus centered on ${identity.diseaseFocus}. Its mechanism evidence maps to ${identity.mechanism}, while its pharmacologic class evidence supports interpretation as ${identity.pharmacologicClass}.`;
}

function getDiseaseContext(drug: any, identity: ReturnType<typeof getClinicalIdentity>) {
  const summary = drug?.medication_intelligence_summary || drug?.drug?.medication_intelligence_summary || {};
  const context = drug?.disease_context || drug?.clinical_briefing?.disease_context || {};

  const primary = clean(context.primary_disease_focus || summary.primary_disease_focus || identity.diseaseFocus);
  const secondary = clean(context.secondary_disease_focus || summary.secondary_disease_focus || '', 'Supporting Disease Context');
  const tertiary = clean(context.tertiary_disease_focus || summary.tertiary_disease_focus || '', 'Emerging Clinical Context');

  const narrative = clean(
    context.narrative ||
      drug?.executive_intelligence?.disease_focus_narrative ||
      summary.executive_disease_rationale ||
      '',
    `${primary} is the primary disease context for this medication. Supporting clinical evidence also connects the medication to ${secondary} and ${tertiary}, helping explain where it fits within therapeutic care.`
  );

  return { primary, secondary, tertiary, narrative };
}

function getSimilarMedications(drug: any): SimilarMedication[] {
  const source = drug?.similar_medications || drug?.related_medications || [];
  return Array.isArray(source)
    ? source.filter((item): item is SimilarMedication => typeof item === 'object' && item !== null)
    : [];
}

function getSimilarityName(item: SimilarMedication) {
  return clean(
    item.drug_name || item.rxnorm_name || item.name || (item.rxcui ? `RxCUI ${item.rxcui}` : ''),
    'Similar medication'
  );
}

function getClinicalRelationship(item: SimilarMedication) {
  const tier = normalize(item.similarity_tier || item.similarity_reason_type);

  if (tier.includes('clinical peer')) return 'Closely Related Therapy';
  if (tier.includes('therapeutic peer')) return 'Same Therapeutic Class';
  if (tier.includes('mechanism peer')) return 'Similar Mechanism';
  if (tier.includes('semantic match')) return 'Related Therapy';
  if (tier.includes('ingredient variant')) return 'Medication Variant';
  if (tier.includes('disease')) return 'Shared Disease Context';
  if (tier.includes('atc')) return 'Shared Therapeutic Pathway';

  return 'Related Therapy';
}

function getSharedEvidence(item: SimilarMedication) {
  const sharedClasses = Array.isArray(item.shared_classes) ? item.shared_classes : [];
  const labels = sharedClasses
    .map((shared) => shared.class_name || shared.class_id || shared.class_type)
    .filter(Boolean)
    .slice(0, 4) as string[];

  return labels.length > 0 ? labels : ['Shared clinical classification evidence'];
}


function getPopulationBurdenContext(drug: any, disease: ReturnType<typeof getDiseaseContext>) {
  const populationBurden = drug?.population_burden || drug?.drug?.population_burden || drug?.clinical_briefing?.population_burden || {};

  return {
    available: Boolean(populationBurden.available),
    tier: clean(populationBurden.tier, 'Not Available'),
    primaryCondition: clean(populationBurden.primary_condition || populationBurden.primaryCondition || disease.primary),
    prevalenceBenchmark: clean(populationBurden.prevalence_benchmark || populationBurden.prevalenceBenchmark, 'CDC PLACES prevalence context not yet available'),
    placesMeasure: clean(populationBurden.places_measure || populationBurden.placesMeasure, 'CDC PLACES measure not populated'),
    narrative: clean(
      populationBurden.narrative,
      `${disease.primary} is the primary disease context for this medication. Run H3C.1 to add CDC PLACES population burden intelligence for prevalence benchmarking.`
    ),
    sourceYear: clean(populationBurden.source_year || populationBurden.sourceYear, ''),
  };
}

function getClinicalUseContext(identity: ReturnType<typeof getClinicalIdentity>, disease: ReturnType<typeof getDiseaseContext>) {
  const combined = `${identity.therapeuticDomain} ${identity.diseaseFocus} ${identity.mechanism} ${identity.pharmacologicClass} ${disease.primary} ${disease.secondary} ${disease.tertiary}`.toLowerCase();

  if (combined.includes('diabetes') || combined.includes('glp') || combined.includes('metabolic') || combined.includes('obesity') || combined.includes('weight')) {
    return {
      indications: unique([disease.primary, disease.secondary, 'Weight Management'], ['Type 2 Diabetes', 'Obesity', 'Weight Management']),
      settings: ['Primary Care', 'Endocrinology', 'Metabolic Disease Clinics'],
      objectives: ['Improve Glycemic Control', 'Support Weight Reduction', 'Reduce Cardiometabolic Risk'],
      narrative: 'Clinical use is primarily oriented around metabolic disease management, longitudinal monitoring, and cardiometabolic risk reduction.',
    };
  }

  if (combined.includes('pain') || combined.includes('inflamm') || combined.includes('arthritis') || combined.includes('musculo')) {
    return {
      indications: unique([disease.primary, disease.secondary, 'Inflammation'], ['Pain Management', 'Inflammation', 'Musculoskeletal Disorders']),
      settings: ['Primary Care', 'Rheumatology', 'Orthopedics'],
      objectives: ['Reduce Pain', 'Control Inflammation', 'Improve Function'],
      narrative: 'Clinical use is primarily oriented around symptom relief, inflammation management, and musculoskeletal care pathways.',
    };
  }

  if (combined.includes('cardio') || combined.includes('thrombo') || combined.includes('platelet')) {
    return {
      indications: unique([disease.primary, disease.secondary, 'Cardiovascular Risk Management'], ['Cardiovascular Prevention', 'Vascular Risk Management']),
      settings: ['Primary Care', 'Cardiology', 'Population Health Programs'],
      objectives: ['Reduce Cardiovascular Risk', 'Support Prevention', 'Improve Longitudinal Monitoring'],
      narrative: 'Clinical use is primarily oriented around cardiovascular management, prevention, and longitudinal risk monitoring.',
    };
  }

  if (combined.includes('infection') || combined.includes('antiinfective') || combined.includes('antibiotic')) {
    return {
      indications: unique([disease.primary, disease.secondary, 'Infectious Disease Treatment'], ['Infectious Disease Treatment']),
      settings: ['Primary Care', 'Infectious Disease', 'Urgent Care'],
      objectives: ['Treat Infection', 'Support Antimicrobial Stewardship', 'Monitor Treatment Patterns'],
      narrative: 'Clinical use is primarily oriented around infection treatment, therapeutic classification, and antimicrobial stewardship workflows.',
    };
  }

  return {
    indications: unique([disease.primary, disease.secondary, disease.tertiary]),
    settings: ['Primary Care', 'Specialty Care', 'Medication Management Programs'],
    objectives: ['Support Clinical Interpretation', 'Guide Therapeutic Review', 'Enable Medication Context'],
    narrative: 'Clinical use context is derived from the medication\'s therapeutic domain, disease focus, mechanism evidence, and pharmacologic class.',
  };
}

function ClinicalIdentityField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">{label}</p>
      <p className="mt-3 text-lg font-black leading-7 text-white">{value}</p>
    </div>
  );
}

function BriefingSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-black">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function PillList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-100"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function ContextCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/55 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{title}</p>
      <div className="mt-4">
        <PillList items={items} />
      </div>
    </div>
  );
}

function SimilarMedicationCard({
  item,
  onSelectSimilarDrug,
}: {
  item: SimilarMedication;
  onSelectSimilarDrug?: (drug: DrugCard) => void;
}) {
  const sharedEvidence = getSharedEvidence(item);

  return (
    <button
      type="button"
      onClick={() => onSelectSimilarDrug?.(item as DrugCard)}
      className="w-full rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/60 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Clinical Relationship</p>
          <h4 className="mt-2 text-xl font-black text-white">{getSimilarityName(item)}</h4>
          <p className="mt-2 text-sm font-semibold text-slate-300">{getClinicalRelationship(item)}</p>
        </div>
        {item.rxcui && (
          <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-black text-slate-300">
            RxCUI {item.rxcui}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-400">
        {item.similarity_explanation || item.reason || 'Clinical relationship is based on shared therapeutic, disease, mechanism, or classification evidence.'}
      </p>

      <div className="mt-4">
        <PillList items={sharedEvidence} />
      </div>
    </button>
  );
}

export default function ClinicalIntelligenceDashboard({ drug, onSelectSimilarDrug, onSelectAtc }: Props) {
  if (!drug) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-white">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">Clinical Intelligence</p>
        <h2 className="mt-2 text-3xl font-black">Select a medication</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Choose a medication to view its clinical identity, therapeutic narrative, disease context, similar therapies, and clinical use context.
        </p>
      </section>
    );
  }

  const displayName = getDisplayName(drug);
  const identity = getClinicalIdentity(drug);
  const clinicalSummary = getClinicalSummary(drug, displayName, identity);
  const disease = getDiseaseContext(drug, identity);
  const populationBurden = getPopulationBurdenContext(drug, disease);
  const useContext = getClinicalUseContext(identity, disease);
  const similarMedications = getSimilarMedications(drug).slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-blue-500/25 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/70 p-6 text-white shadow-2xl shadow-blue-950/20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Clinical Intelligence</p>
            <h2 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Clinical Identity</h2>
            <p className="mt-4 text-lg font-semibold leading-8 text-slate-300">
              {displayName} medical briefing: what the medication is, what it treats, how it works, and which therapies are clinically related.
            </p>
          </div>
          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-500/10 px-5 py-4 text-left lg:min-w-[260px]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Medical Briefing</p>
            <p className="mt-2 text-xl font-black text-white">Narrative-first clinical context</p>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ClinicalIdentityField label="Therapeutic Domain" value={identity.therapeuticDomain} />
          <ClinicalIdentityField label="Disease Focus" value={identity.diseaseFocus} />
          <ClinicalIdentityField label="Mechanism of Action" value={identity.mechanism} />
          <ClinicalIdentityField label="Pharmacologic Class" value={identity.pharmacologicClass} />
        </div>
      </section>

      <BriefingSection eyebrow="Clinical Summary" title="What is this medication?">
        <p className="max-w-5xl text-base font-semibold leading-8 text-slate-300">{clinicalSummary}</p>
      </BriefingSection>

      <TherapeuticPathway drug={drug} onSelectAtc={onSelectAtc} />

      <BriefingSection eyebrow="Disease Intelligence" title="What conditions does this medication address?">
        <div className="grid gap-4 md:grid-cols-3">
          <ClinicalIdentityField label="Primary Disease Focus" value={disease.primary} />
          <ClinicalIdentityField label="Secondary Disease Focus" value={disease.secondary} />
          <ClinicalIdentityField label="Emerging Clinical Context" value={disease.tertiary} />
        </div>
        <p className="mt-5 max-w-5xl text-base font-semibold leading-8 text-slate-300">{disease.narrative}</p>
      </BriefingSection>

      <BriefingSection eyebrow="Population Disease Burden" title="What real-world disease burden does this medication address?">
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">Disease Focus</p>
            <p className="mt-3 text-2xl font-black text-white">{populationBurden.primaryCondition}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Population Burden</p>
                <p className="mt-2 text-lg font-black text-emerald-100">{populationBurden.tier}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">National Prevalence</p>
                <p className="mt-2 text-lg font-black text-emerald-100">{populationBurden.prevalenceBenchmark}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-700 bg-slate-950/50 p-5">
            <p className="text-sm font-semibold leading-7 text-slate-200">{populationBurden.narrative}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
                CDC PLACES
              </span>
              <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
                {populationBurden.placesMeasure}
              </span>
              {populationBurden.sourceYear ? (
                <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-100">
                  Source Year {populationBurden.sourceYear}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </BriefingSection>

      <BriefingSection eyebrow="Similar Medications" title="What therapies are clinically similar?">
        {similarMedications.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {similarMedications.map((item, index) => (
              <SimilarMedicationCard
                key={`${item.rxcui || getSimilarityName(item)}-${index}`}
                item={item}
                onSelectSimilarDrug={onSelectSimilarDrug}
              />
            ))}
          </div>
        ) : (
          <p className="text-base font-semibold leading-7 text-slate-300">
            Similar medication evidence has not yet been populated for this medication.
          </p>
        )}
      </BriefingSection>

      <BriefingSection eyebrow="Clinical Use Context" title="How is this medication typically used?">
        <div className="grid gap-4 lg:grid-cols-3">
          <ContextCard title="Typical Indications" items={useContext.indications} />
          <ContextCard title="Care Settings" items={useContext.settings} />
          <ContextCard title="Clinical Objectives" items={useContext.objectives} />
        </div>
        <p className="mt-5 max-w-5xl text-base font-semibold leading-8 text-slate-300">{useContext.narrative}</p>
      </BriefingSection>
    </div>
  );
}
