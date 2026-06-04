import { useEffect, useMemo, useState } from 'react';
import { DrugCard } from '../lib/api';

type CopilotQuestion = {
  qa_rank: number;
  question_category: string;
  question: string;
  answer: string;
};

type CopilotPayload = {
  rxcui: string;
  display_name?: string;
  copilot: {
    ai_copilot_rank: number;
    ai_copilot_score: number;
    ai_copilot_percentile: number;
    ai_copilot_tier: string;
    recommended_prompt: string;
  };
  summaries: {
    executive_summary: string;
    technical_summary: string;
    strategic_summary: string;
  };
  scores: Record<string, number>;
  questions: CopilotQuestion[];
  methodology: {
    copilot_version: string;
    copilot_methodology: string;
    build_timestamp: string;
  };
};

type Props = {
  drug: DrugCard | null;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function formatScore(value: unknown) {
  return toNumber(value).toFixed(1);
}

function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(1)}%`;
}

function tierStyle(tier?: string) {
  const normalized = (tier || '').toLowerCase();
  if (normalized.includes('executive-ready')) return 'border-slate-700 bg-slate-950 text-white';
  if (normalized.includes('strong')) return 'border-blue-800 bg-blue-950/50 text-blue-100';
  if (normalized.includes('usable')) return 'border-emerald-800 bg-emerald-950/40 text-emerald-100';
  if (normalized.includes('enrichment')) return 'border-amber-800 bg-amber-950/40 text-amber-100';
  return 'border-slate-800 bg-slate-900/70 text-slate-300';
}

export default function AICopilotCard({ drug }: Props) {
  const [payload, setPayload] = useState<CopilotPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rxcui = drug?.rxcui;

  useEffect(() => {
    if (!rxcui) return;

    let active = true;

    async function loadCopilot() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/copilot/${encodeURIComponent(rxcui)}`);

        if (!response.ok) {
          throw new Error(`AI copilot request failed with status ${response.status}`);
        }

        const json = (await response.json()) as CopilotPayload;

        if (!active) return;
        setPayload(json);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load AI copilot brief.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCopilot();

    return () => {
      active = false;
    };
  }, [rxcui]);

  const questions = useMemo(() => payload?.questions?.slice(0, 6) || [], [payload]);

  if (!drug) return null;

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-900/40 bg-slate-950/85 shadow-sm shadow-blue-950/30">
      <div className="bg-gradient-to-br from-slate-950 via-purple-950 to-blue-950 p-7 text-white">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-purple-200">
              Sprint 23A · AI Copilot Layer
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              AI Copilot Brief
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-purple-100">
              Converts the full medication intelligence stack into executive, technical, strategic, and Q&A-ready responses.
            </p>
          </div>

          {payload && (
            <div className="rounded-3xl border border-white/10 bg-slate-950/80/10 px-6 py-5 text-right backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-wide text-purple-100">
                Copilot Score
              </p>
              <p className="mt-1 text-5xl font-black text-white">
                {formatScore(payload.copilot.ai_copilot_score)}
              </p>
              <p className="mt-1 text-sm font-bold text-purple-100">
                Rank #{payload.copilot.ai_copilot_rank?.toLocaleString()}
              </p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${tierStyle(payload.copilot.ai_copilot_tier)}`}>
                {payload.copilot.ai_copilot_tier}
              </span>
              <p className="mt-2 text-xs font-semibold text-purple-100">
                {formatPercent(payload.copilot.ai_copilot_percentile)} percentile
              </p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="p-7 text-sm font-semibold text-slate-400">
          Loading AI copilot brief…
        </div>
      )}

      {error && (
        <div className="m-7 rounded-2xl border border-rose-800 bg-rose-950/40 p-5 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && payload && (
        <div className="p-7">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <h3 className="text-base font-black text-white">Recommended Prompt</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {payload.copilot.recommended_prompt}
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            <SummaryCard title="Executive Summary" text={payload.summaries.executive_summary} />
            <SummaryCard title="Technical Summary" text={payload.summaries.technical_summary} />
            <SummaryCard title="Strategic Summary" text={payload.summaries.strategic_summary} />
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
            <h3 className="text-base font-black text-white">Copilot Question Bank</h3>
            <div className="mt-4 space-y-3">
              {questions.map((item) => (
                <div key={`${item.qa_rank}-${item.question_category}`} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {item.question_category}
                  </p>
                  <p className="mt-1 font-black text-white">{item.question}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
            <h3 className="text-base font-black text-white">Methodology</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {payload.methodology.copilot_methodology}
            </p>
            <p className="mt-3 text-xs font-semibold text-slate-400">
              Version: {payload.methodology.copilot_version} · Built: {payload.methodology.build_timestamp}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function SummaryCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm shadow-blue-950/30">
      <h3 className="text-base font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
    </div>
  );
}
