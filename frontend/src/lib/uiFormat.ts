export function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function formatScore(value: unknown, decimals = 1): string {
  return toNumber(value).toFixed(decimals);
}

export function formatPercentile(value: unknown, decimals = 1): string {
  return `${toNumber(value).toFixed(decimals)}% percentile`;
}

export function formatPercent(value: unknown, decimals = 1): string {
  return `${toNumber(value).toFixed(decimals)}%`;
}

export function releaseBadgeClass(label?: string): string {
  const normalized = (label || '').toLowerCase();

  if (
    normalized.includes('platinum') ||
    normalized.includes('elite') ||
    normalized.includes('gold') ||
    normalized.includes('publication ready') ||
    normalized.includes('flagship') ||
    normalized.includes('tier 1')
  ) {
    return 'border-slate-300 bg-slate-950 text-white';
  }

  if (
    normalized.includes('enterprise') ||
    normalized.includes('strong') ||
    normalized.includes('recommended') ||
    normalized.includes('research defense') ||
    normalized.includes('tier 2')
  ) {
    return 'border-blue-200 bg-blue-50 text-blue-900';
  }

  if (
    normalized.includes('emerging') ||
    normalized.includes('moderate') ||
    normalized.includes('review') ||
    normalized.includes('operational') ||
    normalized.includes('tier 3')
  ) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }

  if (
    normalized.includes('monitor') ||
    normalized.includes('experimental') ||
    normalized.includes('additional') ||
    normalized.includes('tier 4')
  ) {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }

  if (
    normalized.includes('risk') ||
    normalized.includes('limited') ||
    normalized.includes('not ready') ||
    normalized.includes('insufficient') ||
    normalized.includes('tier 5')
  ) {
    return 'border-rose-200 bg-rose-50 text-rose-900';
  }

  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export const releaseHeaderClass =
  'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-7 text-white';

export const releaseEyebrowClass =
  'text-xs font-bold uppercase tracking-[0.28em] text-blue-200';

export const releaseTitleClass =
  'mt-3 text-3xl font-black tracking-tight text-white';

export const releaseBodyClass =
  'mt-2 max-w-3xl text-sm leading-6 text-blue-100';
