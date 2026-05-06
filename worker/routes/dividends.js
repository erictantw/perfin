import { requireAuth } from '../auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default function register(router) {
  /**
   * GET /dividends
   * requireAuth. Return all dividends ordered by ex_date DESC.
   */
  router.get('/dividends', async (request, env) => {
    await requireAuth(request, env.DB);

    const { results } = await env.DB.prepare(
      'SELECT * FROM dividends ORDER BY ex_date DESC'
    ).all();

    return json(results);
  });

  /**
   * POST /dividends
   * requireAuth. Insert a new dividend record.
   * Body: { holding_id?, ticker?, name?, amount, currency?, ex_date,
   *         payment_date?, confidence_tier?, notes? }
   */
  router.post('/dividends', async (request, env) => {
    await requireAuth(request, env.DB);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    if (body.amount === undefined || body.amount === null) {
      return json({ error: 'amount is required' }, 400);
    }
    if (!body.ex_date) {
      return json({ error: 'ex_date is required' }, 400);
    }

    const amount = parseFloat(body.amount);
    if (isNaN(amount)) return json({ error: 'amount must be a number' }, 400);

    // If holding_id provided, try to enrich ticker/name from holdings table
    let ticker = body.ticker || null;
    let name = body.name || null;

    if (body.holding_id && (!ticker || !name)) {
      const holding = await env.DB.prepare(
        'SELECT ticker, name FROM holdings WHERE id = ?'
      ).bind(parseInt(body.holding_id, 10)).first();
      if (holding) {
        ticker = ticker || holding.ticker;
        name = name || holding.name;
      }
    }

    const result = await env.DB.prepare(
      `INSERT INTO dividends
         (holding_id, ticker, name, amount, currency, ex_date, payment_date, confidence_tier, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
      .bind(
        body.holding_id ? parseInt(body.holding_id, 10) : null,
        ticker,
        name,
        amount,
        body.currency || 'SGD',
        body.ex_date,
        body.payment_date || null,
        body.confidence_tier || 'received',
        body.notes || null
      )
      .first();

    if (!result) {
      const inserted = await env.DB.prepare(
        'SELECT * FROM dividends WHERE rowid = last_insert_rowid()'
      ).first();
      return json(inserted, 201);
    }

    return json(result, 201);
  });

  /**
   * PUT /dividends/:id
   * requireAuth. Update a dividend record.
   */
  router.put('/dividends/:id', async (request, env, _ctx, params) => {
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
      'holding_id', 'ticker', 'name', 'amount', 'currency',
      'ex_date', 'payment_date', 'confidence_tier', 'notes',
    ];
    const updates = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: 'No valid fields to update' }, 400);
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    const { meta } = await env.DB.prepare(
      `UPDATE dividends SET ${setClauses} WHERE id = ?`
    ).bind(...values).run();

    if (meta.changes === 0) return json({ error: 'Dividend not found' }, 404);

    const updated = await env.DB.prepare('SELECT * FROM dividends WHERE id = ?').bind(id).first();
    return json(updated);
  });

  /**
   * DELETE /dividends/:id
   * requireAuth. Delete a dividend record.
   */
  router.delete('/dividends/:id', async (request, env, _ctx, params) => {
    await requireAuth(request, env.DB);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) return json({ error: 'Invalid id' }, 400);

    const { meta } = await env.DB.prepare('DELETE FROM dividends WHERE id = ?').bind(id).run();

    if (meta.changes === 0) return json({ error: 'Dividend not found' }, 404);

    return json({ ok: true });
  });
}
