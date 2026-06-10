import { DrugCard } from '../lib/api';
import { buildTherapeuticPathway } from './TherapeuticPathway';

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
};

type Strength = {
  label: string;
  value: number;
};

function valueFrom(drug: any, keys: string[], fallback: any = null) {
  for (const key of keys) {
    const value = drug?.[key] ?? drug?.drug?.[key] ?? drug?.scorecard?.[key];

    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return fallback;
}

function getDrugName(drug: any) {
  return (
    drug?.display_name ||
    drug?.rxnorm_name ||
    drug?.drug_name ||
    drug?.name ||
    drug?.drug?.rxnorm_name ||
    drug?.drug?.drug_name ||
    'This medication'
  );
}

function getScore(drug: any, keys: string[], fallback = 0) {
  const value = valueFrom(drug, keys, null);
  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : fallback;
}

function getTopStrengths(drug: any): Strength[] {
  return [
    {
      label: 'Clinical Semantics',
      value: getScore(drug, ['clinical_semantics_score']),
    },
    {
      label: 'AI Readiness',
      value: getScore(drug, ['ai_readiness_score']),
    },
    {
      label: 'Semantic Richness',
      value: getScore(drug, ['semantic_richness_score']),
    },
    {
      label: 'Claims Readiness',
      value: getScore(drug, ['claims_readiness_score']),
    },
    {
      label: 'Interoperability',
      value: getScore(drug, ['interoperability_score']),
    },
    {
      label: 'Overall Intelligence',
      value: getScore(drug, ['overall_intelligence_score']),
    },
  ]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4);
}

function getRecommendation(drug: any) {
  const ai = getScore(drug, ['ai_readiness_score']);
  const claims = getScore(drug, ['claims_readiness_score']);
  const semantic = getScore(drug, ['semantic_richness_score']);

  if (ai > 80 && claims > 80 && semantic > 80) {
    return 'Production Ready';
  }

  if (ai > 70 && claims > 70) {
    return 'Enterprise Candidate';
  }

  return 'Monitor & Enrich';
}

function sentenceList(items: string[]) {
  if (items.length === 0) {
    return 'enterprise intelligence signals';
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${
    items[items.length - 1]
  }`;
}

function getClassificationCount(drug: any) {
  const classifications =
    drug?.classifications || drug?.drug?.classifications || {};

  return Object.entries(classifications).reduce((sum, [key, value]) => {
    if (key === 'counts') return sum;
    return sum + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

export default function ExecutiveAssessmentCard({ drug }: Props) {
  if (!drug) return null;

  const name = getDrugName(drug);
  const recommendation = getRecommendation(drug);

  const strengths = getTopStrengths(drug);
  const strengthNames = strengths.map((strength) =>
    strength.label.toLowerCase()
  );

  const classificationCount = getClassificationCount(drug);
  const pathway = buildTherapeuticPathway(drug);

  return (
    <section className="rounded-[2rem] border border-blue-900/50 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.10),_transparent_32%),linear-gradient(135deg,_rgba(15,23,42,0.92),_rgba(2,6,23,0.98))] p-7 text-white shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Executive Overview
          </p>

          <h3 className="mt-3 text-4xl font-black tracking-tight text-white">
            Why {name} matters
          </h3>
        </div>

        <div className="rounded-3xl border border-cyan-400/40 bg-cyan-500/10 px-6 py-5 text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
            Recommendation
          </p>

          <p className="mt-2 text-2xl font-black text-white">
            {recommendation}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/70 p-8">
        <p className="text-xl leading-10 text-slate-200">
          <span className="font-black text-white">{name}</span> demonstrates
          strong enterprise medication intelligence maturity, supported by{' '}
          <span className="font-black text-cyan-100">
            {sentenceList(strengthNames)}
          </span>
          . Its structured classification framework, semantic depth, and
          readiness signals make it suitable for clinical analytics, payer
          reporting, AI deployment, and knowledge graph integration.
        </p>

        <p className="mt-6 text-xl leading-10 text-slate-200">
          The medication contains{' '}
          <span className="font-black text-white">
            {classificationCount || 'multiple'} classification mappings
          </span>{' '}
          and a{' '}
          <span className="font-black text-white">
            {pathway.length || '—'}/4 ATC hierarchy
          </span>
          , providing robust support for explainability, executive reporting,
          clinical intelligence, and AI-driven healthcare workflows. Overall,
          the medication is positioned as{' '}
          <span className="font-black text-cyan-100">
            {recommendation}
          </span>{' '}
          based on its strongest intelligence signals and enterprise readiness
          thresholds.
        </p>
      </div>
    </section>
  );
}