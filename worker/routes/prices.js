import { requireAuth } from '../auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Fetch the latest price for a single ticker from Yahoo Finance.
 * Returns { price, currency } or null on failure.
 */
async function fetchYahooPrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json',
      },
      cf: { cacheTtl: 300 },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const price = result.meta?.regularMarketPrice;
    const currency = result.meta?.currency || 'USD';
    if (price === undefined || price === null) return null;

    return { price, currency };
  } catch {
    return null;
  }
}

/**
 * Fetch FX rates from Frankfurter API (SGD base → other currencies).
 * Returns a map of { currency: rate_to_sgd } (i.e., inverted).
 */
async function fetchFxRates() {
  const fxUrl = 'https://api.frankfurter.app/latest?from=SGD&to=USD,GBP,EUR,HKD,AUD,JPY,MYR,CAD,CNY';
  try {
    const res = await fetch(fxUrl, { cf: { cacheTtl: 3600 } });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.rates) return null;

    // data.rates is SGD → X; we want X → SGD, i.e. 1 / rate
    const result = { SGD: 1.0 };
    for (const [currency, rate] of Object.entries(data.rates)) {
      if (rate > 0) result[currency] = 1 / rate;
    }
    return result;
  } catch {
    return null;
  }
}

export default function register(router) {
  /**
   * POST /prices/refresh
   * requireAuth. Fetch live prices for all active holdings with tickers,
   * update price_cache and fx_rates_cache.
   * Returns { updated: count, fx_updated: bool, errors: [] }
   */
  router.post('/prices/refresh', async (request, env) => {
    await requireAuth(request, env.DB);

    // Fetch all active (non-closed) holdings that have a ticker
    const { results: holdings } = await env.DB.prepare(
      `SELECT id, ticker, currency FROM holdings
       WHERE ticker IS NOT NULL AND ticker != '' AND closed_at IS NULL`
    ).all();

    // Deduplicate tickers
    const tickerMap = {}; // ticker -> [holdingId, ...]
    for (const h of holdings) {
      if (!tickerMap[h.ticker]) tickerMap[h.ticker] = [];
      tickerMap[h.ticker].push(h.id);
    }
    const tickers = Object.keys(tickerMap);

    const errors = [];
    let updatedCount = 0;

    // Fetch prices concurrently (batched to avoid overwhelming Yahoo)
    const BATCH_SIZE = 10;
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(ticker => fetchYahooPrice(ticker)));

      for (let j = 0; j < batch.length; j++) {
        const ticker = batch[j];
        const priceData = results[j];

        if (!priceData) {
          errors.push({ ticker, error: 'Price fetch failed' });
          continue;
        }

        const { price, currency } = priceData;

        try {
          // Upsert price_cache
          await env.DB.prepare(
            `INSERT OR REPLACE INTO price_cache (ticker, price, currency, updated_at)
             VALUES (?, ?, ?, datetime('now'))`
          ).bind(ticker, price, currency).run();

          // Update each holding that uses this ticker
          for (const holdingId of tickerMap[ticker]) {
            await env.DB.prepare(
              `UPDATE holdings
               SET current_price = ?, price_updated_at = datetime('now'), updated_at = datetime('now')
               WHERE id = ?`
            ).bind(price, holdingId).run();
          }

          updatedCount++;
        } catch (err) {
          errors.push({ ticker, error: err.message });
        }
      }
    }

    // Fetch and update FX rates
    let fxUpdated = false;
    const fxRates = await fetchFxRates();
    if (fxRates) {
      try {
        const stmts = Object.entries(fxRates).map(([currency, rate]) =>
          env.DB.prepare(
            `INSERT OR REPLACE INTO fx_rates_cache (currency, rate_to_sgd, updated_at)
             VALUES (?, ?, datetime('now'))`
          ).bind(currency, rate)
        );
        // Execute all FX updates in a batch
        if (stmts.length > 0) {
          await env.DB.batch(stmts);
        }
        fxUpdated = true;
      } catch (err) {
        errors.push({ source: 'fx', error: err.message });
      }
    } else {
      errors.push({ source: 'fx', error: 'FX rate fetch failed' });
    }

    return json({ updated: updatedCount, fx_updated: fxUpdated, errors });
  });

  /**
   * GET /fx
   * requireAuth. Return all FX rates as { currency: rate_to_sgd } object.
   */
  router.get('/fx', async (request, env) => {
    await requireAuth(request, env.DB);

    const { results } = await env.DB.prepare(
      'SELECT currency, rate_to_sgd FROM fx_rates_cache'
    ).all();

    const fx = {};
    for (const row of results) {
      fx[row.currency] = row.rate_to_sgd;
    }

    return json(fx);
  });
}
