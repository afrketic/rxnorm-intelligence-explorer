import { useEffect, useRef, useState } from 'react';
import { Activity, Brain, Building2, Database, Network, ShieldCheck } from 'lucide-react';

import DrugSearch from './components/DrugSearch';
import ATCExplorerPage from './components/ATCExplorerPage';
import ATCIntelligenceOverview from './components/ATCIntelligenceOverview';
import DrugIntelligenceWorkspace from './components/DrugIntelligenceWorkspace';
import ExecutiveAssessmentCard from './components/ExecutiveAssessmentCard';

import { DrugCard, getDrug, getWebsiteSummary, searchDrugs } from './lib/api';

type WorkspaceTab =
  | 'overview'
  | 'claims'
  | 'ai'
  | 'clinical'
  | 'knowledge'
  | 'enterprise';

const WORKSPACE_TABS = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Executive snapshot + medication identity',
    icon: Activity,
  },
  {
    id: 'claims',
    label: 'Claims Readiness',
    description: 'Enterprise analytics readiness',
    icon: Database,
  },
  {
    id: 'ai',
    label: 'AI Readiness',
    description: 'Explainability, semantic richness, confidence, methods',
    icon: Brain,
  },
  {
    id: 'clinical',
    label: 'Clinical Intelligence',
    description: 'ATC, disease, MOA, EPC, and peers',
    icon: ShieldCheck,
  },
  {
    id: 'knowledge',
    label: 'Knowledge Graph',
    description: 'Graph structure + RxNorm relationships',
    icon: Network,
  },
  {
    id: 'enterprise',
    label: 'Enterprise Intelligence',
    description: 'Portfolio, deployment, validation, and publication strategy',
    icon: Building2,
  },
] as const;

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
            <feMerge>
              <feMergeNode in="blueGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="ak-network ak-network-a">
          <path d="M5 82 L20 82 L34 70 L48 72 L61 55 L72 47" />
          <path d="M16 58 L31 60 L43 48 L55 52 L66 35" />
          <path d="M24 34 L38 40 L50 31 L65 34" />
          <path d="M38 83 L38 62 L50 52" />
          <path d="M54 72 L66 68 L78 79" />
          <circle cx="5" cy="82" r="2.5" />
          <circle cx="20" cy="82" r="3" />
          <circle cx="34" cy="70" r="3.6" />
          <circle cx="48" cy="72" r="2.7" />
          <circle cx="61" cy="55" r="3.3" />
          <circle cx="72" cy="47" r="2.8" />
          <circle cx="16" cy="58" r="2.4" />
          <circle cx="31" cy="60" r="3" />
          <circle cx="43" cy="48" r="2.5" />
          <circle cx="55" cy="52" r="2.9" />
          <circle cx="66" cy="35" r="2.3" />
          <circle cx="24" cy="34" r="2.2" />
          <circle cx="38" cy="40" r="2.7" />
          <circle cx="50" cy="31" r="2.2" />
          <circle cx="65" cy="34" r="2.9" />
          <circle cx="38" cy="83" r="2.1" />
          <circle cx="54" cy="72" r="2.5" />
          <circle cx="78" cy="79" r="2.1" />
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
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="26%" stopColor="#2563eb" />
            <stop offset="58%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <filter id="akIntelligenceISoftGlow" x="-45%" y="-40%" width="190%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.26  0 0 0 0 0.20  0 0 0 0 1  0 0 0 0.42 0" result="violetGlow" />
            <feMerge>
              <feMergeNode in="violetGlow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="ak-network ak-network-i">
          <path d="M3 88 L14 79 L25 82 L36 64" />
          <path d="M7 61 L19 61 L30 48 L43 42" />
          <path d="M19 34 L31 38 L43 25" />
          <circle cx="3" cy="88" r="2.2" />
          <circle cx="14" cy="79" r="2.6" />
          <circle cx="25" cy="82" r="2.2" />
          <circle cx="36" cy="64" r="2.7" />
          <circle cx="7" cy="61" r="2.2" />
          <circle cx="19" cy="61" r="2.7" />
          <circle cx="30" cy="48" r="2.3" />
          <circle cx="43" cy="42" r="2.4" />
          <circle cx="19" cy="34" r="2.1" />
          <circle cx="31" cy="38" r="2.3" />
          <circle cx="43" cy="25" r="2.2" />
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
  .ak-workspace-tabs { scrollbar-width: none; }
  .ak-workspace-tabs::-webkit-scrollbar { display: none; }
  @media (max-width: 1024px) { .ak-hero-card { min-height: auto; } .ak-hero-title { letter-spacing: -.05em; } .ak-hero-subtitle { letter-spacing: -.04em; } }
  @media (max-width: 768px) { .ak-hero-subtitle { gap: .12em; } .ak-brand-letter-a { width: .96em; height: 1em; } .ak-brand-letter-i { width: .52em; height: 1em; } }
`;

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrugCard[]>([]);
  const [selected, setSelected] = useState<DrugCard | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [, setSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeAtcCode, setActiveAtcCode] = useState<string | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('overview');

  const latestDrugLoadId = useRef(0);

  const selectDrugAndLoad = async (
    drug: DrugCard,
    targetTab: WorkspaceTab = 'overview'
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

    setActiveWorkspaceTab(targetTab);
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
          setResults(Array.isArray(data) ? data : []);
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

      if (detailRxcui === selectedRxcui) return;

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
        if (!cancelled) setDetail(null);
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
        graph_metrics: detail?.graph_metrics || detail?.graph?.metrics || {},
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
                    setActiveWorkspaceTab('overview');
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
                        setActiveWorkspaceTab('overview');
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
        <section className="mx-auto max-w-[1640px] space-y-9 px-6 py-10">
          <div className="sticky top-0 z-50 -mx-6 bg-slate-950/95 px-6 py-4 backdrop-blur-xl">
            <div className="ak-workspace-tabs flex gap-2 overflow-x-auto pb-1">
              {WORKSPACE_TABS.map((tab) => {
                const isActive = activeWorkspaceTab === tab.id;
                const Icon = tab.icon;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveWorkspaceTab(tab.id)}
                    className={`relative flex min-h-[145px] min-w-[245px] flex-1 items-center gap-5 rounded-[1.6rem] border px-6 py-6 text-left transition ${
                      isActive
                        ? 'border-blue-400 bg-gradient-to-br from-blue-400 to-blue-700 text-white shadow-2xl shadow-blue-950/60'
                        : 'border-blue-900/50 bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-slate-300 hover:border-blue-500/70 hover:bg-blue-950/40'
                    }`}
                  >
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                        isActive ? 'bg-blue-950/30 text-white' : 'bg-blue-950/40 text-blue-300'
                      }`}
                    >
                      <Icon className="h-7 w-7" />
                    </div>

                    <div>
                      <span className="block text-xl font-black leading-tight text-white">
                        {tab.label}
                      </span>
                      <span
                        className={`mt-3 block text-sm font-semibold leading-6 ${
                          isActive ? 'text-blue-50' : 'text-slate-400'
                        }`}
                      >
                        {tab.description}
                      </span>
                    </div>

                    {isActive && (
                      <span className="absolute inset-x-5 bottom-0 h-1 rounded-full bg-blue-200/80" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {activeWorkspaceTab === 'overview' && (
            <ExecutiveAssessmentCard drug={drugWithDetails} />
          )}

          {activeWorkspaceTab === 'overview' && (
            <ATCIntelligenceOverview
              drug={drugWithDetails}
              onSelectAtc={(code) => {
                setActiveAtcCode(code);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          <DrugIntelligenceWorkspace
            drug={drugWithDetails}
            activeTab={activeWorkspaceTab}
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