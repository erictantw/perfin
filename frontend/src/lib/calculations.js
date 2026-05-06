export const CPF_RATES = { OA: 0.025, SA: 0.04, MA: 0.04, RA: 0.04 };
export const FRS_2024 = 205800;

/**
 * Calculate net worth from asset/liability totals.
 */
export function calcNetWorth({ cash, investments, cpf, srs, properties = 0, loans }) {
  return (cash || 0) + (investments || 0) + (cpf || 0) + (srs || 0) + (properties || 0) - (loans || 0);
}

/**
 * Project CPF account growth over a number of years.
 * Returns array of { year, oa, sa, ma, total } objects.
 */
export function projectCpfGrowth(oa, sa, ma, years = 30) {
  const results = [];
  let curOA = oa || 0;
  let curSA = sa || 0;
  let curMA = ma || 0;

  for (let y = 0; y <= years; y++) {
    results.push({
      year: new Date().getFullYear() + y,
      oa: Math.round(curOA),
      sa: Math.round(curSA),
      ma: Math.round(curMA),
      total: Math.round(curOA + curSA + curMA),
    });

    if (y < years) {
      curOA = curOA * (1 + CPF_RATES.OA);
      curSA = curSA * (1 + CPF_RATES.SA);
      curMA = curMA * (1 + CPF_RATES.MA);
    }
  }

  return results;
}

/**
 * Estimate the Full Retirement Sum at a target age, adjusted for ~3.5% annual increase.
 */
export function frsAtAge(currentAge, targetAge = 55, frs = FRS_2024) {
  return Math.round(frs * Math.pow(1.035, Math.max(0, targetAge - currentAge)));
}

/**
 * Calculate fixed monthly mortgage/loan repayment using the standard annuity formula.
 */
export function calcMonthlyRepayment(principal, annualRate, tenureMonths) {
  if (!principal || !tenureMonths) return 0;
  if (!annualRate || annualRate === 0) return principal / tenureMonths;
  const r = annualRate / 12;
  return (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
}

/**
 * Build a full amortisation schedule for a loan.
 * Returns array of { month, payment, principal, interest, balance }.
 */
export function calcMortgageSchedule(principal, annualRate, tenureMonths) {
  if (!principal || !tenureMonths) return [];

  const monthly = calcMonthlyRepayment(principal, annualRate, tenureMonths);
  const r = (annualRate || 0) / 12;
  const schedule = [];
  let balance = principal;

  for (let m = 1; m <= tenureMonths; m++) {
    const interest = balance * r;
    const principalPaid = monthly - interest;
    balance = Math.max(0, balance - principalPaid);

    schedule.push({
      month: m,
      payment: Math.round(monthly * 100) / 100,
      principal: Math.round(principalPaid * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });

    if (balance === 0) break;
  }

  return schedule;
}

/**
 * Calculate allocation gaps between actual portfolio weights and target weights.
 * actual: { [assetClass]: number }  (amounts)
 * targets: { [assetClass]: number } (percentages, 0–100)
 * Returns array of { assetClass, actualPct, targetPct, gapPct, gapAmt }
 */
export function calcAllocationGaps(actual, targets) {
  if (!actual || !targets) return [];

  const totalActual = Object.values(actual).reduce((s, v) => s + (v || 0), 0);
  if (totalActual === 0) return [];

  return Object.keys(targets).map((cls) => {
    const actualAmt = actual[cls] || 0;
    const actualPct = (actualAmt / totalActual) * 100;
    const targetPct = targets[cls] || 0;
    const gapPct = targetPct - actualPct;
    const gapAmt = (gapPct / 100) * totalActual;

    return {
      assetClass: cls,
      actualPct: Math.round(actualPct * 10) / 10,
      targetPct,
      gapPct: Math.round(gapPct * 10) / 10,
      gapAmt: Math.round(gapAmt),
    };
  });
}

/**
 * Calculate the annualised run-rate of dividend income.
 * dividends: array of { date, amount }
 * Uses the most recent 12 months of data.
 */
export function calcRunRate(dividends) {
  if (!dividends || dividends.length === 0) return 0;

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 1);

  const recent = dividends.filter((d) => {
    const dt = new Date(d.date);
    return dt >= cutoff && dt <= now;
  });

  return recent.reduce((s, d) => s + (d.amount || 0), 0);
}

/**
 * Build monthly dividend data for charts.
 * dividends: array of { date, amount, ticker }
 * Returns array of { month: 'Jan 24', amount, count }
 */
export function buildDividendMonthlyData(dividends) {
  if (!dividends || dividends.length === 0) return [];

  const byMonth = {};

  dividends.forEach((d) => {
    const dt = new Date(d.date);
    const key = dt.toLocaleDateString('en-SG', { month: 'short', year: '2-digit' });
    if (!byMonth[key]) byMonth[key] = { month: key, amount: 0, count: 0, _ts: dt.getTime() };
    byMonth[key].amount += d.amount || 0;
    byMonth[key].count += 1;
  });

  return Object.values(byMonth)
    .sort((a, b) => a._ts - b._ts)
    .map(({ _ts, ...rest }) => ({ ...rest, amount: Math.round(rest.amount * 100) / 100 }));
}

/**
 * Build net worth history from snapshots for a sparkline / area chart.
 * snapshots: array of { date, netWorth } (already computed per snapshot)
 * Returns array of { date, value } sorted ascending.
 */
export function buildNetWorthHistory(snapshots) {
  if (!snapshots || snapshots.length === 0) return [];

  return [...snapshots]
    .sort((a, b) => new Date(a.snapshot_date ?? a.date) - new Date(b.snapshot_date ?? b.date))
    .map((s) => ({
      date: s.snapshot_date ?? s.date,
      netWorth: s.net_worth ?? s.netWorth ?? calcNetWorth(s),
      investments: s.investments || 0,
      cash: s.cash || 0,
      cpf: s.cpf || 0,
    }));
}

/**
 * Newton-Raphson XIRR implementation.
 * cashflows: [{ amount, date }] — purchases are negative, terminal/sale value is positive.
 * Returns the annualised rate of return, or null if it does not converge.
 */
export function calcXIRR(cashflows, guess = 0.1, maxIter = 100, tol = 1e-7) {
  if (!cashflows || cashflows.length < 2) return null;

  const dates = cashflows.map((cf) => new Date(cf.date));
  const t0 = dates[0];
  const years = dates.map((d) => (d - t0) / (365.25 * 24 * 3600 * 1000));
  const amounts = cashflows.map((cf) => cf.amount);

  function npv(rate) {
    return amounts.reduce((s, a, i) => s + a / Math.pow(1 + rate, years[i]), 0);
  }

  function dnpv(rate) {
    return amounts.reduce((s, a, i) => s - years[i] * a / Math.pow(1 + rate, years[i] + 1), 0);
  }

  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    const f = npv(rate);
    const df = dnpv(rate);
    if (Math.abs(df) < 1e-12) break;
    const newRate = rate - f / df;
    if (Math.abs(newRate - rate) < tol) return newRate;
    rate = newRate;
    if (rate < -0.999) rate = -0.999;
  }
  return rate;
}

/**
 * Build an activity heatmap dataset from transactions.
 * transactions: array of { date, amount }
 * Returns array of { date, count, total } keyed by ISO date string.
 */
export function buildActivityHeatmap(transactions) {
  if (!transactions || transactions.length === 0) return [];

  const byDate = {};

  transactions.forEach((tx) => {
    const key = tx.date ? tx.date.split('T')[0] : null;
    if (!key) return;
    if (!byDate[key]) byDate[key] = { date: key, count: 0, total: 0 };
    byDate[key].count += 1;
    byDate[key].total += tx.amount || 0;
  });

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}
