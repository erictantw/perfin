import { hashPassword, verifyPassword, signJWT, requireAuth } from '../auth.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Generate a 32-byte hex secret */
function generateSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function register(router) {
  /**
   * POST /auth/setup
   * First-time setup: only works when password_hash is empty.
   * Body: { password, display_name? }
   * Returns: { token, display_name }
   */
  router.post('/auth/setup', async (request, env) => {
    const profile = await env.DB.prepare(
      'SELECT password_hash, display_name FROM profiles WHERE id = 1'
    ).first();

    if (profile && profile.password_hash && profile.password_hash !== '') {
      return json({ error: 'App already configured. Use /auth/login.' }, 409);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { password, display_name } = body;
    if (!password || typeof password !== 'string' || password.length < 8) {
      return json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const [passwordHash, jwtSecret] = await Promise.all([
      hashPassword(password),
      Promise.resolve(generateSecret()),
    ]);

    const name = (display_name && typeof display_name === 'string')
      ? display_name.trim() || 'Me'
      : 'Me';

    await env.DB.prepare(
      `UPDATE profiles SET password_hash = ?, jwt_secret = ?, display_name = ? WHERE id = 1`
    ).bind(passwordHash, jwtSecret, name).run();

    const token = await signJWT({ sub: '1', display_name: name }, jwtSecret);
    return json({ token, display_name: name });
  });

  /**
   * POST /auth/login
   * Body: { password }
   * Returns: { token, display_name }
   */
  router.post('/auth/login', async (request, env) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { password } = body;
    if (!password) return json({ error: 'Password required' }, 400);

    const profile = await env.DB.prepare(
      'SELECT password_hash, jwt_secret, display_name FROM profiles WHERE id = 1'
    ).first();

    if (!profile || !profile.password_hash) {
      return json({ error: 'App not configured. Run /auth/setup first.' }, 403);
    }

    const valid = await verifyPassword(password, profile.password_hash);
    if (!valid) {
      return json({ error: 'Invalid password' }, 401);
    }

    const token = await signJWT(
      { sub: '1', display_name: profile.display_name },
      profile.jwt_secret
    );
    return json({ token, display_name: profile.display_name });
  });

  /**
   * POST /auth/change-password
   * requireAuth. Body: { current_password, new_password }
   */
  router.post('/auth/change-password', async (request, env) => {
    await requireAuth(request, env.DB);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const { current_password, new_password } = body;
    if (!current_password || !new_password) {
      return json({ error: 'current_password and new_password are required' }, 400);
    }
    if (typeof new_password !== 'string' || new_password.length < 8) {
      return json({ error: 'New password must be at least 8 characters' }, 400);
    }

    const profile = await env.DB.prepare(
      'SELECT password_hash FROM profiles WHERE id = 1'
    ).first();

    const valid = await verifyPassword(current_password, profile.password_hash);
    if (!valid) return json({ error: 'Current password is incorrect' }, 401);

    const newHash = await hashPassword(new_password);
    await env.DB.prepare(
      'UPDATE profiles SET password_hash = ? WHERE id = 1'
    ).bind(newHash).run();

    return json({ ok: true });
  });

  /**
   * GET /profile
   * requireAuth. Returns profile excluding sensitive fields.
   */
  router.get('/profile', async (request, env) => {
    await requireAuth(request, env.DB);

    const profile = await env.DB.prepare(
      `SELECT id, display_name, date_of_birth, monthly_salary, monthly_expenses,
              base_currency, rebalance_targets, created_at
       FROM profiles WHERE id = 1`
    ).first();

    if (!profile) return json({ error: 'Profile not found' }, 404);

    // Parse rebalance_targets JSON string
    try {
      profile.rebalance_targets = JSON.parse(profile.rebalance_targets || '{}');
    } catch {
      profile.rebalance_targets = {};
    }

    return json(profile);
  });

  /**
   * PATCH /profile
   * requireAuth. Body: { display_name?, date_of_birth?, monthly_salary?,
   *                      monthly_expenses?, rebalance_targets? }
   */
  router.patch('/profile', async (request, env) => {
    await requireAuth(request, env.DB);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const allowed = ['display_name', 'date_of_birth', 'monthly_salary', 'monthly_expenses', 'rebalance_targets'];
    const updates = {};
    for (const key of allowed) {
      if (key in body) {
        if (key === 'rebalance_targets') {
          updates[key] = typeof body[key] === 'string'
            ? body[key]
            : JSON.stringify(body[key]);
        } else {
          updates[key] = body[key];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return json({ error: 'No valid fields to update' }, 400);
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    await env.DB.prepare(
      `UPDATE profiles SET ${setClauses} WHERE id = 1`
    ).bind(...values).run();

    const updated = await env.DB.prepare(
      `SELECT id, display_name, date_of_birth, monthly_salary, monthly_expenses,
              base_currency, rebalance_targets, created_at
       FROM profiles WHERE id = 1`
    ).first();

    try {
      updated.rebalance_targets = JSON.parse(updated.rebalance_targets || '{}');
    } catch {
      updated.rebalance_targets = {};
    }

    return json(updated);
  });
}
