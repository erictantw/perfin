import { requireAuth } from '../auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default function register(router) {
  /**
   * GET /snapshots
   * requireAuth. Return all snapshots ordered by snapshot_date ASC.
   */
  router.get('/snapshots', async (request, env) => {
    await requireAuth(request, env.DB);

    const { results } = await env.DB.prepare(
      'SELECT * FROM net_worth_snapshots ORDER BY snapshot_date ASC'
    ).all();

    // Parse breakdown JSON for each snapshot
    const parsed = results.map(s => {
      try {
        s.breakdown = JSON.parse(s.breakdown || '{}');
      } catch {
        s.breakdown = {};
      }
      return s;
    });

    return json(parsed);
  });

  /**
   * POST /snapshots
   * requireAuth. Insert or replace a snapshot.
   * Body: { snapshot_date, net_worth, cash, investments, cpf, srs, properties, loans, breakdown? }
   */
  router.post('/snapshots', async (request, env) => {
    await requireAuth(request, env.DB);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const required = ['snapshot_date', 'net_worth'];
    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return json({ error: `${field} is required` }, 400);
      }
    }

    const snapshotDate = body.snapshot_date;
    const netWorth = parseFloat(body.net_worth);
    if (isNaN(netWorth)) return json({ error: 'net_worth must be a number' }, 400);

    const cash = parseFloat(body.cash) || 0;
    const investments = parseFloat(body.investments) || 0;
    const cpf = parseFloat(body.cpf) || 0;
    const srs = parseFloat(body.srs) || 0;
    const properties = parseFloat(body.properties) || 0;
    const loans = parseFloat(body.loans) || 0;

    const breakdown = body.breakdown
      ? (typeof body.breakdown === 'string' ? body.breakdown : JSON.stringify(body.breakdown))
      : '{}';

    // Use INSERT OR REPLACE to upsert by snapshot_date (UNIQUE constraint)
    const result = await env.DB.prepare(
      `INSERT OR REPLACE INTO net_worth_snapshots
         (snapshot_date, net_worth, cash, investments, cpf, srs, properties, loans, breakdown)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
      .bind(snapshotDate, netWorth, cash, investments, cpf, srs, properties, loans, breakdown)
      .first();

    let row = result;
    if (!row) {
      row = await env.DB.prepare(
        'SELECT * FROM net_worth_snapshots WHERE snapshot_date = ?'
      ).bind(snapshotDate).first();
    }

    try {
      row.breakdown = JSON.parse(row.breakdown || '{}');
    } catch {
      row.breakdown = {};
    }

    return json(row, 201);
  });

  /**
   * DELETE /snapshots/:id
   * requireAuth. Delete a snapshot by id.
   */
  router.delete('/snapshots/:id', async (request, env, _ctx, params) => {
    await requireAuth(request, env.DB);

    const id = parseInt(params.id, 10);
    if (isNaN(id)) return json({ error: 'Invalid id' }, 400);

    const { meta } = await env.DB.prepare(
      'DELETE FROM net_worth_snapshots WHERE id = ?'
    ).bind(id).run();

    if (meta.changes === 0) return json({ error: 'Snapshot not found' }, 404);

    return json({ ok: true });
  });
}
