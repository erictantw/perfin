import { requireAuth } from '../auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Geography inference based on ticker suffix / pattern
const GEOGRAPHY_MAP = {
  '.SI': 'singapore',
  '.L': 'uk',
  '.AX': 'australia',
  '.KL': 'malaysia',
  '.HK': 'hongkong',
  '.T': 'japan',
};
const CRYPTO_PATTERN = /-USD$|-SGD$|-EUR$|-GBP$/;

function inferGeography(ticker) {
  if (!ticker) return 'other';
  for (const [suffix, geo] of Object.entries(GEOGRAPHY_MAP)) {
    if (ticker.endsWith(suffix)) return geo;
  }
  if (CRYPTO_PATTERN.test(ticker)) return 'crypto';
  return 'us';
}

/**
 * Recalculate units, avg_cost and closed_at for a holding from its transactions.
 */
async function recalcHolding(db, holdingId) {
  const txns = await db
    .prepare('SELECT * FROM holding_transactions WHERE holding_id = ?')
    .bind(holdingId)
    .all();

  const buys = txns.results.filter(t => t.txn_type === 'buy');
  const sells = txns.results.filter(t => t.txn_type === 'sell');

  const buyUnits = buys.reduce((s, t) => s + t.units, 0);
  const sellUnits = sells.reduce((s, t) => s + t.units, 0);
  const units = Math.max(buyUnits - sellUnits, 0);

  const buyCost = buys.reduce((s, t) => s + t.units * t.price, 0);
  const avg_cost = buyUnits > 0 ? buyCost / buyUnits : 0;

  const closed_at =
    units === 0 && txns.results.length > 0 ? new Date().toISOString() : null;

  await db
    .prepare(
      'UPDATE holdings SET units=?, avg_cost=?, closed_at=?, updated_at=datetime("now") WHERE id=?'
    )
    .bind(units, avg_cost, closed_at, holdingId)
    .run();
}

export default function register(router) {
  /**
   * GET /holdings
   * requireAuth. Return all holdings with their transactions as a nested array.
   */
  router.get('/holdings', async (request, env) => {
    await requireAuth(request, env.DB);

    const { results: holdings } = await env.DB.prepare(
      'SELECT * FROM holdings ORDER BY created_at ASC'
    ).all();

    if (holdings.length === 0) return json([]);

    // Fetch all transactions in one query and group them
    const { results: transactions } = await env.DB.prepare(
      'SELECT * FROM holding_transactions ORDER BY txn_date ASC'
    ).all();

    const txnsByHolding = {};
    for (const txn of transactions) {
      if (!txnsByHolding[txn.holding_id]) txnsByHolding[txn.holding_id] = [];
      txnsByHolding[txn.holding_id].push(txn);
    }

    const result = holdings.map(h => ({
      ...h,
      transactions: txnsByHolding[h.id] || [],
    }));

    return json(result);
  });

  /**
   * POST /holdings
   * requireAuth. Insert a new holding.
   * Body: { ticker?, name, asset_type?, category?, geography?, geography_inferred?,
   *         units?, avg_cost?, current_price?, currency?, exchange?, platform?,
   *         is_srs?, include_in_allocation?, notes? }
   */
  router.post('/holdings', async (request, env) => {
    await requireAuth(request, env.DB);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { name } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return json({ error: 'name is required' }, 400);
    }

    const ticker = body.ticker || null;
    const geography_inferred = body.geography_inferred !== undefined ? body.geography_inferred : 1;
    const geography =
      body.geography ||
      (geography_inferred ? inferGeography(ticker) : 'other');

    const holding = {
      ticker,
      name: name.trim(),
      asset_type: body.asset_type || 'stock',
      category: body.category || 'growth',
      geography,
      geography_inferred: geography_inferred ? 1 : 0,
      units: body.units || 0,
      avg_cost: body.avg_cost || 0,
      current_price: body.current_price || 0,
      currency: body.currency || 'SGD',
      exchange: body.exchange || null,
      platform: body.platform || null,
      is_srs: body.is_srs ? 1 : 0,
      include_in_allocation: body.include_in_allocation !== undefined ? (body.include_in_allocation ? 1 : 0) : 1,
      closed_at: body.closed_at || null,
      notes: body.notes || null,
    };

    const result = await env.DB.prepare(
      `INSERT INTO holdings
         (ticker, name, asset_type, category, geography, geography_inferred,
          units, avg_cost, current_price, currency, exchange, platform,
          is_srs, include_in_allocation, closed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
      .bind(
        holding.ticker, holding.name, holding.asset_type, holding.category,
        holding.geography, holding.geography_inferred, holding.units, holding.avg_cost,
        holding.current_price, holding.currency, holding.exchange, holding.platform,
        holding.is_srs, holding.include_in_allocation, holding.closed_at, holding.notes
      )
      .first();

    if (!result) {
      const inserted = await env.DB.prepare(
        'SELECT * FROM holdings WHERE rowid = last_insert_rowid()'
      ).first();
      return json({ ...inserted, transactions: [] }, 201);
    }

    return json({ ...result, transactions: [] }, 201);
  });

  /**
   * PUT /holdings/:id
   * requireAuth. Update a holding.
   */
  router.put('/holdings/:id', async (request, env, _ctx, params) => {
    await requireAuth(request, env.DB);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) return json({ error: 'Invalid id' }, 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const allowed = [
      'ticker', 'name', 'asset_type', 'category', 'geography', 'geography_inferred',
      'current_price', 'currency', 'exchange', 'platform', 'is_srs',
      'include_in_allocation', 'closed_at', 'notes', 'price_updated_at',
    ];
    const updates = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    // Re-infer geography if ticker changed and geography_inferred is set
    if ('ticker' in body && (updates.geography_inferred === undefined || updates.geography_inferred)) {
      if (!('geography' in body)) {
        updates.geography = inferGeography(body.ticker);
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: 'No valid fields to update' }, 400);
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ') + ', updated_at = datetime("now")';
    const values = [...Object.values(updates), id];

    const { meta } = await env.DB.prepare(
      `UPDATE holdings SET ${setClauses} WHERE id = ?`
    ).bind(...values).run();

    if (meta.changes === 0) return json({ error: 'Holding not found' }, 404);

    const updated = await env.DB.prepare('SELECT * FROM holdings WHERE id = ?').bind(id).first();
    return json(updated);
  });

  /**
   * DELETE /holdings/:id
   * requireAuth. Delete holding (cascades to transactions).
   */
  router.delete('/holdings/:id', async (request, env, _ctx, params) => {
    await requireAuth(request, env.DB);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) return json({ error: 'Invalid id' }, 400);

    const { meta } = await env.DB.prepare('DELETE FROM holdings WHERE id = ?').bind(id).run();

    if (meta.changes === 0) return json({ error: 'Holding not found' }, 404);

    return json({ ok: true });
  });

  /**
   * GET /holdings/:id/transactions
   * requireAuth. Return all transactions for a holding.
   */
  router.get('/holdings/:id/transactions', async (request, env, _ctx, params) => {
    await requireAuth(request, env.DB);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) return json({ error: 'Invalid id' }, 400);

    const holding = await env.DB.prepare('SELECT id FROM holdings WHERE id = ?').bind(id).first();
    if (!holding) return json({ error: 'Holding not found' }, 404);

    const { results } = await env.DB.prepare(
      'SELECT * FROM holding_transactions WHERE holding_id = ? ORDER BY txn_date ASC'
    ).bind(id).all();

    return json(results);
  });

  /**
   * POST /holdings/:id/transactions
   * requireAuth. Insert a transaction, recalculate holding.
   * Body: { txn_type, units, price, fees?, currency?, platform?, txn_date, notes? }
   */
  router.post('/holdings/:id/transactions', async (request, env, _ctx, params) => {
    await requireAuth(request, env.DB);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) return json({ error: 'Invalid id' }, 400);

    const holding = await env.DB.prepare('SELECT id FROM holdings WHERE id = ?').bind(id).first();
    if (!holding) return json({ error: 'Holding not found' }, 404);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { txn_type = 'buy', units, price, txn_date } = body;

    if (units === undefined || units === null) return json({ error: 'units is required' }, 400);
    if (price === undefined || price === null) return json({ error: 'price is required' }, 400);
    if (!txn_date) return json({ error: 'txn_date is required' }, 400);

    const validTypes = ['buy', 'sell', 'dividend', 'split', 'transfer'];
    if (!validTypes.includes(txn_type)) {
      return json({ error: `txn_type must be one of: ${validTypes.join(', ')}` }, 400);
    }

    const txn = await env.DB.prepare(
      `INSERT INTO holding_transactions
         (holding_id, txn_type, units, price, fees, currency, platform, txn_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
      .bind(
        id, txn_type, units, price,
        body.fees || 0,
        body.currency || 'SGD',
        body.platform || null,
        txn_date,
        body.notes || null
      )
      .first();

    // Recalculate holding stats from all transactions
    await recalcHolding(env.DB, id);

    if (!txn) {
      const inserted = await env.DB.prepare(
        'SELECT * FROM holding_transactions WHERE rowid = last_insert_rowid()'
      ).first();
      return json(inserted, 201);
    }

    return json(txn, 201);
  });

  /**
   * DELETE /holdings/:id/transactions/:txnId
   * requireAuth. Delete a transaction and recalculate holding.
   */
  router.delete('/holdings/:id/transactions/:txnId', async (request, env, _ctx, params) => {
    await requireAuth(request, env.DB);

    const id = parseInt(params.id, 10);
    const txnId = parseInt(params.txnId, 10);
    if (isNaN(id) || isNaN(txnId)) return json({ error: 'Invalid id' }, 400);

    const { meta } = await env.DB.prepare(
      'DELETE FROM holding_transactions WHERE id = ? AND holding_id = ?'
    ).bind(txnId, id).run();

    if (meta.changes === 0) return json({ error: 'Transaction not found' }, 404);

    await recalcHolding(env.DB, id);

    return json({ ok: true });
  });

  /**
   * POST /holdings/import
   * requireAuth. Bulk import holdings with optional transactions.
   * Body: { holdings: [ { ...holdingFields, transactions: [...] } ] }
   */
  router.post('/holdings/import', async (request, env) => {
    await requireAuth(request, env.DB);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const items = body.holdings;
    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: 'holdings array is required and must not be empty' }, 400);
    }

    const inserted = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        if (!item.name) throw new Error('name is required');

        const ticker = item.ticker || null;
        const geography_inferred = item.geography_inferred !== undefined ? item.geography_inferred : 1;
        const geography = item.geography || (geography_inferred ? inferGeography(ticker) : 'other');

        const holdingRow = await env.DB.prepare(
          `INSERT INTO holdings
             (ticker, name, asset_type, category, geography, geography_inferred,
              units, avg_cost, current_price, currency, exchange, platform,
              is_srs, include_in_allocation, closed_at, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING *`
        )
          .bind(
            ticker, item.name, item.asset_type || 'stock', item.category || 'growth',
            geography, geography_inferred ? 1 : 0,
            item.units || 0, item.avg_cost || 0, item.current_price || 0,
            item.currency || 'SGD', item.exchange || null, item.platform || null,
            item.is_srs ? 1 : 0, item.include_in_allocation !== false ? 1 : 0,
            item.closed_at || null, item.notes || null
          )
          .first();

        const holdingId = holdingRow
          ? holdingRow.id
          : (await env.DB.prepare('SELECT last_insert_rowid() as id').first()).id;

        const transactions = Array.isArray(item.transactions) ? item.transactions : [];
        for (const txn of transactions) {
          if (!txn.txn_date || txn.units === undefined || txn.price === undefined) continue;
          await env.DB.prepare(
            `INSERT INTO holding_transactions
               (holding_id, txn_type, units, price, fees, currency, platform, txn_date, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
            .bind(
              holdingId, txn.txn_type || 'buy', txn.units, txn.price,
              txn.fees || 0, txn.currency || 'SGD', txn.platform || null,
              txn.txn_date, txn.notes || null
            )
            .run();
        }

        if (transactions.length > 0) {
          await recalcHolding(env.DB, holdingId);
        }

        const finalHolding = await env.DB.prepare('SELECT * FROM holdings WHERE id = ?').bind(holdingId).first();
        inserted.push(finalHolding);
      } catch (err) {
        errors.push({ index: i, name: item.name || '?', error: err.message });
      }
    }

    return json({ inserted: inserted.length, holdings: inserted, errors }, errors.length > 0 ? 207 : 201);
  });
}
