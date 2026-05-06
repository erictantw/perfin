// Cloudflare Worker auth utilities — Web Crypto only, no external deps

function base64urlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(pad);
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

function hexEncode(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexDecode(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

/**
 * Hash a password with a random salt using SHA-256 with 100k PBKDF2 iterations.
 * @param {string} password
 * @param {string} [salt] — 16 random bytes as hex; generated if omitted
 * @returns {Promise<string>} "salt:hash" hex string
 */
export async function hashPassword(password, salt) {
  if (!salt) {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    salt = hexEncode(saltBytes.buffer);
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexDecode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return `${salt}:${hexEncode(derived)}`;
}

/**
 * Verify a plaintext password against a stored "salt:hash" string.
 * @param {string} password
 * @param {string} storedHash — "salt:hash"
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt] = storedHash.split(':');
  const computed = await hashPassword(password, salt);
  // Constant-time compare via HMAC trick
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode('compare'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, enc.encode(computed)),
    crypto.subtle.sign('HMAC', key, enc.encode(storedHash)),
  ]);
  const a = new Uint8Array(sigA);
  const b = new Uint8Array(sigB);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Sign a JWT with HS256 using Web Crypto.
 * @param {object} payload
 * @param {string} secret — hex-encoded 32-byte secret
 * @param {number} [expiresInDays=30]
 * @returns {Promise<string>} JWT string
 */
export async function signJWT(payload, secret, expiresInDays = 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInDays * 86400,
  };

  const enc = new TextEncoder();
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(fullPayload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const keyBytes = hexDecode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signingInput));
  return `${signingInput}.${base64urlEncode(sig)}`;
}

/**
 * Verify a JWT. Returns the decoded payload or throws an Error.
 * @param {string} token
 * @param {string} secret — hex-encoded 32-byte secret
 * @returns {Promise<object>} decoded payload
 */
export async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;

  const keyBytes = hexDecode(secret);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = base64urlDecode(sigB64);
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(signingInput));
  if (!valid) throw new Error('Invalid JWT signature');

  const payloadJson = new TextDecoder().decode(base64urlDecode(payloadB64));
  const payload = JSON.parse(payloadJson);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('JWT expired');

  return payload;
}

/**
 * Middleware: extract Bearer token, verify against jwt_secret in DB, return payload.
 * Throws a 401 Response if invalid.
 * @param {Request} request
 * @param {D1Database} db
 * @returns {Promise<object>} JWT payload
 */
export async function requireAuth(request, db) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.slice(7).trim();

  let profile;
  try {
    profile = await db.prepare('SELECT jwt_secret FROM profiles WHERE id = 1').first();
  } catch (e) {
    throw new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!profile || !profile.jwt_secret) {
    throw new Response(JSON.stringify({ error: 'App not configured' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = await verifyJWT(token, profile.jwt_secret);
    return payload;
  } catch (e) {
    throw new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
