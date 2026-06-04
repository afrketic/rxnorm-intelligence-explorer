import { useState, type ReactNode } from 'react';
import { DrugCard, ClassificationBuckets, ClassificationItem } from '../lib/api';

type ExecutiveUseCase = {
  use_case?: string;
  fit?: string;
  description?: string;
};

type ExecutiveIntelligence = {
  executive_clinical_identity?: {
    title?: string;
    clinical_identity?: string;
    therapeutic_domain?: string;
    disease_focus?: string;
    mechanism?: string;
    pharmacologic_class?: string;
  };
  executive_therapeutic_narrative?: string;
  clinical_intelligence_summary?: string;
  disease_focus_narrative?: string;
  explainability_narrative?: string;
  recommended_use_cases?: ExecutiveUseCase[];
  polish_version?: string;
};

function getBucketItems(
  classifications: ClassificationBuckets | undefined,
  bucket: string
): ClassificationItem[] {
  return ((classifications || {})[bucket] as ClassificationItem[]) || [];
}

function getFirstName(items: ClassificationItem[]) {
  return (
    items.find((item) => item.class_name)?.class_name ||
    items.find((item) => item.class_id)?.class_id ||
    'Not available'
  );
}

function toScore(value: string | number | undefined | null): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;

  if (value !== undefined && value !== null && value !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function scoreLabel(score: number | null) {
  if (score === null || Number.isNaN(score)) return 'Not Available';
  if (score >= 90) return 'Enterprise Ready';
  if (score >= 75) return 'Strong';
  if (score >= 50) return 'Developing';
  if (score >= 25) return 'Limited';
  return 'Foundational';
}

function SummaryField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-slate-900/70 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">
        {label}
      </div>
      <div className="mt-2 text-sm font-bold leading-6 text-white">
        {value || 'Not available'}
      </div>
    </div>
  );
}

function ScorePill({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined | null;
}) {
  const numericValue = toScore(value);
  const displayValue = numericValue !== null ? `${Math.round(numericValue)}%` : 'N/A';

  return (
    <div className="rounded-2xl border border-cyan-300/20 bg-slate-900/80 px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-white">{displayValue}</div>
      <div className="mt-1 text-xs font-semibold text-cyan-300">
        {scoreLabel(numericValue)}
      </div>
    </div>
  );
}

function EvidenceLine({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-2 text-sm leading-6 text-slate-300">
      <span
        className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
          active
            ? 'bg-emerald-400/20 text-emerald-300'
            : 'bg-slate-700 text-slate-400'
        }`}
      >
        {active ? '✓' : '–'}
      </span>
      <span>{children}</span>
    </li>
  );
}

function ReadinessExplanationCard({
  title,
  score,
  description,
  evidence,
}: {
  title: string;
  score: string | number | undefined | null;
  description: string;
  evidence: Array<{ active: boolean; text: string }>;
}) {
  const numericScore = toScore(score);
  const displayScore = numericScore !== null ? `${Math.round(numericScore)}%` : 'N/A';

  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-slate-900/70 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-white">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
        </div>

        <div className="rounded-2xl border border-cyan-300/20 bg-slate-950 px-4 py-3 text-right text-white">
          <div className="text-xl font-bold">{displayScore}</div>
          <div className="text-xs font-semibold text-cyan-300">
            {scoreLabel(numericScore)}
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-cyan-300/10 pt-4">
        <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">
          Why this score?
        </div>

        <ul className="mt-3 space-y-2">
          {evidence.map((item, idx) => (
            <EvidenceLine key={`${title}-${idx}`} active={item.active}>
              {item.text}
            </EvidenceLine>
          ))}
        </ul>
      </div>
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
        narrative?: Record<string, string | number | null | undefined>;
        relationships?: Record<string, unknown>;
        medication_intelligence_summary?: Record<string, any>;
        therapeutic_narrative?: Record<string, any>;
        executive_intelligence?: ExecutiveIntelligence;
      })
    | null;
}) {
  if (!drug) return null;

  const classifications = drug.classifications || {};
  const scorecard = drug.scorecard || {};
  const drugData = drug.drug || drug;
  const narrative = (drug as any).narrative;
  const relationships = (drug as any).relationships || {};
  const relationshipCounts = (relationships as any).counts || {};

  const executiveSummary = (drug as any).medication_intelligence_summary || {};
  const therapeuticNarrative = (drug as any).therapeutic_narrative || {};

  const displayName =
    drugData.rxnorm_name ||
    drugData.drug_name ||
    drugData.name ||
    drugData.display_name ||
    drugData.label ||
    drug.rxcui ||
    'Selected Medication';

  const rxcui = drug.rxcui || drugData.rxcui || 'N/A';

  const atc4 = getFirstName(getBucketItems(classifications, 'ATC4'));
  const moa = getFirstName(getBucketItems(classifications, 'MOA'));
  const epc = getFirstName(getBucketItems(classifications, 'EPC'));
  const diseaseCount = getBucketItems(classifications, 'DISEASE').length;
  const peCount = getBucketItems(classifications, 'PE').length;
  const chemCount = getBucketItems(classifications, 'CHEM').length;
  const vaCount = getBucketItems(classifications, 'VA').length;

  const atcDepth = ['ATC1', 'ATC2', 'ATC3', 'ATC4'].filter(
    (bucket) => getBucketItems(classifications, bucket).length > 0
  ).length;

  const totalClassifications = [
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

  const populatedDomains = [
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

  const relationshipTotal = Number(
    relationshipCounts.raw_relationship_rows ||
      relationshipCounts.related_concepts ||
      relationshipCounts.ingredients ||
      0
  );

  const claimsScore =
    scorecard.claims_readiness_score ?? drugData.claims_readiness_score;
  const aiScore = scorecard.ai_readiness_score ?? drugData.ai_readiness_score;
  const semanticScore =
    scorecard.semantic_richness_score ?? drugData.semantic_richness_score;
  const overallScore =
    scorecard.overall_intelligence_score ?? drugData.overall_intelligence_score;
  const interoperabilityScore =
    scorecard.interoperability_score ?? drugData.interoperability_score;
  const clinicalScore =
    scorecard.clinical_semantics_score ?? drugData.clinical_semantics_score;

  const hasAtc = atcDepth > 0;
  const hasFullAtc = atcDepth === 4;
  const hasMoa = getBucketItems(classifications, 'MOA').length > 0;
  const hasEpc = getBucketItems(classifications, 'EPC').length > 0;
  const hasDiseaseMappings = diseaseCount > 0;
  const hasRelationshipEvidence = relationshipTotal > 0;
  const hasSemanticDepth = populatedDomains >= 6 || totalClassifications >= 10;
  const hasClinicalEvidence =
    hasMoa || hasEpc || hasDiseaseMappings || peCount > 0 || vaCount > 0;

  const executiveIntelligence: ExecutiveIntelligence =
    (drug as any).executive_intelligence || {};

  const executiveClinicalIdentity =
    executiveIntelligence.executive_clinical_identity || {};

  const recommendedUseCases = Array.isArray(executiveIntelligence.recommended_use_cases)
    ? executiveIntelligence.recommended_use_cases
    : [];

  const profileTabs = [
    { id: 'identity', label: 'Identity', description: 'Medication identity and therapeutic positioning' },
    { id: 'clinical', label: 'Clinical', description: 'Clinical role and disease focus' },
    { id: 'useCases', label: 'Use Cases', description: 'Recommended enterprise workflows' },
    { id: 'readiness', label: 'Readiness', description: 'Evidence behind readiness scores' },
  ] as const;

  const [activeProfileTab, setActiveProfileTab] = useState<(typeof profileTabs)[number]['id']>('identity');

  return (
    <section className="rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-6 text-white shadow-[0_0_24px_rgba(14,165,233,0.12)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">
            Medication Intelligence Profile
          </div>

          <h2 className="mt-2 text-2xl font-bold text-white">
            {String(displayName)}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-300">
            Enterprise medication profile combining RxNorm identity, therapeutic
            classification, pharmacologic evidence, clinical mappings, claims readiness,
            and AI-readiness signals.
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-300/20 bg-slate-900 px-5 py-4 text-white">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            RxCUI
          </div>
          <div className="mt-1 text-2xl font-bold">{String(rxcui)}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScorePill label="Overall Intelligence" value={overallScore} />
        <ScorePill label="Claims Readiness" value={claimsScore} />
        <ScorePill label="AI Readiness" value={aiScore} />
        <ScorePill label="Semantic Richness" value={semanticScore} />
      </div>

      <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-slate-900/70 p-3">
        <div className="grid gap-2 md:grid-cols-4">
          {profileTabs.map((tab) => {
            const isActive = activeProfileTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveProfileTab(tab.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  isActive
                    ? 'border-cyan-300/40 bg-cyan-500/15 text-white shadow-[0_0_18px_rgba(34,211,238,0.14)]'
                    : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-cyan-300/30 hover:bg-slate-900'
                }`}
              >
                <span className="block text-sm font-bold">{tab.label}</span>
                <span className={`mt-1 block text-xs leading-5 ${isActive ? 'text-cyan-200' : 'text-slate-500'}`}>
                  {tab.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-slate-900/70 p-5">
        {activeProfileTab === 'identity' && (
          <div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">
                  Executive Medication Intelligence
                </div>
                <h3 className="mt-1 text-lg font-bold text-white">
                  Medication identity and therapeutic positioning
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Primary domain, disease focus, mechanism, pharmacologic class, and classification breadth.
                </p>
              </div>

              <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                Identity Workspace
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SummaryField
                label="Primary Therapeutic Domain"
                value={
                  executiveSummary?.primary_therapeutic_domain ||
                  executiveClinicalIdentity.therapeutic_domain ||
                  atc4 ||
                  'Not available'
                }
              />
              <SummaryField
                label="Primary Disease Focus"
                value={executiveSummary?.primary_disease_focus || 'Not available'}
              />
              <SummaryField
                label="Secondary Disease Focus"
                value={executiveSummary?.secondary_disease_focus || 'Not available'}
              />
              <SummaryField
                label="Primary Mechanism"
                value={executiveSummary?.primary_mechanism || moa || 'Not available'}
              />
              <SummaryField
                label="Primary Pharmacologic Class"
                value={executiveSummary?.primary_pharmacologic_class || epc || 'Not available'}
              />
              <SummaryField
                label="Classification Breadth"
                value={`${executiveSummary?.classification_breadth || totalClassifications || 0} mappings`}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">
                    Executive Therapeutic Narrative
                  </div>
                  <h4 className="mt-1 text-base font-bold text-white">
                    Clinical Intelligence Summary
                  </h4>
                </div>

                <span className="rounded-full border border-cyan-300/20 bg-slate-950 px-3 py-1 text-xs font-bold text-cyan-300">
                  Sprint 15D
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-cyan-50">
                {executiveIntelligence.executive_therapeutic_narrative ||
                  therapeuticNarrative?.narrative ||
                  narrative?.ai_summary_text || (
                    <>
                      {String(displayName)} contains{' '}
                      <span className="font-bold">{totalClassifications}</span> mapped
                      classification records, including a{' '}
                      <span className="font-bold">{atcDepth}/4 ATC hierarchy</span>,{' '}
                      <span className="font-bold">{diseaseCount}</span> disease association
                      mappings, and available mechanism/pharmacologic class evidence. This
                      profile supports medication explainability, claims analytics, and
                      downstream AI-readiness evaluation.
                    </>
                  )}
              </p>

              {executiveIntelligence.clinical_intelligence_summary && (
                <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-slate-950/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">
                    Explainability Layer
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {executiveIntelligence.clinical_intelligence_summary}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeProfileTab === 'clinical' && (
          <div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">
                  Executive Medication Intelligence
                </div>
                <h3 className="mt-1 text-lg font-bold text-white">
                  Executive Clinical Identity
                </h3>
              </div>

              <span className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
                Enterprise AI Product Layer
              </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-300">
              {executiveClinicalIdentity.clinical_identity ||
                `${String(displayName)} is clinically positioned within ${
                  executiveSummary?.primary_therapeutic_domain || 'its therapeutic domain'
                }, with disease focus on ${
                  executiveSummary?.primary_disease_focus || 'available mapped clinical evidence'
                }.`}
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryField
                label="Executive Clinical Identity"
                value={
                  executiveClinicalIdentity.pharmacologic_class ||
                  executiveSummary?.primary_pharmacologic_class ||
                  'Not available'
                }
              />
              <SummaryField
                label="Therapeutic Domain"
                value={
                  executiveClinicalIdentity.therapeutic_domain ||
                  executiveSummary?.primary_therapeutic_domain ||
                  'Not available'
                }
              />
              <SummaryField
                label="Disease Focus"
                value={
                  executiveClinicalIdentity.disease_focus ||
                  executiveSummary?.primary_disease_focus ||
                  'Not available'
                }
              />
              <SummaryField
                label="Mechanism"
                value={
                  executiveClinicalIdentity.mechanism ||
                  executiveSummary?.primary_mechanism ||
                  'Not available'
                }
              />
            </div>

            {executiveIntelligence.disease_focus_narrative && (
              <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-emerald-300">
                  Disease Focus Narrative
                </div>
                <p className="mt-2 text-sm leading-6 text-emerald-50">
                  {executiveIntelligence.disease_focus_narrative}
                </p>
              </div>
            )}
          </div>
        )}

        {activeProfileTab === 'useCases' && (
          <div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">
                  Recommendation Layer
                </div>
                <h3 className="mt-1 text-lg font-bold text-white">
                  Recommended Enterprise Use Cases
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Suggested enterprise workflows supported by this medication intelligence profile.
                </p>
              </div>

              <span className="rounded-full border border-cyan-300/20 bg-slate-950 px-3 py-1 text-xs font-bold text-cyan-300">
                AI-Ready Use Cases
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {(recommendedUseCases.length > 0
                ? recommendedUseCases
                : [
                    {
                      use_case: 'Claims Analytics',
                      fit: 'Developing',
                      description:
                        'Use medication intelligence for claims normalization and therapeutic reporting.',
                    },
                    {
                      use_case: 'Clinical Decision Support',
                      fit: 'Developing',
                      description:
                        'Use mapped disease and pharmacologic evidence for clinical interpretation.',
                    },
                    {
                      use_case: 'AI Model Training',
                      fit: 'Developing',
                      description:
                        'Use structured medication features for AI-ready modeling inputs.',
                    },
                    {
                      use_case: 'Knowledge Graph Expansion',
                      fit: 'Developing',
                      description:
                        'Use classification and relationship evidence to expand medication graph intelligence.',
                    },
                    {
                      use_case: 'Enterprise Medication Catalogs',
                      fit: 'Developing',
                      description:
                        'Use RxNorm identity and semantic enrichment for enterprise medication catalogs.',
                    },
                  ]
              ).map((item) => (
                <div
                  key={item.use_case}
                  className="rounded-2xl border border-cyan-300/15 bg-slate-950/70 p-4 shadow-sm"
                >
                  <div className="text-xs font-bold uppercase tracking-wide text-cyan-300">
                    {item.fit || 'Developing'}
                  </div>
                  <h4 className="mt-2 text-sm font-bold text-white">{item.use_case}</h4>
                  <p className="mt-2 text-xs leading-5 text-slate-300">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeProfileTab === 'readiness' && (
          <div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Readiness Explainability</h3>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  Evidence-level explanation of why this medication receives its readiness scores.
                </p>
              </div>

              <span className="rounded-full border border-cyan-300/20 bg-slate-950 px-3 py-1 text-xs font-bold text-cyan-300">
                Sprint 15D
              </span>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <ReadinessExplanationCard
                title="Claims Readiness"
                score={claimsScore}
                description="Indicates whether the drug has enough standardized identity, classification, and hierarchy evidence to support claims analytics."
                evidence={[
                  { active: true, text: 'RxNorm identity is available for claims normalization.' },
                  { active: hasAtc, text: 'ATC therapeutic classification is present.' },
                  { active: hasFullAtc, text: 'Complete 4-level ATC hierarchy supports therapeutic rollups.' },
                  {
                    active: totalClassifications > 0,
                    text: `${totalClassifications} classification records are available.`,
                  },
                  {
                    active: hasRelationshipEvidence,
                    text: 'Relationship intelligence is available for crosswalk and concept context.',
                  },
                ]}
              />

              <ReadinessExplanationCard
                title="AI Readiness"
                score={aiScore}
                description="Indicates whether the profile has enough semantic structure to support explainable AI features and downstream modeling."
                evidence={[
                  {
                    active: hasFullAtc,
                    text: 'Complete ATC hierarchy provides structured therapeutic context.',
                  },
                  { active: hasMoa, text: 'Mechanism-of-action evidence is available.' },
                  { active: hasEpc, text: 'Established pharmacologic class evidence is available.' },
                  {
                    active: hasDiseaseMappings,
                    text: `${diseaseCount} disease association mappings support clinical explainability.`,
                  },
                  {
                    active: hasSemanticDepth,
                    text: `${populatedDomains} populated intelligence domains provide semantic breadth.`,
                  },
                ]}
              />

              <ReadinessExplanationCard
                title="Semantic Richness"
                score={semanticScore}
                description="Summarizes the depth and diversity of classification, clinical, and relationship evidence available for this medication."
                evidence={[
                  {
                    active: totalClassifications >= 10,
                    text: `${totalClassifications} mapped classification records provide depth.`,
                  },
                  {
                    active: populatedDomains >= 6,
                    text: `${populatedDomains} populated intelligence domains provide diversity.`,
                  },
                  {
                    active: hasClinicalEvidence,
                    text: 'Clinical semantic evidence is available through MOA, EPC, disease, PE, or VA mappings.',
                  },
                  { active: chemCount > 0, text: 'Chemical classification evidence is present.' },
                  {
                    active: hasRelationshipEvidence,
                    text: 'Relationship records enrich semantic context beyond classification alone.',
                  },
                ]}
              />

              <ReadinessExplanationCard
                title="Interoperability"
                score={interoperabilityScore ?? clinicalScore ?? overallScore}
                description="Explains whether the medication profile can be connected across terminology, clinical, analytics, and AI workflows."
                evidence={[
                  { active: true, text: 'RxCUI provides the normalized medication anchor.' },
                  { active: hasAtc, text: 'ATC mappings support therapeutic interoperability.' },
                  {
                    active: totalClassifications > 0,
                    text: 'Classification records support cross-domain interpretation.',
                  },
                  {
                    active: hasRelationshipEvidence,
                    text: 'Relationship records support concept linking and graph expansion.',
                  },
                  {
                    active: hasSemanticDepth,
                    text: 'Semantic breadth supports reusable enterprise intelligence features.',
                  },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}