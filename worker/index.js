import { Router } from './router.js';
import profileRoutes from './routes/profile.js';
import cashRoutes from './routes/cash.js';
import holdingsRoutes from './routes/holdings.js';
import cpfRoutes from './routes/cpf.js';
import loansRoutes from './routes/loans.js';
import dividendsRoutes from './routes/dividends.js';
import snapshotsRoutes from './routes/snapshots.js';
import pricesRoutes from './routes/prices.js';
import dashboardRoutes from './routes/dashboard.js';

const router = new Router();

// Register all route modules
profileRoutes(router);
cashRoutes(router);
holdingsRoutes(router);
cpfRoutes(router);
loansRoutes(router);
dividendsRoutes(router);
snapshotsRoutes(router);
pricesRoutes(router);
dashboardRoutes(router);

/**
 * Build CORS headers based on the configured FRONTEND_URL.
 */
function buildCorsHeaders(env) {
  const allowedOrigin = env.FRONTEND_URL || '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Attach CORS headers to an existing Response, returning a new Response.
 */
function withCors(response, corsHeaders) {
  const newHeaders = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    newHeaders.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default {
  /**
   * Main fetch handler.
   */
  async fetch(request, env, ctx) {
    const corsHeaders = buildCorsHeaders(env);

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Only handle /api/* paths
    if (!url.pathname.startsWith('/api/') && url.pathname !== '/api') {
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const response = await router.handle(request, env, ctx);
      return withCors(response, corsHeaders);
    } catch (err) {
      // requireAuth and other middleware throw Response objects for auth errors
      if (err instanceof Response) {
        return withCors(err, corsHeaders);
      }

      console.error('Unhandled error:', err);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },

  /**
   * Scheduled handler — runs on cron (daily at 01:00 UTC).
   * Applies CPF monthly contribution if auto_update_enabled.
   */
  async scheduled(event, env, ctx) {
    console.log('Scheduled event triggered:', event.cron);

    try {
      const cpf = await env.DB.prepare('SELECT * FROM cpf_data WHERE id = 1').first();
      if (!cpf || !cpf.auto_update_enabled) {
        console.log('CPF auto-update disabled, skipping.');
        return;
      }

      const now = new Date();
      const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const lastApplied = cpf.auto_update_last_applied || '';

      // Only apply once per month — check if last_applied is in the same YYYY-MM
      const thisMonth = today.slice(0, 7); // YYYY-MM
      if (lastApplied.startsWith(thisMonth)) {
        console.log('CPF contribution already applied this month, skipping.');
        return;
      }

      const salary = cpf.monthly_salary || 0;
      if (salary <= 0) {
        console.log('CPF monthly_salary is 0, nothing to apply.');
        return;
      }

      // Singapore CPF contribution rates (simplified, for salary ≤ SGD 6,000)
      // Employee + Employer rates as a fraction of salary
      // OA: 23%, SA: 6%, MA: 8% of total CPF contribution pool
      // Actual rates vary by age; using under-55 defaults:
      // Total CPF rate = 37% of salary (employee 20% + employer 17%)
      const totalContribution = salary * 0.37;
      const oaContrib = totalContribution * (23 / 37);
      const saContrib = totalContribution * (6 / 37);
      const maContrib = totalContribution * (8 / 37);

      const newOA = (cpf.oa_balance || 0) + oaContrib;
      const newSA = (cpf.sa_balance || 0) + saContrib;
      const newMA = (cpf.ma_balance || 0) + maContrib;

      await env.DB.prepare(
        `UPDATE cpf_data
         SET oa_balance = ?, sa_balance = ?, ma_balance = ?,
             auto_update_last_applied = ?,
             updated_at = datetime('now')
         WHERE id = 1`
      ).bind(newOA, newSA, newMA, today).run();

      console.log(
        `CPF auto-update applied for ${today}: OA +${oaContrib.toFixed(2)}, SA +${saContrib.toFixed(2)}, MA +${maContrib.toFixed(2)}`
      );
    } catch (err) {
      console.error('CPF scheduled update failed:', err);
    }
  },
};
