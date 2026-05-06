import { requireAuth } from '../auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default function register(router) {
  /**
   * GET /loans
   * requireAuth. Return all loans ordered by created_at.
   */
  router.get('/loans', async (request, env) => {
    await requireAuth(request, env.DB);

    const { results } = await env.DB.prepare(
      'SELECT * FROM loans ORDER BY created_at ASC'
    ).all();

    return json(results);
  });

  /**
   * POST /loans
   * requireAuth. Insert a new loan.
   * Body: { name, loan_type?, original_amount, outstanding, interest_rate,
   *         monthly_payment, tenure_months, start_date, currency?, notes? }
   */
  router.post('/loans', async (request, env) => {
    await requireAuth(request, env.DB);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const required = ['name', 'original_amount', 'outstanding', 'interest_rate', 'monthly_payment', 'tenure_months', 'start_date'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        return json({ error: `${field} is required` }, 400);
      }
    }

    const result = await env.DB.prepare(
      `INSERT INTO loans
         (name, loan_type, original_amount, outstanding, interest_rate,
          monthly_payment, tenure_months, start_date, currency, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
      .bind(
        body.name,
        body.loan_type || 'personal',
        parseFloat(body.original_amount),
        parseFloat(body.outstanding),
        parseFloat(body.interest_rate),
        parseFloat(body.monthly_payment),
        parseInt(body.tenure_months, 10),
        body.start_date,
        body.currency || 'SGD',
        body.notes || null
      )
      .first();

    if (!result) {
      const inserted = await env.DB.prepare(
        'SELECT * FROM loans WHERE rowid = last_insert_rowid()'
      ).first();
      return json(inserted, 201);
    }

    return json(result, 201);
  });

  /**
   * PUT /loans/:id
   * requireAuth. Full update of a loan.
   */
  router.put('/loans/:id', async (request, env, _ctx, params) => {
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
      'name', 'loan_type', 'original_amount', 'outstanding', 'interest_rate',
      'monthly_payment', 'tenure_months', 'start_date', 'currency', 'notes',
    ];
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
      `UPDATE loans SET ${setClauses} WHERE id = ?`
    ).bind(...values).run();

    if (meta.changes === 0) return json({ error: 'Loan not found' }, 404);

    const updated = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(id).first();
    return json(updated);
  });

  /**
   * DELETE /loans/:id
   * requireAuth. Delete a loan.
   */
  router.delete('/loans/:id', async (request, env, _ctx, params) => {
    await requireAuth(request, env.DB);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) return json({ error: 'Invalid id' }, 400);

    const { meta } = await env.DB.prepare('DELETE FROM loans WHERE id = ?').bind(id).run();

    if (meta.changes === 0) return json({ error: 'Loan not found' }, 404);

    return json({ ok: true });
  });
}
