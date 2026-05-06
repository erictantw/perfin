import { requireAuth } from '../auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default function register(router) {
  /**
   * GET /dashboard
   * requireAuth. Single aggregated call returning net worth breakdown,
   * previous snapshot, profile name, and FX rates.
   */
  router.get('/dashboard', async (request, env) => {
    await requireAuth(request, env.DB);

    const db = env.DB;

    // Run all independent queries in parallel
    const [
      cashAccounts,
      holdings,
      cpfData,
      srsData,
      loansData,
      propertiesData,
      ilpsData,
      fxRatesResult,
      latestSnapshot,
      profile,
    ] = await Promise.all([
      db.prepare('SELECT balance, currency FROM cash_accounts').all(),
      db.prepare(
        `SELECT units, current_price, currency, is_srs, include_in_allocation
         FROM holdings WHERE closed_at IS NULL`
      ).all(),
      db.prepare('SELECT oa_balance, sa_balance, ma_balance, ra_balance FROM cpf_data WHERE id = 1').first(),
      db.prepare('SELECT balance FROM srs_data WHERE id = 1').first(),
      db.prepare('SELECT outstanding, currency FROM loans').all(),
      db.prepare(
        'SELECT current_value, currency, include_in_net_worth FROM properties'
      ).all(),
      db.prepare(
        'SELECT surrender_value, include_in_net_worth FROM ilps'
      ).all(),
      db.prepare('SELECT currency, rate_to_sgd FROM fx_rates_cache').all(),
      db.prepare(
        'SELECT net_worth, snapshot_date FROM net_worth_snapshots ORDER BY snapshot_date DESC LIMIT 1'
      ).first(),
      db.prepare('SELECT display_name FROM profiles WHERE id = 1').first(),
    ]);

    // Build FX lookup: { USD: 1.35, ... }
    const fx = {};
    for (const row of fxRatesResult.results) {
      fx[row.currency] = row.rate_to_sgd;
    }
    // Always ensure SGD = 1
    fx['SGD'] = fx['SGD'] || 1.0;

    function toSGD(amount, currency) {
      const rate = fx[currency] || fx['USD'] || 1.35;
      return amount * rate;
    }

    // Cash total (all accounts, converted to SGD)
    let cashTotal = 0;
    for (const account of cashAccounts.results) {
      cashTotal += toSGD(account.balance || 0, account.currency || 'SGD');
    }

    // Investments total (non-SRS holdings, converted to SGD)
    // SRS-wrapped holdings are counted under srsTotal
    let investmentsTotal = 0;
    let srsInvestmentsTotal = 0;

    for (const h of holdings.results) {
      const value = (h.units || 0) * (h.current_price || 0);
      const sgdValue = toSGD(value, h.currency || 'SGD');
      if (h.is_srs) {
        srsInvestmentsTotal += sgdValue;
      } else {
        investmentsTotal += sgdValue;
      }
    }

    // CPF total
    let cpfTotal = 0;
    if (cpfData) {
      cpfTotal =
        (cpfData.oa_balance || 0) +
        (cpfData.sa_balance || 0) +
        (cpfData.ma_balance || 0) +
        (cpfData.ra_balance || 0);
      // CPF is always SGD
    }

    // SRS total = SRS cash balance + SRS investments
    const srsCash = srsData ? (srsData.balance || 0) : 0;
    const srsTotal = srsCash + srsInvestmentsTotal;

    // Properties total (only those included in net worth)
    let propertiesTotal = 0;
    for (const p of propertiesData.results) {
      if (p.include_in_net_worth) {
        // Properties stored in local currency; assume SGD if no currency column
        propertiesTotal += toSGD(p.current_value || 0, p.currency || 'SGD');
      }
    }

    // ILPs total (surrender value, only those included in net worth)
    let ilpsTotal = 0;
    for (const ilp of ilpsData.results) {
      if (ilp.include_in_net_worth) {
        ilpsTotal += ilp.surrender_value || 0; // ILPs assumed SGD
      }
    }

    // Loans outstanding (negative component)
    let loansTotal = 0;
    for (const loan of loansData.results) {
      loansTotal += toSGD(loan.outstanding || 0, loan.currency || 'SGD');
    }

    // Net worth = assets - liabilities
    const assets = cashTotal + investmentsTotal + cpfTotal + srsTotal + propertiesTotal + ilpsTotal;
    const netWorth = assets - loansTotal;

    const breakdown = {
      cash: Math.round(cashTotal * 100) / 100,
      investments: Math.round(investmentsTotal * 100) / 100,
      cpf: Math.round(cpfTotal * 100) / 100,
      srs: Math.round(srsTotal * 100) / 100,
      properties: Math.round(propertiesTotal * 100) / 100,
      ilps: Math.round(ilpsTotal * 100) / 100,
      loans: Math.round(loansTotal * 100) / 100,
    };

    return json({
      netWorth: Math.round(netWorth * 100) / 100,
      breakdown,
      previousSnapshot: latestSnapshot || null,
      profile: {
        display_name: profile ? profile.display_name : 'Me',
      },
      fx,
    });
  });
}
