import { requireAuth } from '../auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default function register(router) {
  /**
   * GET /cpf
   * requireAuth. Return cpf_data row.
   */
  router.get('/cpf', async (request, env) => {
    await requireAuth(request, env.DB);

    const row = await env.DB.prepare('SELECT * FROM cpf_data WHERE id = 1').first();
    if (!row) return json({ error: 'CPF data not found' }, 404);

    return json(row);
  });

  /**
   * PUT /cpf
   * requireAuth. Update cpf_data.
   * Body: { oa_balance?, sa_balance?, ma_balance?, ra_balance?, monthly_salary?, auto_update_enabled? }
   */
  router.put('/cpf', async (request, env) => {
    await requireAuth(request, env.DB);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const allowed = ['oa_balance', 'sa_balance', 'ma_balance', 'ra_balance', 'monthly_salary', 'auto_update_enabled'];
    const updates = {};
    for (const key of allowed) {
      if (key in body) {
        if (key === 'auto_update_enabled') {
          updates[key] = body[key] ? 1 : 0;
        } else {
          const val = parseFloat(body[key]);
          if (isNaN(val)) return json({ error: `${key} must be a number` }, 400);
          updates[key] = val;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: 'No valid fields to update' }, 400);
    }

    updates.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates)];

    await env.DB.prepare(
      `UPDATE cpf_data SET ${setClauses} WHERE id = 1`
    ).bind(...values).run();

    const updated = await env.DB.prepare('SELECT * FROM cpf_data WHERE id = 1').first();
    return json(updated);
  });

  /**
   * GET /srs
   * requireAuth. Return srs_data row.
   */
  router.get('/srs', async (request, env) => {
    await requireAuth(request, env.DB);

    const row = await env.DB.prepare('SELECT * FROM srs_data WHERE id = 1').first();
    if (!row) return json({ error: 'SRS data not found' }, 404);

    return json(row);
  });

  /**
   * PUT /srs
   * requireAuth. Update srs_data.
   * Body: { balance?, annual_contribution? }
   */
  router.put('/srs', async (request, env) => {
    await requireAuth(request, env.DB);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const allowed = ['balance', 'annual_contribution'];
    const updates = {};
    for (const key of allowed) {
      if (key in body) {
        const val = parseFloat(body[key]);
        if (isNaN(val)) return json({ error: `${key} must be a number` }, 400);
        updates[key] = val;
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: 'No valid fields to update' }, 400);
    }

    updates.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates)];

    await env.DB.prepare(
      `UPDATE srs_data SET ${setClauses} WHERE id = 1`
    ).bind(...values).run();

    const updated = await env.DB.prepare('SELECT * FROM srs_data WHERE id = 1').first();
    return json(updated);
  });
}
