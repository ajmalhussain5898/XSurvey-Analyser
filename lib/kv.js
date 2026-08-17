// Thin wrapper around @upstash/redis so every /api file imports from one place.
// (Vercel KV itself is deprecated in favor of Upstash Redis via the Vercel
// Marketplace — same underlying service, current supported path.)
//
// Setup: Vercel dashboard → Storage → Create Database → "Upstash Redis" (or add
// the Upstash integration from the Marketplace) → Connect it to this project.
// That auto-injects KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN, depending on integration version) — both are read here.

const { Redis } = require('@upstash/redis');

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const client = (url && token) ? new Redis({ url, token }) : null;

function requireClient() {
  if (!client) {
    throw new Error('No Redis store connected. In Vercel: Storage → add an Upstash Redis database and connect it to this project, then redeploy.');
  }
  return client;
}

const kv = {
  get: (key) => requireClient().get(key),
  set: (key, value) => requireClient().set(key, value),
  del: (key) => requireClient().del(key),
  keys: (pattern) => requireClient().keys(pattern)
};

module.exports = { kv };
