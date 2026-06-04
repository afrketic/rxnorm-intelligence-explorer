import { useEffect, useState } from 'react';

type LeaderboardRow = {
  leaderboard_category: string;
  leaderboard_rank: number;
  rxcui: string;
  display_name: string;
  leaderboard_score: number;
  executive_rank: number;
  executive_portfolio_score: number;
  executive_tier: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

function score(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : '—';
}

export default function ExecutiveLeaderboardsCard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState('Best Overall Executive Portfolio');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      const response = await fetch(`${API_BASE_URL}/executive/leaderboards/categories`);
      const json = await response.json();
      const names = json.map((row: any) => row.leaderboard_category);
      setCategories(names);
      if (names.length && !names.includes(selected)) setSelected(names[0]);
    }

    loadCategories().catch(console.error);
  }, []);

  useEffect(() => {
    if (!selected) return;

    async function loadRows() {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/executive/leaderboards/${encodeURIComponent(selected)}?limit=10`);
      const json = await response.json();
      setRows(Array.isArray(json) ? json : []);
      setLoading(false);
    }

    loadRows().catch((err) => {
      console.error(err);
      setLoading(false);
    });
  }, [selected]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-blue-600">
            Sprint 20B · Executive Leaderboards
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            Portfolio Leaderboards
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Top portfolio medications across executive, production, readiness, confidence, consensus, intelligence, and graph categories.
          </p>
        </div>

        <select
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Medication</th>
              <th className="px-4 py-3">RxCUI</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Executive Rank</th>
              <th className="px-4 py-3">Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td className="px-4 py-4 text-slate-500" colSpan={6}>
                  Loading leaderboard…
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row) => (
                <tr key={`${row.leaderboard_category}-${row.rxcui}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-black text-slate-950">#{row.leaderboard_rank}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{row.display_name}</td>
                  <td className="px-4 py-3 text-slate-500">{row.rxcui}</td>
                  <td className="px-4 py-3 font-black text-slate-950">{score(row.leaderboard_score)}</td>
                  <td className="px-4 py-3 text-slate-700">#{row.executive_rank}</td>
                  <td className="px-4 py-3 text-slate-700">{row.executive_tier}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
