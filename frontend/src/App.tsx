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

function BrandActionableA() {
  return (
    <span className="ak-brand-letter ak-brand-letter-a" aria-hidden="true">
      <svg className="ak-brand-glyph ak-brand-glyph-a" viewBox="0 10 112 88" role="img">
        <defs>
          <linearGradient id="akActionableAGradient" x1="18" y1="92" x2="92" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="38%" stopColor="#0ea5e9" />
            <stop offset="74%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          <filter id="akActionableASoftGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.55  0 0 0 0 1  0 0 0 0.48 0" result="blueGlow" />
            <feMerge><feMergeNode in="blueGlow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g className="ak-network ak-network-a">
          <path d="M5 82 L20 82 L34 70 L48 72 L61 55 L72 47" />
          <path d="M16 58 L31 60 L43 48 L55 52 L66 35" />
          <path d="M24 34 L38 40 L50 31 L65 34" />
          <path d="M38 83 L38 62 L50 52" />
          <path d="M54 72 L66 68 L78 79" />
          <circle cx="5" cy="82" r="2.5" /><circle cx="20" cy="82" r="3" /><circle cx="34" cy="70" r="3.6" />
          <circle cx="48" cy="72" r="2.7" /><circle cx="61" cy="55" r="3.3" /><circle cx="72" cy="47" r="2.8" />
          <circle cx="16" cy="58" r="2.4" /><circle cx="31" cy="60" r="3" /><circle cx="43" cy="48" r="2.5" />
          <circle cx="55" cy="52" r="2.9" /><circle cx="66" cy="35" r="2.3" /><circle cx="24" cy="34" r="2.2" />
          <circle cx="38" cy="40" r="2.7" /><circle cx="50" cy="31" r="2.2" /><circle cx="65" cy="34" r="2.9" />
          <circle cx="38" cy="83" r="2.1" /><circle cx="54" cy="72" r="2.5" /><circle cx="78" cy="79" r="2.1" />
        </g>
        <g filter="url(#akActionableASoftGlow)">
          <path d="M18 94 L72 16 L83 16 L83 94 L68 94 L68 50 L35 94 Z" fill="url(#akActionableAGradient)" />
          <path d="M48 74 L68 46 L68 74 Z" fill="#03101f" opacity="0.9" />
        </g>
      </svg>
    </span>
  );
}

function BrandIntelligenceI() {
  return (
    <span className="ak-brand-letter ak-brand-letter-i" aria-hidden="true">
      <svg className="ak-brand-glyph ak-brand-glyph-i" viewBox="0 12 58 86" role="img">
        <defs>
          <linearGradient id="akIntelligenceIGradient" x1="8" y1="96" x2="48" y2="14" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22d3ee" /><stop offset="26%" stopColor="#2563eb" />
            <stop offset="58%" stopColor="#6366f1" /><stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <filter id="akIntelligenceISoftGlow" x="-45%" y="-40%" width="190%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.26  0 0 0 0 0.20  0 0 0 0 1  0 0 0 0.42 0" result="violetGlow" />
            <feMerge><feMergeNode in="violetGlow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g className="ak-network ak-network-i">
          <path d="M3 88 L14 79 L25 82 L36 64" /><path d="M7 61 L19 61 L30 48 L43 42" /><path d="M19 34 L31 38 L43 25" />
          <circle cx="3" cy="88" r="2.2" /><circle cx="14" cy="79" r="2.6" /><circle cx="25" cy="82" r="2.2" />
          <circle cx="36" cy="64" r="2.7" /><circle cx="7" cy="61" r="2.2" /><circle cx="19" cy="61" r="2.7" />
          <circle cx="30" cy="48" r="2.3" /><circle cx="43" cy="42" r="2.4" /><circle cx="19" cy="34" r="2.1" />
          <circle cx="31" cy="38" r="2.3" /><circle cx="43" cy="25" r="2.2" />
        </g>
        <path d="M26 17 H45 L29 95 H10 Z" fill="url(#akIntelligenceIGradient)" filter="url(#akIntelligenceISoftGlow)" />
        <path d="M13 84 L29 18 H36 L22 84 Z" fill="#38bdf8" opacity="0.18" />
      </svg>
    </span>
  );
}

const HERO_BRANDING_STYLES = `
  .ak-hero-section { background: radial-gradient(circle at 50% -8%, rgba(37,99,235,.22), transparent 37%), radial-gradient(circle at 12% 8%, rgba(14,165,233,.12), transparent 24%), linear-gradient(135deg,#020617 0%,#0a1225 48%,#020617 100%); }
  .ak-hero-card { min-height: clamp(620px,52vw,760px); background: radial-gradient(circle at 50% 0%, rgba(30,64,175,.15), transparent 34%), radial-gradient(circle at 10% 8%, rgba(14,165,233,.06), transparent 28%), linear-gradient(145deg,rgba(2,6,23,.97),rgba(8,15,34,.95)); border-color: rgba(37,99,235,.46); box-shadow: 0 32px 90px rgba(2,6,23,.78), 0 0 46px rgba(37,99,235,.13), inset 0 1px 0 rgba(148,163,184,.07); }
  .ak-logo-frame { background: linear-gradient(145deg,rgba(2,6,23,.78),rgba(6,13,30,.72)); border-color: rgba(14,165,233,.22); box-shadow: 0 0 18px rgba(14,165,233,.06), inset 0 1px 0 rgba(148,163,184,.06); }
  .ak-hero-logo { filter: drop-shadow(0 0 14px rgba(56,189,248,.14)); }
  .ak-logo-title { display: inline-flex; align-items: flex-end; justify-content: center; line-height: .92; }
  .ak-logo-ai-word { display: inline-flex; align-items: flex-end; justify-content: center; gap: 0; margin-left: .22em; line-height: .92; }
  .ak-logo-ai-word .ak-brand-letter-a { width: 1em; height: .96em; margin-right: -0.2em; }
  .ak-logo-ai-word .ak-brand-letter-i { width: .54em; height: .96em; margin-right: 0; }
  .ak-hero-title { text-shadow: 0 12px 34px rgba(15,23,42,.78); letter-spacing: -.058em; }
  /* Ruler-baseline subtitle alignment: every visible letter sits on the same bottom edge. */
  .ak-hero-subtitle { color: rgba(203,213,225,.88); letter-spacing: -.047em; text-shadow: 0 0 24px rgba(148,163,184,.11); display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: center; gap: .17em; line-height: .86; }
  .ak-subtitle-word, .ak-ai-word { display: inline-flex; align-items: flex-end; white-space: nowrap; line-height: .86; }
  .ak-ai-word { gap: 0; }
  .ak-brand-letter { position: relative; display: inline-flex; align-items: flex-end; justify-content: center; align-self: flex-end; flex: 0 0 auto; line-height: .86; vertical-align: text-bottom; transform: none; }
  .ak-brand-letter-a { width: 1.04em; height: .86em; margin-right: -0.14em; }
  .ak-brand-letter-i { width: .58em; height: .86em; margin-right: -0.11em; }
  .ak-brand-glyph { display: block; width: 100%; height: 100%; overflow: visible; }
  .ak-network { fill: none; stroke-linecap: round; stroke-linejoin: round; opacity: .74; }
  .ak-network path { stroke-width: 1.05; }
  .ak-network circle { stroke: none; }
  .ak-network-a path { stroke: rgba(56,189,248,.58); }
  .ak-network-a circle { fill: rgba(14,165,233,.9); filter: drop-shadow(0 0 2px rgba(56,189,248,.42)); }
  .ak-network-i path { stroke: rgba(139,92,246,.54); }
  .ak-network-i circle { fill: rgba(124,58,237,.88); filter: drop-shadow(0 0 2px rgba(139,92,246,.38)); }
  .ak-search-card { background: radial-gradient(circle at 50% -18%, rgba(37,99,235,.18), transparent 40%), linear-gradient(145deg,rgba(15,23,42,.9),rgba(2,6,23,.72)); border-color: rgba(34,211,238,.34); box-shadow: 0 22px 70px rgba(2,6,23,.34), 0 0 34px rgba(14,165,233,.07), inset 0 1px 0 rgba(148,163,184,.1); }
  @media (max-width: 1024px) { .ak-hero-card { min-height: auto; } .ak-hero-title { letter-spacing: -.05em; } .ak-hero-subtitle { letter-spacing: -.04em; } }
  @media (max-width: 768px) { .ak-hero-subtitle { gap: .12em; } .ak-brand-letter-a { width: .96em; height: 1em; } .ak-brand-letter-i { width: .52em; height: 1em; } }
`;

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
      <style>{HERO_BRANDING_STYLES}</style>

      <section className="ak-hero-section border-b border-blue-950/60">
        <div className="mx-auto max-w-[1640px] px-6 py-9 md:px-8 md:py-12">
          <div className="ak-hero-card rounded-[2.15rem] border p-7 shadow-2xl backdrop-blur md:p-10 lg:p-12">
            <div className="ak-logo-frame inline-flex flex-col items-center rounded-[1.1rem] border bg-black/25 px-5 py-4 backdrop-blur-md">
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.45rem] bg-transparent lg:h-28 lg:w-28">
                <img
                  src="/favcon.png"
                  alt="Alex Knows AI"
                  className="ak-hero-logo h-full w-full scale-[1.22] object-cover mix-blend-lighten"
                />
              </div>

              <p className="ak-logo-title mt-3 text-center text-[15px] font-black uppercase tracking-[0.2em] text-white lg:text-[17px]">
                <span>ALEX KNOWS</span>
                <span className="ak-logo-ai-word">
                  <BrandActionableA />
                  <BrandIntelligenceI />
                </span>
              </p>

              <p className="mt-1 text-center text-[9px] font-bold uppercase tracking-[0.22em] text-white/70 lg:text-[10px]">
                DATA. INTELLIGENCE. IMPACT.
              </p>

              {/* TODO (Branding Roadmap): replace /favcon.png with native SVG for sharper scaling, better glow control, animation support, and long-term maintainability. */}
            </div>

            <div className="mt-14 flex flex-col items-center text-center md:mt-16 lg:mt-[4.5rem]">
              <h1 className="ak-hero-title max-w-[1450px] text-center text-[clamp(3.4rem,6.4vw,7.6rem)] font-black leading-[0.94] text-white">
                Healthcare Intelligence Engine
              </h1>

              <p className="ak-hero-subtitle mt-10 max-w-[1450px] text-center text-[clamp(2.15rem,4.05vw,4.8rem)] font-light leading-none">
                <span className="ak-subtitle-word">Transforming</span>
                <span className="ak-subtitle-word">Data</span>
                <span className="ak-subtitle-word">Into</span>
                <span className="ak-ai-word">
                  <BrandActionableA />
                  <span>ctionable</span>
                </span>
                <span className="ak-ai-word">
                  <BrandIntelligenceI />
                  <span>ntelligence</span>
                </span>
              </p>
            </div>

            <div className="ak-search-card mt-14 rounded-[1.85rem] border p-7 md:mt-16 md:p-10">
              <h2 className="text-xl font-black text-white md:text-2xl">Search Medication</h2>
              <p className="mt-3 max-w-6xl text-sm leading-6 text-slate-300 md:text-base md:leading-7">
                Explore standardized medication intelligence across RxCUI, RxNorm concepts, ATC classes, NDC identifiers, claims-readiness, and publication validation layers.
              </p>

              <div className="mt-6">
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

              <div className="mt-7">
                <p className="text-center text-xs font-black uppercase tracking-[0.28em] text-slate-300">
                  Popular Medication Searches
                </p>

                <div className="mt-5 flex flex-wrap justify-center gap-3">
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