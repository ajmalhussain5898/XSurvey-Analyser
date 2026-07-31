// Vercel serverless function — proxies "Generate Insights Report" requests to the
// Anthropic API. Keeps the API key server-side (never exposed to the browser).
//
// Requires an environment variable set in your Vercel project settings:
//   ANTHROPIC_API_KEY = sk-ant-...
//
// The client (index.html) posts { system, message } and gets back the raw
// Anthropic /v1/messages response, which the front end already knows how to read.

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not configured on the server. Add it under Vercel Project Settings → Environment Variables, then redeploy.'
    });
    return;
  }

  const { system, message } = req.body || {};
  if (!message) {
    res.status(400).json({ error: 'Missing "message" in request body.' });
    return;
  }

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1000,
        system: system || undefined,
        messages: [{ role: 'user', content: message }]
      })
    });

    const data = await anthropicRes.json();

    if (!anthropicRes.ok) {
      res.status(anthropicRes.status).json({ error: data?.error?.message || 'Anthropic API returned an error.' });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
