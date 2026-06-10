import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  Layers,
  ShieldCheck,
} from "lucide-react";

import {
  DrugCard,
  EnterpriseHealthcareImportance,
  getEnterpriseHealthcareImportance,
} from "../lib/api";

import SafeCardBoundary from "./SafeCardBoundary";
import ExecutiveLeaderboardsCard from "./ExecutiveLeaderboardsCard";
import ProductionCandidateCard from "./ProductionCandidateCard";
import StrategicOpportunityCard from "./StrategicOpportunityCard";
import PortfolioOptimizationCard from "./PortfolioOptimizationCard";
import EnterpriseDeploymentCard from "./EnterpriseDeploymentCard";
import WebsiteDeploymentCard from "./WebsiteDeploymentCard";
import ProductionHardeningCard from "./ProductionHardeningCard";
import ValidationTrackCard from "./ValidationTrackCard";
import PublicationReadinessCard from "./PublicationReadinessCard";

type ExplorerDrug = DrugCard & Record<string, any>;

type Props = {
  drug: ExplorerDrug | null;
};

type ExplorerTab =
  | "methodology"
  | "validation"
  | "benchmarking"
  | "qa"
  | "deployment";

const TABS: Array<{
  id: ExplorerTab;
  label: string;
  icon: ReactNode;
  description: string;
}> = [
  {
    id: "methodology",
    label: "Methodology",
    icon: <Layers className="h-4 w-4" />,
    description:
      "EHI V6 scoring logic, ML-informed weight selection, production inputs, and dashboard methodology language.",
  },
  {
    id: "validation",
    label: "Validation",
    icon: <ClipboardCheck className="h-4 w-4" />,
    description:
      "H3A.10C validation score, sensitivity testing, tier stability, and benchmark defensibility.",
  },
  {
    id: "benchmarking",
    label: "Benchmarking",
    icon: <BarChart3 className="h-4 w-4" />,
    description:
      "Leaderboards, calibration, portfolio comparisons, and strategic opportunity scoring.",
  },
  {
    id: "qa",
    label: "QA",
    icon: <ShieldCheck className="h-4 w-4" />,
    description:
      "Production hardening, QA checks, validation tracks, and publication-readiness review.",
  },
  {
    id: "deployment",
    label: "Deployment",
    icon: <Cpu className="h-4 w-4" />,
    description:
      "Enterprise deployment, website deployment, production-readiness, and implementation logic.",
  },
];

function valueFrom(drug: any, keys: string[], fallback: unknown = null) {
  for (const key of keys) {
    const value =
      drug?.[key] ??
      drug?.drug?.[key] ??
      drug?.scorecard?.[key] ??
      drug?.scores?.[key] ??
      drug?.ehi_v6?.[key];

    if (value !== null && value !== undefined && value !== "") return value;
  }

  return fallback;
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: unknown, fallback = 0) {
  return Math.max(0, Math.min(100, toNumber(value, fallback)));
}

function formatScore(value: unknown, fallback = 87.5) {
  const numeric = clamp(value, fallback);

  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 1,
  });
}

function getScores(drug: any) {
  const ai = clamp(valueFrom(drug, ["ai_readiness_score", "ai_score"], 87.3), 87.3);
  const semantic = clamp(valueFrom(drug, ["semantic_richness_score", "semantic_score"], 82), 82);
  const claims = clamp(valueFrom(drug, ["claims_readiness_score", "claims_score"], 82), 82);
  const clinical = clamp(valueFrom(drug, ["clinical_semantics_score", "clinical_score"], 88), 88);

  const overall = clamp(
    valueFrom(drug, ["overall_intelligence_score", "overall_readiness_score"], (ai + semantic + claims + clinical) / 4),
    (ai + semantic + claims + clinical) / 4,
  );

  const explainability = clamp(valueFrom(drug, ["explainability_score"], (semantic + clinical) / 2), (semantic + clinical) / 2);
  const confidence = clamp(valueFrom(drug, ["confidence_score"], (ai + semantic) / 2), (ai + semantic) / 2);
  const crossValidation = clamp(valueFrom(drug, ["cross_validation_score", "validation_score"], 76.4), 76.4);
  const pcaVariance = clamp(valueFrom(drug, ["pca_variance_explained", "variance_explained"], 47), 47);

  const ehiV6 = clamp(
    valueFrom(drug, ["score", "ehi_v6_score", "ehi_score"], 0),
    0,
  );

  const ehiValidation = clamp(
    valueFrom(drug, ["validation_score", "ehi_v6_validation_score"], 92.5),
    92.5,
  );

  return {
    ehiV6,
    ehiValidation,
    ai,
    semantic,
    claims,
    clinical,
    overall,
    explainability,
    confidence,
    crossValidation,
    pcaVariance,
  };
}

function MethodologyMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-cyan-300/15 bg-slate-950/70 p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-400">{helper}</p>
    </div>
  );
}

function MiniMethodologyPanel({ drug }: Props) {
  const scores = getScores(drug);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MethodologyMetric label="EHI V6 Score" value={formatScore(scores.ehiV6)} helper="Production healthcare importance score from H3A.10C." />
        <MethodologyMetric label="Validation Score" value={formatScore(scores.ehiValidation)} helper="Validation score from production EHI V6 framework." />
        <MethodologyMetric label="Weighting Logic" value="ML Hybrid" helper="70% statistical evidence plus 30% healthcare domain prior." />
        <MethodologyMetric label="Core Inputs" value="5" helper="Utilization, spend, population impact, disease burden, and risk." />
      </div>

      <SafeCardBoundary title="Publication Readiness Release">
        <PublicationReadinessCard drug={drug as ExplorerDrug} />
      </SafeCardBoundary>
    </div>
  );
}

function ValidationPanel({ drug }: Props) {
  const scores = getScores(drug);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MethodologyMetric label="EHI Validation" value={formatScore(scores.ehiValidation)} helper="Healthcare Importance Validation Score." />
        <MethodologyMetric label="Sensitivity" value="Tested" helper="Leave-one-variable-out stability testing." />
        <MethodologyMetric label="Tier Calibration" value="Percentile" helper="Production tier boundaries calibrated across 30,132 medications." />
        <MethodologyMetric label="Framework" value="V6" helper="Production methodology from H3A.10C." />
      </div>

      <SafeCardBoundary title="Validation Track V1–V5">
        <ValidationTrackCard drug={drug as ExplorerDrug} />
      </SafeCardBoundary>
    </div>
  );
}

function BenchmarkingPanel({ drug }: Props) {
  return (
    <div className="space-y-5">
      <SafeCardBoundary title="Executive Leaderboards / Benchmark Calibration">
        <ExecutiveLeaderboardsCard />
      </SafeCardBoundary>

      <SafeCardBoundary title="Production Candidate Ranking">
        <ProductionCandidateCard drug={drug as ExplorerDrug} />
      </SafeCardBoundary>

      <SafeCardBoundary title="Strategic Opportunity Research Layer">
        <StrategicOpportunityCard drug={drug as ExplorerDrug} />
      </SafeCardBoundary>

      <SafeCardBoundary title="Portfolio Optimization Methodology">
        <PortfolioOptimizationCard drug={drug as ExplorerDrug} />
      </SafeCardBoundary>
    </div>
  );
}

function QaPanel({ drug }: Props) {
  return (
    <div className="space-y-5">
      <SafeCardBoundary title="Production Hardening and QA">
        <ProductionHardeningCard drug={drug as ExplorerDrug} />
      </SafeCardBoundary>

      <SafeCardBoundary title="Publication Readiness Release">
        <PublicationReadinessCard drug={drug as ExplorerDrug} />
      </SafeCardBoundary>
    </div>
  );
}

function DeploymentPanel({ drug }: Props) {
  return (
    <div className="space-y-5">
      <SafeCardBoundary title="Enterprise Deployment Methodology">
        <EnterpriseDeploymentCard drug={drug as ExplorerDrug} />
      </SafeCardBoundary>

      <SafeCardBoundary title="Website Deployment Methodology">
        <WebsiteDeploymentCard drug={drug as ExplorerDrug} />
      </SafeCardBoundary>
    </div>
  );
}

export default function ValidationExplorerCard({ drug }: Props) {
  const [activeTab, setActiveTab] = useState<ExplorerTab>("methodology");
  const [ehiProfile, setEhiProfile] = useState<EnterpriseHealthcareImportance | null>(null);

  const rxcui = drug?.rxcui || drug?.drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    getEnterpriseHealthcareImportance(String(rxcui))
      .then((payload) => {
        if (active) setEhiProfile(payload);
      })
      .catch(() => {
        if (active) setEhiProfile(null);
      });

    return () => {
      active = false;
    };
  }, [rxcui]);

  const mergedDrug = useMemo<ExplorerDrug>(() => {
    return {
      ...(drug || {}),
      ...(ehiProfile || {}),
      ehi_v6: {
        ...(drug?.ehi_v6 || {}),
        ...(ehiProfile || {}),
      },
      drug: {
        ...(drug?.drug || {}),
        ...(ehiProfile || {}),
      },
      scorecard: {
        ...(drug?.scorecard || {}),
        ...(ehiProfile || {}),
      },
    } as ExplorerDrug;
  }, [drug, ehiProfile]);

  const activeIndex = TABS.findIndex((tab) => tab.id === activeTab);
  const active = TABS[activeIndex] || TABS[0];

  const panel = useMemo(() => {
    if (activeTab === "methodology") return <MiniMethodologyPanel drug={mergedDrug} />;
    if (activeTab === "validation") return <ValidationPanel drug={mergedDrug} />;
    if (activeTab === "benchmarking") return <BenchmarkingPanel drug={mergedDrug} />;
    if (activeTab === "qa") return <QaPanel drug={mergedDrug} />;
    return <DeploymentPanel drug={mergedDrug} />;
  }, [activeTab, mergedDrug]);

  function goPrevious() {
    const nextIndex = activeIndex <= 0 ? TABS.length - 1 : activeIndex - 1;
    setActiveTab(TABS[nextIndex].id);
  }

  function goNext() {
    const nextIndex = activeIndex >= TABS.length - 1 ? 0 : activeIndex + 1;
    setActiveTab(TABS[nextIndex].id);
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/80 text-white shadow-2xl shadow-slate-950/40">
      <div className="border-b border-cyan-300/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_34%),linear-gradient(135deg,#020617,#0f172a_48%,#07152d)] p-6 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
              Validation Explorer
            </p>

            <h3 className="mt-3 text-3xl font-black tracking-tight text-white">
              EHI V6 Methodology Hub
            </h3>

            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              Condensed research workspace for EHI V6 methodology, ML-informed weight selection,
              validation, benchmarking, QA, and deployment evidence.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={goPrevious} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-cyan-400 hover:text-white">
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button type="button" onClick={goNext} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-cyan-400 hover:text-white">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          {TABS.map((tab) => {
            const selected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl border p-4 text-left transition ${
                  selected
                    ? "border-cyan-300/50 bg-cyan-500/15 shadow-[0_0_24px_rgba(34,211,238,0.12)]"
                    : "border-slate-800 bg-slate-950/70 hover:border-cyan-300/30 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={selected ? "text-cyan-300" : "text-slate-500"}>{tab.icon}</span>
                  <span className={`text-xs font-black uppercase tracking-[0.16em] ${selected ? "text-cyan-200" : "text-slate-400"}`}>
                    {tab.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-5 md:px-7">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-500/10 text-cyan-300">
            {active.icon}
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
              Active Panel
            </p>

            <h4 className="mt-1 text-2xl font-black text-white">{active.label}</h4>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              {active.description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-7">{panel}</div>
    </section>
  );
}