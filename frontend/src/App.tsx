import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Database, Network, ShieldCheck } from 'lucide-react';

import DrugSearch from './components/DrugSearch';
import EnterpriseIntelligenceDashboard from './components/EnterpriseIntelligenceDashboard';
import IntelligenceCard from './components/IntelligenceCard';
import ClassificationPanel from './components/ClassificationPanel';
import RelationshipPanel from './components/RelationshipPanel';
import GraphPanel from './components/GraphPanel';
import MedicationIntelligenceSummaryCard from './components/MedicationIntelligenceSummaryCard';
import ATCExplorerPage from './components/ATCExplorerPage';
import ATCIntelligenceOverview from './components/ATCIntelligenceOverview';
import DrugIntelligenceWorkspace from './components/DrugIntelligenceWorkspace';

import MedicationReadinessScorecard from './components/MedicationReadinessScorecard';
import ConfidenceScorecard from './components/ConfidenceScorecard';
import PCAMethodologyScorecard from './components/PCAMethodologyScorecard';
import MethodologyConsensusCard from './components/MethodologyConsensusCard';

import ProductionCandidateCard from './components/ProductionCandidateCard';
import ExecutivePortfolioCard from './components/ExecutivePortfolioCard';
import ExecutiveLeaderboardsCard from './components/ExecutiveLeaderboardsCard';
import ExplainabilityEngineCard from './components/ExplainabilityEngineCard';
import ExecutiveRecommendationCard from './components/ExecutiveRecommendationCard';

import StrategicOpportunityCard from './components/StrategicOpportunityCard';
import PortfolioOptimizationCard from './components/PortfolioOptimizationCard';
import AICopilotCard from './components/AICopilotCard';
import EnterpriseDeploymentCard from './components/EnterpriseDeploymentCard';
import WebsiteDeploymentCard from './components/WebsiteDeploymentCard';
import ProductionHardeningCard from './components/ProductionHardeningCard';

import ValidationTrackCard from './components/ValidationTrackCard';
import MethodologySelectionCard from './components/MethodologySelectionCard';
import PublicationReadinessCard from './components/PublicationReadinessCard';
import SafeCardBoundary from './components/SafeCardBoundary';

import { DrugCard, getDrug, getWebsiteSummary, searchDrugs } from './lib/api';

type DashboardPage =
  | 'overview'
  | 'clinical'
  | 'knowledge'
  | 'ai'
  | 'executive'
  | 'production';

type StatProps = {
  icon: React.ReactNode;
  label: string;
  value: string | number;
};

const DASHBOARD_TABS: Array<{
  id: DashboardPage;
  label: string;
  description: string;
}> = [
  { id: 'overview', label: 'Overview', description: 'Executive snapshot + medication identity' },
  { id: 'clinical', label: 'Clinical', description: 'ATC, disease, MOA, EPC, and peer intelligence' },
  { id: 'knowledge', label: 'Knowledge Graph', description: 'Graph structure + RxNorm relationships' },
  { id: 'ai', label: 'AI Intelligence', description: 'Explainability, readiness, confidence, and methods' },
  { id: 'executive', label: 'Executive', description: 'Portfolio, leaderboards, and recommendations' },
  { id: 'production', label: 'Production', description: 'Deployment, validation, and publication readiness' },
];

const POPULAR_SEARCHES = [
  'Atorvastatin Calcium',
  'Levothyroxine Sodium',
  'Amlodipine Besylate',
  'Gabapentin',
  'Metformin HCl',
  'Semaglutide',
];


function formatMetric(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';

  const numeric = Number(value);

  if (Number.isFinite(numeric)) {
    return numeric.toLocaleString(undefined, {
      maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
    });
  }

  return String(value);
}

function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-300">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-black text-white">{formatMetric(value)}</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function PageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-blue-900/40 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight">{title}</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">{description}</p>
      </div>
      {children}
    </section>
  );
}

function PlaceholderPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">Workspace</p>
      <h3 className="mt-2 text-2xl font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}


type ExecutiveMedicationSummaryProps = {
  drug: any | null;
};

function ExecutiveMedicationSummary({ drug }: ExecutiveMedicationSummaryProps) {
  if (!drug) return null;

  const name =
    drug.rxnorm_name ||
    drug.drug_name ||
    drug.name ||
    drug.drug?.rxnorm_name ||
    drug.drug?.drug_name ||
    'This medication';

  const tier =
    drug.benchmark_tier ||
    drug.tier ||
    drug.scorecard?.benchmark_tier ||
    drug.drug?.benchmark_tier ||
    'Unclassified';

  const classifications = drug.classifications || drug.drug?.classifications || {};

  const atcDepth =
    drug.atc_hierarchy_depth ||
    drug.atc_depth ||
    drug.classification_atc_max_depth ||
    ['ATC1', 'ATC2', 'ATC3', 'ATC4'].filter(
      (bucket) => Array.isArray(classifications[bucket]) && classifications[bucket].length > 0
    ).length;

  const totalClassifications =
    drug.classification_count ||
    drug.total_classifications ||
    drug.classification_record_count ||
    Object.entries(classifications).reduce(
      (sum: number, [key, value]: [string, any]) =>
        key === 'counts' ? sum : sum + (Array.isArray(value) ? value.length : 0),
      0
    );

  const domainCount =
    drug.class_type_count ||
    drug.classification_class_type_count ||
    Object.entries(classifications).filter(
      ([key, value]) => key !== 'counts' && Array.isArray(value) && value.length > 0
    ).length;

  const diseaseCount =
    drug.disease_count ||
    drug.classification_DISEASE_count ||
    (Array.isArray(classifications.DISEASE) ? classifications.DISEASE.length : 0);

  const overall =
    drug.overall_intelligence_score ||
    drug.scorecard?.overall_intelligence_score ||
    drug.drug?.overall_intelligence_score ||
    '—';

  const claims =
    drug.claims_readiness_score ||
    drug.scorecard?.claims_readiness_score ||
    drug.drug?.claims_readiness_score ||
    '—';

  const ai =
    drug.ai_readiness_score ||
    drug.scorecard?.ai_readiness_score ||
    drug.drug?.ai_readiness_score ||
    '—';

  const semantic =
    drug.semantic_richness_score ||
    drug.scorecard?.semantic_richness_score ||
    drug.drug?.semantic_richness_score ||
    '—';

  const interoperability =
    drug.interoperability_score ||
    drug.scorecard?.interoperability_score ||
    drug.drug?.interoperability_score ||
    '—';

  return (
    <section className="rounded-3xl border border-blue-900/50 bg-slate-900/70 p-6 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-blue-300">
        Executive Summary
      </p>

      <h3 className="mt-2 text-2xl font-black text-white">
        Medication Intelligence Executive Brief
      </h3>

      <p className="mt-5 text-base font-medium leading-8 text-slate-200">
        {name} demonstrates {tier}-tier medication intelligence maturity with an
        overall intelligence score of {overall}. Its claims readiness score of {claims},
        AI readiness score of {ai}, semantic richness score of {semantic}, and
        interoperability score of {interoperability} summarize its ability to support
        claims analytics, standardized reporting, explainability, and downstream AI
        workflows. The classification layer contains {totalClassifications} mapped
        records across {domainCount} populated intelligence domains, including a
        {` ${atcDepth}/4 `}ATC hierarchy and {diseaseCount} disease association
        mapping{diseaseCount === 1 ? '' : 's'}. The therapeutic pathway translates
        the ATC hierarchy into an executive-readable clinical positioning view from
        broad therapeutic group through more specific pharmacologic and chemical
        subgroup context. The knowledge graph and relationship layers show how
        RxNorm concepts, classifications, and related metadata connect into a broader
        medication intelligence footprint. NDC intelligence supports pharmacy claims
        crosswalks, package identifier review, operational reporting, and production
        analytics readiness. Together, these signals position {name} as a structured
        medication intelligence asset for enterprise dashboards, clinical-semantic
        interpretation, claims-readiness evaluation, and publication-quality validation
        workflows.
      </p>
    </section>
  );
}

  export default function App() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<DrugCard[]>([]);
    const [selected, setSelected] = useState<DrugCard | null>(null);
    const [detail, setDetail] = useState<any | null>(null);
    const [summary, setSummary] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeDashboardPage, setActiveDashboardPage] =
      useState<DashboardPage>('overview');
    const [activeAtcCode, setActiveAtcCode] = useState<string | null>(null);

    const latestDrugLoadId = useRef(0);

    const selectDrugAndLoad = async (
      drug: DrugCard,
      targetPage: DashboardPage = 'overview'
    ) => {
      if (!drug?.rxcui) return;

      const rxcui = String(drug.rxcui);
      const loadId = latestDrugLoadId.current + 1;
      latestDrugLoadId.current = loadId;

      const nextName =
        (drug as any).drug_name ||
        (drug as any).rxnorm_name ||
        (drug as any).display_name ||
        (drug as any).name ||
        '';

      const fallbackDrug = {
        ...drug,
        rxcui,
        drug_name: nextName,
        rxnorm_name: nextName,
      } as DrugCard;

      setActiveDashboardPage(targetPage);
      setActiveAtcCode(null);
      setDetail(null);

      try {
        setLoading(true);

        const data = await getDrug(rxcui);

        if (latestDrugLoadId.current !== loadId) return;

        const hydratedDrug = {
          ...fallbackDrug,
          ...(data || {}),
          ...(data?.drug || {}),
          ...(data?.scorecard || {}),
          rxcui: data?.rxcui || data?.drug?.rxcui || fallbackDrug.rxcui,
          drug_name:
            data?.drug?.drug_name ||
            data?.drug?.rxnorm_name ||
            data?.drug_name ||
            data?.rxnorm_name ||
            fallbackDrug.drug_name,
          rxnorm_name:
            data?.drug?.rxnorm_name ||
            data?.drug?.drug_name ||
            data?.rxnorm_name ||
            data?.drug_name ||
            fallbackDrug.rxnorm_name,
          classifications: data?.classifications || data?.drug?.classifications || {},
          relationships: data?.relationships || data?.drug?.relationships || {},
          primary_therapeutic_pathway:
            data?.primary_therapeutic_pathway ||
            data?.drug?.primary_therapeutic_pathway ||
            null,
          medication_intelligence_summary:
            data?.medication_intelligence_summary ||
            data?.drug?.medication_intelligence_summary ||
            null,
          therapeutic_narrative:
            data?.therapeutic_narrative ||
            data?.drug?.therapeutic_narrative ||
            null,
          graph_intelligence:
            data?.graph_intelligence ||
            data?.drug?.graph_intelligence ||
            null,
          claims_readiness_layer:
            data?.claims_readiness_layer ||
            data?.drug?.claims_readiness_layer ||
            null,
          graph: data?.graph || data?.drug?.graph || { nodes: [], edges: [] },
          graph_metrics: data?.graph_metrics || data?.graph?.metrics || {},
        } as DrugCard;

        setSelected(hydratedDrug);
        setDetail(data);

        const hydratedName =
          (hydratedDrug as any).drug_name ||
          (hydratedDrug as any).rxnorm_name ||
          (hydratedDrug as any).display_name ||
          nextName;

        if (hydratedName) {
          setQuery(String(hydratedName));
        }
      } catch (error) {
        console.error('Drug detail failed after selection', error);

        if (latestDrugLoadId.current === loadId) {
          setSelected(fallbackDrug);
          setDetail(null);
        }
      } finally {
        if (latestDrugLoadId.current === loadId) {
          setLoading(false);
        }
      }
    };

    useEffect(() => {
      let cancelled = false;

      async function loadSummary() {
        try {
          const data = await getWebsiteSummary();
          if (!cancelled) setSummary(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error('Unable to load website summary', error);
        }
      }

      loadSummary();

      return () => {
        cancelled = true;
      };
    }, []);

    useEffect(() => {
      let cancelled = false;

      async function runSearch() {
        setLoading(true);

        try {
          const term = query.trim();

          if (!term) {
            setResults([]);
            setLoading(false);
            return;
          }

          const data = await searchDrugs(term, 30);

          if (!cancelled) {
            const nextResults = Array.isArray(data) ? data : [];
            setResults(nextResults);


          }
        } catch (error) {
          console.error('Search failed', error);
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      const handle = window.setTimeout(runSearch, 250);

      return () => {
        cancelled = true;
        window.clearTimeout(handle);
      };
    }, [query]);

  useEffect(() => {
    if (!selected?.rxcui) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      const selectedRxcui = String(selected.rxcui);
      const detailRxcui = String(detail?.rxcui || detail?.drug?.rxcui || '');

      if (detailRxcui === selectedRxcui) {
        return;
      }

      try {
        const data = await getDrug(selectedRxcui);

        if (!cancelled) {
          setDetail(data);
          setSelected((current) => {
            if (!current || String(current.rxcui) !== selectedRxcui) return current;

            return {
              ...current,
              ...(data || {}),
              ...(data?.drug || {}),
              ...(data?.scorecard || {}),
              rxcui: data?.rxcui || data?.drug?.rxcui || current.rxcui,
              classifications: data?.classifications || data?.drug?.classifications || {},
              relationships: data?.relationships || data?.drug?.relationships || {},
              primary_therapeutic_pathway:
                data?.primary_therapeutic_pathway ||
                data?.drug?.primary_therapeutic_pathway ||
                null,
              medication_intelligence_summary:
                data?.medication_intelligence_summary ||
                data?.drug?.medication_intelligence_summary ||
                null,
              therapeutic_narrative:
                data?.therapeutic_narrative ||
                data?.drug?.therapeutic_narrative ||
                null,
              graph_intelligence:
                data?.graph_intelligence ||
                data?.drug?.graph_intelligence ||
                null,
              claims_readiness_layer:
                data?.claims_readiness_layer ||
                data?.drug?.claims_readiness_layer ||
                null,
              graph: data?.graph || data?.drug?.graph || { nodes: [], edges: [] },
              graph_metrics: data?.graph_metrics || data?.graph?.metrics || {},
            } as DrugCard;
          });
        }
      } catch (error) {
        console.error('Drug detail failed', error);

        if (!cancelled) {
          setDetail(null);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selected?.rxcui, detail?.rxcui, detail?.drug?.rxcui]);

  const activeDrug: DrugCard | null = selected;

  const drugWithDetails: any = activeDrug
    ? {
        ...(selected || {}),
        ...(activeDrug || {}),
        ...(detail || {}),
        ...(detail?.drug || {}),
        ...(detail?.scorecard || {}),

        rxcui: detail?.rxcui || detail?.drug?.rxcui || selected?.rxcui || activeDrug.rxcui,

        rxnorm_name:
          detail?.drug?.rxnorm_name ||
          detail?.drug?.drug_name ||
          detail?.rxnorm_name ||
          detail?.drug_name ||
          (selected as any)?.rxnorm_name ||
          (selected as any)?.drug_name ||
          (activeDrug as any)?.rxnorm_name ||
          (activeDrug as any)?.drug_name,

        drug_name:
          detail?.drug?.drug_name ||
          detail?.drug?.rxnorm_name ||
          detail?.drug_name ||
          detail?.rxnorm_name ||
          (selected as any)?.drug_name ||
          (selected as any)?.rxnorm_name ||
          (activeDrug as any)?.drug_name ||
          (activeDrug as any)?.rxnorm_name,

        classifications:
          detail?.classifications ||
          detail?.drug?.classifications ||
          (selected as any)?.classifications ||
          (activeDrug as any)?.classifications ||
          {},

        relationships:
          detail?.relationships ||
          detail?.drug?.relationships ||
          {},

        primary_therapeutic_pathway:
          detail?.primary_therapeutic_pathway ||
          detail?.drug?.primary_therapeutic_pathway ||
          null,

        medication_intelligence_summary:
          detail?.medication_intelligence_summary ||
          detail?.drug?.medication_intelligence_summary ||
          null,

        therapeutic_narrative:
          detail?.therapeutic_narrative ||
          detail?.drug?.therapeutic_narrative ||
          null,

        graph_intelligence:
          detail?.graph_intelligence ||
          detail?.drug?.graph_intelligence ||
          null,

        claims_readiness_layer:
          detail?.claims_readiness_layer ||
          detail?.drug?.claims_readiness_layer ||
          null,

        graph:
          detail?.graph ||
          detail?.drug?.graph ||
          { nodes: [], edges: [] },

        graph_metrics:
          detail?.graph_metrics ||
          detail?.graph?.metrics ||
          {},

        drug: {
          ...(selected || {}),
          ...(activeDrug || {}),
          ...(detail?.drug || {}),
          classifications: detail?.classifications || detail?.drug?.classifications || {},
          relationships: detail?.relationships || detail?.drug?.relationships || {},
          primary_therapeutic_pathway:
            detail?.primary_therapeutic_pathway ||
            detail?.drug?.primary_therapeutic_pathway ||
            null,
          medication_intelligence_summary:
            detail?.medication_intelligence_summary ||
            detail?.drug?.medication_intelligence_summary ||
            null,
          therapeutic_narrative:
            detail?.therapeutic_narrative ||
            detail?.drug?.therapeutic_narrative ||
            null,
          graph_intelligence:
            detail?.graph_intelligence ||
            detail?.drug?.graph_intelligence ||
            null,
          claims_readiness_layer:
            detail?.claims_readiness_layer ||
            detail?.drug?.claims_readiness_layer ||
            null,
          graph: detail?.graph || detail?.drug?.graph || { nodes: [], edges: [] },
        },
      }
    : null;

  console.log('DETAIL OBJECT:', detail);
  console.log('DETAIL CLASSIFICATIONS:', detail?.classifications);
  console.log('DRUG WITH DETAILS CLASSIFICATIONS:', drugWithDetails?.classifications);
  console.log(
    'THERAPEUTIC NARRATIVE',
    drugWithDetails?.therapeutic_narrative
  );

  console.log(
    'MEDICATION SUMMARY',
    drugWithDetails?.medication_intelligence_summary
  );

  console.log(
    'GRAPH INTELLIGENCE',
    drugWithDetails?.graph_intelligence
  );

  console.log(
    'CLAIMS READINESS',
    drugWithDetails?.claims_readiness_layer
  );
  const summaryMap = useMemo(() => {
  const map: Record<string, string | number> = {};

  summary.forEach((item: any) => {
    if (item.metric_name) map[item.metric_name] = item.metric_value;
    if (item.metric) map[item.metric] = item.value;
  });

    return map;
  }, [summary]);

  const selectedName =
    (drugWithDetails as any)?.display_name ||
    (drugWithDetails as any)?.rxnorm_name ||
    (drugWithDetails as any)?.drug_name ||
    (drugWithDetails as any)?.name ||
    (activeDrug as any)?.display_name ||
    (activeDrug as any)?.rxnorm_name ||
    (activeDrug as any)?.drug_name ||
    (activeDrug as any)?.name ||
    'No medication selected';

  const activeTab =
    DASHBOARD_TABS.find((tab) => tab.id === activeDashboardPage) ||
    DASHBOARD_TABS[0];

  const activePageDescription =
    activeDashboardPage === 'overview'
      ? 'Unified medication intelligence scorecard combining interoperability, classification, semantic, and AI-readiness signals into a single enterprise view.'
      : activeTab.description;
  const classificationBuckets =
    detail?.classifications && Object.keys(detail.classifications).length > 0
      ? detail.classifications
      : drugWithDetails?.classifications || {};

  const getBucketCount = (bucket: string) =>
    Array.isArray(classificationBuckets[bucket])
      ? classificationBuckets[bucket].length
      : 0;

  const calculatedAtcDepth = ['ATC1', 'ATC2', 'ATC3', 'ATC4'].filter(
    (bucket) => getBucketCount(bucket) > 0
  ).length;

  const calculatedTotalClassifications = Object.entries(classificationBuckets).reduce(
    (sum: number, [key, value]: [string, any]) => {
      if (key === 'counts') return sum;
      return sum + (Array.isArray(value) ? value.length : 0);
    },
    0
  );

  const calculatedClassTypeCount = Object.entries(classificationBuckets).filter(
    ([key, value]) => key !== 'counts' && Array.isArray(value) && value.length > 0
  ).length;

  const calculatedClinicalSignals =
    getBucketCount('MOA') +
    getBucketCount('EPC') +
    getBucketCount('DISEASE') +
    getBucketCount('PE') +
    getBucketCount('VA');

  const atcDepthMetric =
    calculatedAtcDepth ||
    Number(detail?.drug?.atc_hierarchy_depth) ||
    Number(detail?.drug?.classification_atc_max_depth) ||
    Number(drugWithDetails?.atc_hierarchy_depth) ||
    Number(drugWithDetails?.classification_atc_max_depth) ||
    0;

  const totalClassificationsMetric =
    calculatedTotalClassifications ||
    Number(detail?.drug?.classification_count) ||
    Number(detail?.drug?.classification_record_count) ||
    Number(detail?.drug?.classification_count_for_scoring) ||
    Number(drugWithDetails?.classification_count) ||
    Number(drugWithDetails?.classification_record_count) ||
    Number(drugWithDetails?.classification_count_for_scoring) ||
    0;

  const classTypeCountMetric =
    calculatedClassTypeCount ||
    Number(detail?.drug?.class_type_count) ||
    Number(detail?.drug?.classification_class_type_count) ||
    Number(detail?.drug?.class_type_count_for_scoring) ||
    Number(drugWithDetails?.class_type_count) ||
    Number(drugWithDetails?.classification_class_type_count) ||
    Number(drugWithDetails?.class_type_count_for_scoring) ||
    0;

  console.log('calculatedClassTypeCount', calculatedClassTypeCount);
  console.log(
    'backend class_type_count_for_scoring',
    detail?.drug?.class_type_count_for_scoring
  );
  console.log(
    'final classTypeCountMetric',
    classTypeCountMetric
  );

  const clinicalSignalsMetric =
    calculatedClinicalSignals ||
    Number(detail?.drug?.clinical_semantic_count) ||
    Number(detail?.drug?.classification_DISEASE_count) ||
    Number(drugWithDetails?.clinical_semantic_count) ||
    Number(drugWithDetails?.classification_DISEASE_count) ||
    0;

  console.log('classificationBuckets', classificationBuckets);

  console.log('ATC1', getBucketCount('ATC1'));
  console.log('ATC2', getBucketCount('ATC2'));
  console.log('ATC3', getBucketCount('ATC3'));
  console.log('ATC4', getBucketCount('ATC4'));

  console.log('calculatedAtcDepth', calculatedAtcDepth);
  console.log('calculatedTotalClassifications', calculatedTotalClassifications);
  console.log('calculatedClinicalSignals', calculatedClinicalSignals);


  const classificationPanelDrug = drugWithDetails
    ? {
        ...drugWithDetails,
        classifications: classificationBuckets,
      }
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-blue-950/60 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.20),_transparent_35%),linear-gradient(135deg,#020617,#0f172a_50%,#020617)]">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-[2rem] border border-blue-900/50 bg-slate-950/70 p-8 shadow-2xl shadow-blue-950/30 backdrop-blur">
            <div className="flex flex-col items-left text-left">
              <div className="mb-6">
                <img
                  src="/logo-cont.png"
                  alt="Alex Knows AI"
                  className="h-32 w-auto object-contain"
                />
              </div>

              <h1 className="mt-4 max-w-5xl text-5xl font-black tracking-tight text-white md:text-6xl">
                RxNorm Intelligence Explorer
              </h1>

              <p className="mt-5 max-w-5xl text-xl leading-8 text-slate-300">
                A medication interoperability workspace for RxNorm identity, ATC hierarchy,
                NDC claims mapping, AI-ready analytics, executive intelligence, and
                research-grade validation.
              </p>
            </div>
            <div className="mt-10 rounded-3xl border border-blue-900/50 bg-slate-900/70 p-6">
              <h2 className="text-xl font-black text-white">Search Medication</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                Explore standardized medication intelligence across RxCUI, RxNorm concepts, ATC classes, NDC identifiers, claims-readiness, and publication validation layers.
              </p>

              <div className="mt-5">
                <DrugSearch
                  query={query}
                  onQueryChange={(value) => {
                    setQuery(value);
                    setActiveDashboardPage('overview');
                    setActiveAtcCode(null);
                  }}
                  results={results}
                  selected={selected}
                  onSelect={(drug) => {
                    selectDrugAndLoad(drug, 'overview');
                  }}
                  loading={loading}
                />
              </div>
              <div className="mt-6">
                <p className="text-center text-xs font-black uppercase tracking-[0.24em] text-slate-300">
                  Popular Medication Searches
                </p>

                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  {POPULAR_SEARCHES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSelected(null);
                        setDetail(null);
                        setQuery(item);
                        setResults([]);
                        setActiveDashboardPage('overview');
                        setActiveAtcCode(null);
                      }}
                      className="rounded-2xl border border-blue-800/70 bg-blue-950/40 px-5 py-3 text-sm font-black text-blue-100 transition hover:border-blue-400 hover:bg-blue-900/60"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {activeDrug && activeAtcCode && (
        <ATCExplorerPage
          drug={drugWithDetails}
          atcCode={activeAtcCode}
          onBackToDrug={() => setActiveAtcCode(null)}
          onSelectAtc={(code) => setActiveAtcCode(code)}
          onSelectDrug={(similarDrug) => {
            setResults([]);
            setActiveAtcCode(null);
            selectDrugAndLoad(similarDrug as any, 'clinical');
          }}
        />
      )}

      {activeDrug && !activeAtcCode && (
        <section className="mx-auto max-w-7xl space-y-8 px-6 py-8">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 text-white">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">
                  Selected Medication
                </p>
                <h2 className="mt-1 text-3xl font-black">{selectedName}</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-black text-white">
                  RxCUI {activeDrug.rxcui}
                </span>

                {(activeDrug as any).tty && (
                  <span className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs font-black text-white">
                    {(activeDrug as any).tty}
                  </span>
                )}

                {((activeDrug as any).benchmark_tier || (activeDrug as any).tier) && (
                  <span className="rounded-full border border-blue-400 bg-blue-500 px-3 py-1 text-xs font-black text-white">
                    {(activeDrug as any).benchmark_tier || (activeDrug as any).tier}
                  </span>
                )}
              </div>
            </div>
          </div>

          <ATCIntelligenceOverview
            drug={drugWithDetails}
            onSelectAtc={(code) => {
              setActiveAtcCode(code);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          <DrugIntelligenceWorkspace
            drug={drugWithDetails}
            onSelectSimilarDrug={(similarDrug) => {
              setResults([]);
              setActiveAtcCode(null);
              selectDrugAndLoad(similarDrug as any, 'clinical');
            }}
          />
        </section>
      )}
    </main>
  );
}