export function fmtSGD(value, compact = false) {
  if (value == null || isNaN(value)) return '—';
  const abs = Math.abs(value);
  let formatted;
  if (compact && abs >= 1_000_000) formatted = (abs / 1_000_000).toFixed(2) + 'M';
  else if (compact && abs >= 1_000) formatted = (abs / 1_000).toFixed(1) + 'k';
  else formatted = abs.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (value < 0 ? '–S$' : 'S$') + formatted;
}

export function fmtNum(value, decimals = 2) {
  if (value == null || isNaN(value)) return '—';
  return Number(value).toLocaleString('en-SG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(value, decimals = 1) {
  if (value == null || isNaN(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function greet() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function todayLong() {
  return new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function isoDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

export function fmtCurrency(value, currency = 'SGD', compact = false) {
  if (currency === 'SGD') return fmtSGD(value, compact);
  if (value == null || isNaN(value)) return '—';
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (value < 0 ? '-' : '') + currency + ' ' + formatted;
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtShortDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}
