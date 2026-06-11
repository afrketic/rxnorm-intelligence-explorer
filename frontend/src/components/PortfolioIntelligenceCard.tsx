import { useEffect, useMemo, useState } from 'react';
import {
  getPortfolioBenchmark,
  getPortfolioOpportunity,
  getPortfolioTopOpportunities,
  getTherapeuticPortfolios,
  PortfolioBenchmarkPeer,
  PortfolioBenchmarkProfile,
  PortfolioIntelligenceItem,
} from '../lib/api';

const DEFAULT_PORTFOLIO_RXCUI = '1991302';

type Props = {
  rxcui?: string | null;
};

function formatNumber(value: unknown, fallback = '—') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric.toLocaleString();
}

function formatScore(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toFixed(1);
}

function formatRank(rank: unknown) {
  const numeric = Number(rank);
  if (!Number.isFinite(numeric) || numeric <= 0) return '—';
  return `#${Math.round(numeric).toLocaleString()}`;
}

function getPortfolioName(item: PortfolioIntelligenceItem | null | undefined) {
  return (
    item?.portfolio_name ||
    item?.primary_therapeutic_domain_name ||
    item?.atc_name ||
    item?.disease_name ||
    item?.portfolio_code ||
    item?.atc_code ||
    'Portfolio'
  );
}

function getPortfolioRank(item: PortfolioIntelligenceItem | null | undefined) {
  const rank = item?.executive_opportunity_rank ?? item?.portfolio_rank ?? item?.source_portfolio_rank;
  return formatRank(rank);
}

function normalizePercentile(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric.toFixed(numeric >= 99 ? 2 : 1)}th percentile`;
}

function getPeerName(peer: PortfolioBenchmarkPeer) {
  return peer.drug_name || peer.display_name || peer.rxnorm_name || peer.rxcui || 'Peer medication';
}

function getBenchmarkName(benchmark: PortfolioBenchmarkProfile | null) {
  return benchmark?.display_name || benchmark?.rxcui || 'Selected medication';
}

function PortfolioMiniRow({ item }: { item: PortfolioIntelligenceItem }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
            {item.portfolio_type || item.atc_level || 'Portfolio'}
          </p>
          <p className="mt-2 text-sm font-black leading-5 text-white">
            {getPortfolioName(item)}
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">
          {getPortfolioRank(item)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="font-bold uppercase tracking-wide text-slate-500">Meds</p>
          <p className="mt-1 font-black text-slate-100">{formatNumber(item.medication_count)}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide text-slate-500">Avg EHI</p>
          <p className="mt-1 font-black text-slate-100">{formatScore(item.average_ehi_v6_score)}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-wide text-slate-500">Critical</p>
          <p className="mt-1 font-black text-slate-100">{formatNumber(item.enterprise_critical_count)}</p>
        </div>
      </div>
    </div>
  );
}

function BenchmarkMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-blue-300/15 bg-blue-400/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-200">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-blue-50/75">{helper}</p>
    </div>
  );
}

function RankMetric({ label, rank, count }: { label: string; rank: unknown; count: unknown }) {
  const countText = formatNumber(count);
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-white">{formatRank(rank)}</p>
      <p className="mt-1 text-xs font-semibold text-slate-400">of {countText}</p>
    </div>
  );
}

function BadgePill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-emerald-100">
      {children}
    </span>
  );
}

function PeerTable({ peers, selectedRxcui }: { peers: PortfolioBenchmarkPeer[]; selectedRxcui: string }) {
  if (!peers.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm font-semibold text-slate-300">
        Peer benchmarking is not available for this medication yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-950/70 text-xs uppercase tracking-[0.14em] text-slate-400">
          <tr>
            <th className="px-4 py-3 font-black">Medication</th>
            <th className="px-4 py-3 font-black">EHI</th>
            <th className="px-4 py-3 font-black">Peer Rank</th>
            <th className="px-4 py-3 font-black">Basis</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 bg-slate-950/35">
          {peers.map((peer) => {
            const isSelected = String(peer.rxcui) === String(selectedRxcui);
            return (
              <tr key={`${peer.rxcui}-${peer.peer_group}`} className={isSelected ? 'bg-cyan-300/10' : ''}>
                <td className="px-4 py-3">
                  <p className="font-black text-white">{getPeerName(peer)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">RxCUI {peer.rxcui}</p>
                </td>
                <td className="px-4 py-3 font-black text-slate-100">{formatScore(peer.ehi_v6_score)}</td>
                <td className="px-4 py-3 font-black text-slate-100">{formatRank(peer.peer_rank)}</td>
                <td className="px-4 py-3">
                  <p className="font-bold text-cyan-100">{peer.peer_group || 'Peer'}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{peer.shared_context || 'Shared portfolio context'}</p>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PortfolioIntelligenceCard({ rxcui }: Props = {}) {
  const selectedRxcui = String(rxcui || DEFAULT_PORTFOLIO_RXCUI);

  const [benchmark, setBenchmark] = useState<PortfolioBenchmarkProfile | null>(null);
  const [therapeutic, setTherapeutic] = useState<PortfolioIntelligenceItem[]>([]);
  const [opportunities, setOpportunities] = useState<PortfolioIntelligenceItem[]>([]);
  const [glp1, setGlp1] = useState<PortfolioIntelligenceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPortfolioIntelligence() {
      setLoading(true);
      setError(null);

      try {
        const [benchmarkProfile, therapeuticRows, opportunityRows, glp1Row] = await Promise.all([
          getPortfolioBenchmark(selectedRxcui),
          getTherapeuticPortfolios(5),
          getPortfolioTopOpportunities(25),
          getPortfolioOpportunity('ATC4', 'A10BJ').catch(() => null),
        ]);

        if (!active) return;
        setBenchmark(benchmarkProfile);
        setTherapeutic(therapeuticRows);
        setOpportunities(opportunityRows);
        setGlp1(glp1Row);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load Portfolio Intelligence.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPortfolioIntelligence();

    return () => {
      active = false;
    };
  }, [selectedRxcui]);

  const topAtcOpportunities = useMemo(
    () => opportunities.filter((item) => String(item.portfolio_type || '').startsWith('ATC')).slice(0, 3),
    [opportunities],
  );

  const topDiseaseOpportunities = useMemo(
    () => opportunities.filter((item) => item.portfolio_type === 'Disease Area').slice(0, 3),
    [opportunities],
  );

  const badges = benchmark?.badges?.length ? benchmark.badges : ['Benchmark Candidate'];
  const peers = benchmark?.peers || [];
  const position = benchmark?.position || {};
  const rankings = benchmark?.rankings || {};
  const benchmarks = benchmark?.benchmarks || {};
  const peerContext = benchmark?.peer_context || {};

  return (
    <section className="overflow-hidden rounded-3xl border border-blue-400/25 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_34%),linear-gradient(135deg,#020617,#0f172a_52%,#172554)] text-white shadow-2xl shadow-blue-950/20">
      <div className="p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">
              Portfolio Intelligence
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
              Portfolio Benchmarking & Competitive Intelligence
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
              This workspace answers how a medication compares through rank, benchmark, peer context, positioning badges, and executive narrative instead of adding another portfolio score.
            </p>
          </div>

          <span className="rounded-full border border-blue-300/30 bg-blue-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-blue-100">
            H3B.6 Comparison Layer
          </span>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Portfolio Position</p>
                <h3 className="mt-2 text-4xl font-black tracking-tight text-white md:text-5xl">
                  {position.portfolio_rank_label || formatRank(position.portfolio_rank)}
                </h3>
                <p className="mt-2 text-sm font-bold text-cyan-50/85">
                  {getBenchmarkName(benchmark)} · {formatNumber(position.population_size)} evaluated medications
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-right">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Relative Position</p>
                <p className="mt-2 text-xl font-black text-white">{position.portfolio_position_label || '—'}</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">{normalizePercentile(position.portfolio_percentile)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {badges.map((badge) => (
                <BadgePill key={badge}>{badge}</BadgePill>
              ))}
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-200">
              {benchmark?.narrative || 'Strategic portfolio narrative will appear once benchmark data is available.'}
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Ranking Context</p>
            <div className="mt-4 grid gap-3">
              <RankMetric label="Therapeutic Rank" rank={rankings.therapeutic_rank} count={rankings.therapeutic_count} />
              <RankMetric label="ATC Peer Rank" rank={rankings.atc_rank} count={rankings.atc_count} />
              <RankMetric label="Disease Rank" rank={rankings.disease_rank} count={rankings.disease_count} />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-blue-300/15 bg-slate-950/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">Benchmark Panel</p>
              <p className="mt-2 text-sm font-semibold text-slate-400">
                Compares the selected medication against portfolio, therapeutic, and disease averages.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-300">
              {peerContext.primary_peer_basis || 'Peer'} basis
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <BenchmarkMetric label="Medication" value={formatScore(benchmarks.medication)} helper="Selected medication EHI V6" />
            <BenchmarkMetric label="Portfolio Avg" value={formatScore(benchmarks.portfolio_average)} helper="All evaluated medications" />
            <BenchmarkMetric label="Therapeutic Avg" value={formatScore(benchmarks.therapeutic_average ?? benchmarks.atc_average)} helper="Primary therapeutic context" />
            <BenchmarkMetric label="Disease Avg" value={formatScore(benchmarks.disease_average)} helper="Mapped disease portfolio" />
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-cyan-300/15 bg-slate-950/45 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Peer Benchmarking</p>
              <p className="mt-2 text-sm font-semibold text-slate-400">
                Peers are selected by ATC Level 4 first, then disease focus, then therapeutic domain.
              </p>
            </div>
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">
              {formatNumber(peerContext.peer_group_size || peers.length)} peers
            </span>
          </div>
          <div className="mt-4">
            <PeerTable peers={peers} selectedRxcui={selectedRxcui} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-cyan-300/15 bg-slate-950/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Top Therapeutic Portfolios
            </p>
            <div className="mt-4 space-y-3">
              {therapeutic.slice(0, 3).map((item) => (
                <PortfolioMiniRow key={`therapeutic-${item.primary_therapeutic_domain_code || item.portfolio_name}`} item={item} />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-blue-300/15 bg-slate-950/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-300">
              Top ATC Opportunities
            </p>
            <div className="mt-4 space-y-3">
              {topAtcOpportunities.map((item) => (
                <PortfolioMiniRow key={`atc-${item.portfolio_type}-${item.portfolio_code || item.portfolio_name}`} item={item} />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-300/15 bg-slate-950/45 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
              Top Disease Portfolios
            </p>
            <div className="mt-4 space-y-3">
              {topDiseaseOpportunities.map((item) => (
                <PortfolioMiniRow key={`disease-${item.portfolio_name}`} item={item} />
              ))}
            </div>
          </div>
        </div>

        {glp1 && (
          <div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-4 text-sm font-semibold text-emerald-50/85">
            GLP-1 portfolio context remains available as a supporting comparison: {getPortfolioName(glp1)} is currently positioned {getPortfolioRank(glp1)} with {formatNumber(glp1.enterprise_critical_count)} Enterprise Critical medications.
          </div>
        )}

        {loading && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm font-semibold text-slate-300">
            Loading portfolio benchmarking intelligence…
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm font-semibold text-rose-100">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
