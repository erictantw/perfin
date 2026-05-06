import { requireAuth } from '../auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default function register(router) {
  /**
   * GET /cash
   * requireAuth. Return all cash_accounts ordered by created_at.
   */
  router.get('/cash', async (request, env) => {
    await requireAuth(request, env.DB);

    const { results } = await env.DB.prepare(
      'SELECT * FROM cash_accounts ORDER BY created_at ASC'
    ).all();

    return json(results);
  });

  /**
   * POST /cash
   * requireAuth. Insert a new cash account.
   * Body: { name, category?, balance?, interest_rate?, currency?, notes? }
   */
  router.post('/cash', async (request, env) => {
    await requireAuth(request, env.DB);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { name, category = 'buffer', balance = 0, interest_rate = 0, currency = 'SGD', notes = null } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return json({ error: 'name is required' }, 400);
    }

    const result = await env.DB.prepare(
      `INSERT INTO cash_accounts (name, category, balance, interest_rate, currency, notes)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`
    ).bind(name.trim(), category, balance, interest_rate, currency, notes).first();

    if (!result) {
      // Fallback: query the last inserted row
      const inserted = await env.DB.prepare(
        'SELECT * FROM cash_accounts WHERE rowid = last_insert_rowid()'
      ).first();
      return json(inserted, 201);
    }

    return json(result, 201);
  });

  /**
   * PUT /cash/:id
   * requireAuth. Full update of a cash account.
   * Body: { name?, category?, balance?, interest_rate?, currency?, notes? }
   */
  router.put('/cash/:id', async (request, env, _ctx, params) => {
    await requireAuth(request, env.DB);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) return json({ error: 'Invalid id' }, 400);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const allowed = ['name', 'category', 'balance', 'interest_rate', 'currency', 'notes'];
    const updates = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: 'No valid fields to update' }, 400);
    }

    updates.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    const { meta } = await env.DB.prepare(
      `UPDATE cash_accounts SET ${setClauses} WHERE id = ?`
    ).bind(...values).run();

    if (meta.changes === 0) {
      return json({ error: 'Cash account not found' }, 404);
    }

    const updated = await env.DB.prepare(
      'SELECT * FROM cash_accounts WHERE id = ?'
    ).bind(id).first();

    return json(updated);
  });

  /**
   * DELETE /cash/:id
   * requireAuth. Delete a cash account.
   */
  router.delete('/cash/:id', async (request, env, _ctx, params) => {
    await requireAuth(request, env.DB);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) return json({ error: 'Invalid id' }, 400);

    const { meta } = await env.DB.prepare(
      'DELETE FROM cash_accounts WHERE id = ?'
    ).bind(id).run();

    if (meta.changes === 0) {
      return json({ error: 'Cash account not found' }, 404);
    }

    return json({ ok: true });
  });
}
