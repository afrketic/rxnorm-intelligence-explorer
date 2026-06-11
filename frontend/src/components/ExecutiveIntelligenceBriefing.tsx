import { DrugCard } from '../lib/api';
import EnterpriseHealthcareImportanceCard from './EnterpriseHealthcareImportanceCard';

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
};

function valueFrom(source: any, keys: string[], fallback: any = null) {
  for (const key of keys) {
    const value =
      source?.[key] ??
      source?.drug?.[key] ??
      source?.scorecard?.[key] ??
      source?.scores?.[key] ??
      source?.ehi_v6?.[key] ??
      source?.eii?.[key] ??
      source?.eis?.[key] ??
      source?.executive_impact?.[key] ??
      source?.medication_intelligence_summary?.[key] ??
      source?.claims_readiness_layer?.[key] ??
      source?.graph_metrics?.[key] ??
      source?.portfolio_benchmark?.[key] ??
      source?.executive_scenario?.[key];

    if (value !== null && value !== undefined && value !== '') return value;
  }

  return fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatPercentileLabel(value: unknown) {
  const numeric = toNumber(value, 0);

  if (numeric >= 99) return 'Top 1%';
  if (numeric >= 95) return 'Top 5%';
  if (numeric >= 90) return 'Top 10%';
  if (numeric > 0) return `${numeric.toFixed(1)} percentile`;

  return 'Position pending';
}

function getDrugName(drug: any) {
  return (
    drug?.display_name ||
    drug?.rxnorm_name ||
    drug?.drug_name ||
    drug?.name ||
    drug?.drug?.display_name ||
    drug?.drug?.rxnorm_name ||
    'This medication'
  );
}

function getTier(drug: any) {
  return String(
    valueFrom(
      drug,
      [
        'ehi_v6_tier_label',
        'healthcare_importance_tier',
        'ehi_v6_tier',
        'ehi_tier_label',
        'executive_impact_tier',
        'eis_tier',
        'benchmark_tier',
      ],
      'Enterprise Review',
    ),
  );
}

function getAiStatus(drug: any) {
  const aiScore = toNumber(valueFrom(drug, ['ai_readiness_score', 'ai_score'], 0));

  if (aiScore >= 85) return 'AI Deployment Ready';
  if (aiScore >= 70) return 'AI Ready';
  if (aiScore >= 50) return 'AI Context Developing';

  return 'AI Context Pending';
}

function getClaimsStatus(drug: any) {
  const claimsScore = toNumber(
    valueFrom(drug, ['claims_readiness_score', 'claims_score'], 0),
  );

  const explicitTier = valueFrom(
    drug,
    ['claims_readiness_tier', 'claims_operational_status'],
    null,
  );

  if (explicitTier) return String(explicitTier);
  if (claimsScore >= 80) return 'Operationally Ready';
  if (claimsScore >= 60) return 'Operationally Usable';
  if (claimsScore >= 40) return 'Operational Context Developing';

  return 'Operational Review Needed';
}

function getGraphStatus(drug: any) {
  const connectivity = toNumber(
    valueFrom(drug, ['graph_connectivity_score', 'knowledge_graph_score'], 0),
  );
  const domainCount = toNumber(valueFrom(drug, ['intelligence_domain_count'], 0));

  if (connectivity >= 80 || domainCount >= 10) return 'Strong Connectivity';
  if (connectivity >= 60 || domainCount >= 6) return 'Connected';
  if (connectivity > 0 || domainCount > 0) return 'Foundational Connectivity';

  return 'Graph Context Pending';
}

function getClinicalSnapshot(drug: any) {
  const diseaseFocus = String(
    valueFrom(drug, ['primary_disease_focus'], 'Disease focus pending'),
  );
  const mechanism = String(
    valueFrom(
      drug,
      ['primary_mechanism', 'primary_pharmacologic_class'],
      'Mechanism evidence pending',
    ),
  );

  return { diseaseFocus, mechanism };
}


function getPopulationBurden(drug: any) {
  const population = drug?.population_burden || drug?.drug?.population_burden || drug?.clinical_briefing?.population_burden || {};
  const tier = String(population?.tier || '').trim();
  const primaryCondition = String(population?.primary_condition || population?.primaryCondition || '').trim();
  const benchmark = String(population?.prevalence_benchmark || population?.prevalenceBenchmark || '').trim();
  const narrative = String(population?.narrative || '').trim();

  return {
    available: Boolean(population?.available),
    tier,
    primaryCondition,
    benchmark,
    narrative,
    isHighBurden: ['very high', 'high'].includes(tier.toLowerCase()),
  };
}


function getDiseaseBurdenForecast(drug: any) {
  const forecast = drug?.disease_burden_forecast || drug?.drug?.disease_burden_forecast || {};
  const signal = String(forecast?.trend_signal || forecast?.burden_trend_signal || '').trim();
  const diseaseDomain = String(forecast?.disease_domain || forecast?.canonical_disease_name || '').trim();
  const narrative = String(forecast?.forecast_narrative || '').trim();

  return {
    available: Boolean(forecast?.available),
    signal,
    diseaseDomain,
    narrative,
    isGrowing: ['accelerating', 'growing'].includes(signal.toLowerCase()),
  };
}


function getExecutiveScenario(drug: any) {
  const scenario = drug?.executive_scenario || drug?.drug?.executive_scenario || {};
  return {
    available: Boolean(scenario?.available),
    scenarioName: String(scenario?.scenario_name || 'Scenario intelligence pending'),
    scenarioType: String(scenario?.scenario_type || 'Executive scenario'),
    portfolioImpact: String(scenario?.portfolio_impact || '').trim(),
    diseaseImpact: String(scenario?.disease_impact || '').trim(),
    medicationImpact: String(scenario?.medication_impact || '').trim(),
    executiveRecommendation: String(scenario?.executive_recommendation || '').trim(),
  };
}

function buildExecutiveSummary(drug: any) {
  const drugName = getDrugName(drug);
  const tier = getTier(drug);
  const clinical = getClinicalSnapshot(drug);
  const claimsStatus = getClaimsStatus(drug);
  const aiStatus = getAiStatus(drug);
  const graphStatus = getGraphStatus(drug);
  const portfolioPosition = formatPercentileLabel(
    valueFrom(drug, ['ehi_v6_percentile', 'ehi_percentile', 'portfolio_percentile'], 0),
  );

  const population = getPopulationBurden(drug);
  const diseaseForecast = getDiseaseBurdenForecast(drug);
  const populationPhrase = population.isHighBurden
    ? ` It also addresses a ${population.tier.toLowerCase()} population-burden condition${population.primaryCondition ? ` (${population.primaryCondition})` : ''}, strengthening its real-world disease-burden relevance.`
    : '';
  const forecastPhrase = diseaseForecast.isGrowing
    ? ` Forward-looking burden intelligence flags ${diseaseForecast.diseaseDomain || clinical.diseaseFocus} as ${diseaseForecast.signal.toLowerCase()}, adding future healthcare relevance to the executive case.`
    : '';

  return `${drugName} matters because it combines ${tier.toLowerCase()} enterprise importance with clinically meaningful context in ${clinical.diseaseFocus}. Its profile supports ${claimsStatus.toLowerCase()} claims workflows, ${aiStatus.toLowerCase()} intelligence workflows, ${graphStatus.toLowerCase()} inside the knowledge graph, and ${portfolioPosition.toLowerCase()} strategic positioning across the medication universe.${populationPhrase}${forecastPhrase}`;
}

function buildStrategicBadges(drug: any) {
  const tier = getTier(drug);
  const percentileLabel = formatPercentileLabel(
    valueFrom(drug, ['ehi_v6_percentile', 'ehi_percentile', 'portfolio_percentile'], 0),
  );
  const aiStatus = getAiStatus(drug);
  const claimsStatus = getClaimsStatus(drug);
  const population = getPopulationBurden(drug);
  const diseaseForecast = getDiseaseBurdenForecast(drug);
  const populationBadge = population.isHighBurden ? 'High Population Burden Condition' : null;
  const diseaseForecastBadge = diseaseForecast.isGrowing ? 'Growing Disease Burden' : null;

  const badges = [tier, percentileLabel, populationBadge, diseaseForecastBadge, aiStatus, claimsStatus].filter(
    (value, index, array) => value && array.indexOf(value) === index,
  );

  return badges.slice(0, 5);
}

function buildWhyItMatters(drug: any) {
  const utilization = toNumber(valueFrom(drug, ['utilization_score'], 0));
  const diseaseBurden = Math.max(
    toNumber(valueFrom(drug, ['disease_burden_score'], 0)),
    toNumber(valueFrom(drug, ['cdc_burden_score'], 0)),
  );
  const evidence = toNumber(
    valueFrom(drug, ['external_evidence_score', 'validation_score'], 0),
  );
  const enterprise = Math.max(
    toNumber(valueFrom(drug, ['ehi_v6_score', 'healthcare_importance_score'], 0)),
    toNumber(valueFrom(drug, ['overall_intelligence_score', 'eii_score'], 0)),
  );
  const population = getPopulationBurden(drug);
  const diseaseForecast = getDiseaseBurdenForecast(drug);

  const drivers = [
    {
      label: 'High Utilization',
      detail: 'Medication activity supports enterprise monitoring, utilization analysis, and operational prioritization.',
      active: utilization >= 60,
    },
    {
      label: 'High Disease Burden',
      detail: 'Disease context supports clinical relevance, population-health value, and executive attention.',
      active: diseaseBurden >= 60,
    },
    {
      label: 'High Population Burden Condition',
      detail: population.narrative || 'CDC PLACES prevalence context indicates meaningful real-world disease burden.',
      active: population.isHighBurden,
    },
    {
      label: 'Growing Disease Burden',
      detail: diseaseForecast.narrative || 'Forward-looking disease burden intelligence indicates rising healthcare relevance.',
      active: diseaseForecast.isGrowing,
    },
    {
      label: 'Executive Scenario Insight',
      detail: getExecutiveScenario(drug).portfolioImpact || 'Scenario intelligence connects disease, portfolio, medication, and executive action impacts.',
      active: getExecutiveScenario(drug).available,
    },
    {
      label: 'Strong Evidence Base',
      detail: 'External evidence and validation signals support confident interpretation across workflows.',
      active: evidence >= 60,
    },
    {
      label: 'Enterprise Relevance',
      detail: 'The medication has value across clinical, claims, AI, graph, and portfolio intelligence workspaces.',
      active: enterprise >= 60,
    },
  ];

  const selected = drivers.filter((driver) => driver.active);

  return selected.length ? selected : drivers.slice(0, 4);
}

function buildRecommendedAction(drug: any) {
  const drugName = getDrugName(drug);
  const tier = getTier(drug).toLowerCase();
  const aiStatus = getAiStatus(drug).toLowerCase();
  const claimsStatus = getClaimsStatus(drug).toLowerCase();
  const population = getPopulationBurden(drug);
  const populationClause = population.isHighBurden ? ' population-health burden review,' : '';

  if (tier.includes('critical') || tier.includes('strategic')) {
    return `${drugName} should be prioritized for executive healthcare intelligence workflows, including enterprise analytics, AI deployment, clinical interpretation,${populationClause} claims operationalization, and portfolio strategy initiatives.`;
  }

  if (aiStatus.includes('ready') || claimsStatus.includes('ready')) {
    return `${drugName} should be advanced into targeted deployment workflows where its strongest intelligence signals can support AI, claims, and clinical decision-support use cases.`;
  }

  return `${drugName} should remain in the enterprise intelligence universe while additional evidence, claims assets, and graph relationships are reviewed before broader deployment.`;
}

function SnapshotCard({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
        {label}
      </p>
      <p className="mt-2 text-base font-black text-white">{primary}</p>
      {secondary && (
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
          {secondary}
        </p>
      )}
    </div>
  );
}

function DriverCard({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
      <p className="text-sm font-black text-emerald-100">{label}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
        {detail}
      </p>
    </div>
  );
}

export default function ExecutiveIntelligenceBriefing({ drug }: Props) {
  if (!drug) return null;

  const clinical = getClinicalSnapshot(drug);
  const badges = buildStrategicBadges(drug);
  const whyItMatters = buildWhyItMatters(drug);

  return (
    <section className="space-y-5">
      <EnterpriseHealthcareImportanceCard drug={drug} />

      <section className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/50 p-6 text-white shadow-2xl shadow-cyan-950/10">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
          Executive Intelligence Briefing
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">
          Why this medication matters
        </h2>
        <p className="mt-3 max-w-5xl text-sm font-semibold leading-7 text-slate-300">
          {buildExecutiveSummary(drug)}
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-blue-400/20 bg-slate-950/70 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
            Strategic Position
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100"
              >
                {badge}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">
            Strategic position summarizes the executive answer without repeating
            the detailed metrics that now live in the specialized workspaces.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 text-white">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Intelligence Snapshot
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SnapshotCard
              label="Clinical"
              primary={clinical.diseaseFocus}
              secondary={clinical.mechanism}
            />
            <SnapshotCard label="Claims" primary={getClaimsStatus(drug)} />
            <SnapshotCard label="AI" primary={getAiStatus(drug)} />
            <SnapshotCard label="Knowledge Graph" primary={getGraphStatus(drug)} />
            <SnapshotCard
              label="Portfolio"
              primary={formatPercentileLabel(
                valueFrom(drug, ['ehi_v6_percentile', 'ehi_percentile', 'portfolio_percentile'], 0),
              )}
            />
            {getPopulationBurden(drug).isHighBurden && (
              <SnapshotCard
                label="Population Burden"
                primary={getPopulationBurden(drug).tier}
                secondary={getPopulationBurden(drug).primaryCondition || getPopulationBurden(drug).benchmark}
              />
            )}
            {getDiseaseBurdenForecast(drug).isGrowing && (
              <SnapshotCard
                label="Disease Trend"
                primary={getDiseaseBurdenForecast(drug).signal}
                secondary={getDiseaseBurdenForecast(drug).diseaseDomain || 'Forward-looking burden signal'}
              />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-400/20 bg-slate-950/70 p-5 text-white">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
          Why It Matters
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {whyItMatters.map((driver) => (
            <DriverCard key={driver.label} label={driver.label} detail={driver.detail} />
          ))}
        </div>
      </section>


      {getExecutiveScenario(drug).available && (
        <section className="rounded-3xl border border-amber-300/25 bg-amber-400/10 p-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">
                Executive Scenario Insight
              </p>
              <h3 className="mt-2 text-xl font-black text-white">
                {getExecutiveScenario(drug).scenarioName}
              </h3>
            </div>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">
              {getExecutiveScenario(drug).scenarioType}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <DriverCard label="Portfolio Impact" detail={getExecutiveScenario(drug).portfolioImpact || 'Portfolio impact pending.'} />
            <DriverCard label="Disease Impact" detail={getExecutiveScenario(drug).diseaseImpact || 'Disease impact pending.'} />
            <DriverCard label="Medication Impact" detail={getExecutiveScenario(drug).medicationImpact || 'Medication impact pending.'} />
          </div>
          {getExecutiveScenario(drug).executiveRecommendation && (
            <p className="mt-4 text-sm font-semibold leading-6 text-amber-50">
              {getExecutiveScenario(drug).executiveRecommendation}
            </p>
          )}
        </section>
      )}

      <section className="rounded-3xl border border-cyan-400/20 bg-cyan-400/10 p-5 text-white">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">
          Recommended Executive Action
        </p>
        <p className="mt-3 text-base font-semibold leading-7 text-cyan-50">
          {buildRecommendedAction(drug)}
        </p>
      </section>
    </section>
  );
}
