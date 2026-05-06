
// ─── Formatters ───────────────────────────────────────────────────────────────
window.fmtSGD = function(value, compact = false) {
  if (value == null || isNaN(value)) return '—';
  const abs = Math.abs(value);
  let formatted;
  if (compact && abs >= 1_000_000) formatted = (abs / 1_000_000).toFixed(2) + 'M';
  else if (compact && abs >= 1_000) formatted = (abs / 1_000).toFixed(1) + 'k';
  else formatted = abs.toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (value < 0 ? '–S$' : 'S$') + formatted;
};

window.fmtNum = function(value, decimals = 2) {
  if (value == null || isNaN(value)) return '—';
  return Number(value).toLocaleString('en-SG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

window.fmtPct = function(value, decimals = 1) {
  if (value == null || isNaN(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

window.greet = function() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

window.todayLong = function() {
  return new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

window.isoDate = function(date = new Date()) {
  return date.toISOString().split('T')[0];
};

// ─── LocalStorage DB ─────────────────────────────────────────────────────────
window.db = {
  get(key, def = []) {
    try { return JSON.parse(localStorage.getItem('wf_' + key)) ?? def; } catch { return def; }
  },
  set(key, value) {
    localStorage.setItem('wf_' + key, JSON.stringify(value));
  },
  nextId(key) {
    const items = this.get(key, []);
    return items.length ? Math.max(...items.map(i => i.id || 0)) + 1 : 1;
  }
};

// ─── Seed demo data if empty ──────────────────────────────────────────────────
(function seedDemo() {
  if (db.get('seeded', false)) return;
  db.set('profile', { name: 'Alex', allocation_targets: JSON.stringify({ Cash: 15, Investments: 50, CPF: 30, Properties: 5 }) });
  db.set('cash', [
    { id: 1, account_name: 'DBS Multiplier', balance: 45000, currency: 'SGD', category: 'Savings' },
    { id: 2, account_name: 'OCBC 360', balance: 18500, currency: 'SGD', category: 'Emergency' },
    { id: 3, account_name: 'Wise USD', balance: 3200, currency: 'USD', category: 'Other' },
  ]);
  db.set('cpf', { oa: 42000, sa: 28000, ma: 15500, ra: 0, srs: 8000 });
  db.set('holdings', [
    { id: 1, ticker: 'VWRA', name: 'Vanguard FTSE All-World', units: 120, avg_cost: 95.20, currency: 'USD', asset_type: 'ETF', platform: 'IBKR', exchange: 'LSE', latest_price: 112.40 },
    { id: 2, ticker: 'ES3', name: 'SPDR STI ETF', units: 800, avg_cost: 3.28, currency: 'SGD', asset_type: 'ETF', platform: 'DBS Vickers', exchange: 'SGX', latest_price: 3.51 },
    { id: 3, ticker: 'A17U', name: 'CapitaLand Ascendas REIT', units: 2000, avg_cost: 2.85, currency: 'SGD', asset_type: 'REIT', platform: 'Moomoo', exchange: 'SGX', latest_price: 2.63 },
  ]);
  db.set('loans', [
    { id: 1, loan_name: 'HDB BTO Loan', loan_type: 'HDB', principal: 380000, outstanding_balance: 290000, annual_rate: 0.026, tenure_months: 300, monthly_payment: 1380, start_date: '2020-06-01' },
  ]);
  db.set('dividends', [
    { id: 1, ticker: 'A17U', ex_date: '2024-11-15', payment_date: '2024-12-05', amount: 420, currency: 'SGD', notes: 'Q3 2024' },
    { id: 2, ticker: 'ES3', ex_date: '2025-02-10', payment_date: '2025-03-01', amount: 180, currency: 'SGD', notes: 'Semi-annual' },
    { id: 3, ticker: 'A17U', ex_date: '2025-05-12', payment_date: '2025-06-01', amount: 430, currency: 'SGD', notes: 'Q1 2025' },
    { id: 4, ticker: 'VWRA', ex_date: '2025-03-20', payment_date: '2025-04-10', amount: 95, currency: 'USD', notes: '' },
  ]);
  db.set('snapshots', [
    { id: 1, snapshot_date: '2024-12-01', net_worth: 180000, cash: 55000, investments: 38000, cpf: 79000, properties: 0, loans: 295000 },
    { id: 2, snapshot_date: '2025-03-01', net_worth: 195000, cash: 60000, investments: 42000, cpf: 82000, properties: 0, loans: 292000 },
    { id: 3, snapshot_date: '2025-06-01', net_worth: 212000, cash: 64000, investments: 47000, cpf: 85000, properties: 0, loans: 289000 },
    { id: 4, snapshot_date: '2026-01-01', net_worth: 228000, cash: 63500, investments: 52000, cpf: 89500, properties: 0, loans: 286000 },
    { id: 5, snapshot_date: '2026-04-01', net_worth: 241000, cash: 67000, investments: 55000, cpf: 92000, properties: 0, loans: 284000 },
  ]);
  db.set('seeded', true);
})();

// ─── Calculations ─────────────────────────────────────────────────────────────
window.CPF_RATES = { OA: 0.025, SA: 0.04, MA: 0.04, RA: 0.04 };

window.projectCpfGrowth = function(oa, sa, ma, years = 30) {
  const result = [{ year: 0, oa, sa, ma, total: oa + sa + ma }];
  let curOA = oa, curSA = sa, curMA = ma;
  for (let y = 1; y <= years; y++) {
    curOA = curOA * (1 + CPF_RATES.OA);
    curSA = curSA * (1 + CPF_RATES.SA);
    curMA = curMA * (1 + CPF_RATES.MA);
    result.push({ year: y, oa: Math.round(curOA), sa: Math.round(curSA), ma: Math.round(curMA), total: Math.round(curOA + curSA + curMA) });
  }
  return result;
};

window.FRS_2024 = 205800;
window.frsAtAge = function(currentAge, targetAge = 55, frs = FRS_2024) {
  return Math.round(frs * Math.pow(1.035, Math.max(0, targetAge - currentAge)));
};

window.calcMonthlyRepayment = function(principal, annualRate, tenureMonths) {
  if (!principal || !tenureMonths) return 0;
  if (!annualRate || annualRate === 0) return principal / tenureMonths;
  const r = annualRate / 12;
  return (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
};

window.calcMortgageSchedule = function(principal, annualRate, tenureMonths) {
  const monthly = calcMonthlyRepayment(principal, annualRate, tenureMonths);
  const r = (annualRate || 0) / 12;
  const schedule = [];
  let balance = principal;
  for (let m = 1; m <= tenureMonths; m++) {
    const interest = balance * r;
    const principalPaid = monthly - interest;
    balance = Math.max(0, balance - principalPaid);
    schedule.push({ month: m, payment: Math.round(monthly * 100) / 100, principal: Math.round(principalPaid * 100) / 100, interest: Math.round(interest * 100) / 100, balance: Math.round(balance * 100) / 100 });
    if (balance <= 0) break;
  }
  return schedule;
};

window.calcAllocationGaps = function(actual, targets) {
  const totalActual = Object.values(actual).reduce((s, v) => s + (v || 0), 0);
  return Object.keys(targets).map(key => {
    const actualAmt = actual[key] || 0;
    const actualPct = totalActual ? (actualAmt / totalActual) * 100 : 0;
    const targetPct = targets[key] || 0;
    return { key, actualAmt, actualPct: Math.round(actualPct * 10) / 10, targetPct, gap: Math.round((actualPct - targetPct) * 10) / 10 };
  });
};

window.calcRunRate = function(dividends) {
  if (!dividends?.length) return 0;
  const now = new Date();
  const cutoff = new Date(now); cutoff.setFullYear(cutoff.getFullYear() - 1);
  return dividends.filter(d => { const dt = new Date(d.ex_date); return dt >= cutoff && dt <= now; }).reduce((s, d) => s + (d.amount || 0), 0);
};

window.buildDividendMonthlyData = function(dividends) {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleString('default', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth() + 1, total: 0 });
  }
  for (const div of dividends) {
    const dt = new Date(div.ex_date);
    const entry = months.find(m => m.year === dt.getFullYear() && m.month === dt.getMonth() + 1);
    if (entry) entry.total += div.amount || 0;
  }
  return months;
};

window.buildNetWorthHistory = function(snapshots) {
  return (snapshots || []).sort((a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date)).map(s => ({
    date: s.snapshot_date, netWorth: s.net_worth, cash: s.cash, investments: s.investments, cpf: s.cpf
  }));
};

window.buildActivityHeatmap = function(transactions) {
  const map = {};
  for (const tx of transactions || []) {
    const day = tx.date?.slice(0, 10);
    if (!day) continue;
    if (!map[day]) map[day] = { count: 0, amount: 0 };
    map[day].count++;
    map[day].amount += Math.abs(tx.amount || 0);
  }
  const days = [];
  const now = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, ...(map[key] || { count: 0, amount: 0 }) });
  }
  return days;
};
