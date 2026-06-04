type Props = { label: string; value?: number; helper?: string };

export default function MetricGauge({ label, value = 0, helper }: Props) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-600">{label}</p>
          {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
        </div>
        <span className="text-2xl font-bold text-slate-900">{safe.toFixed(1)}</span>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-500" style={{ width: `${safe}%` }} />
      </div>
    </div>
  );
}
