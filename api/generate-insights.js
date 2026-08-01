// Vercel serverless function — proxies "Generate Insights Report" requests to the
// Google Gemini API. Keeps the API key server-side (never exposed to the browser).
//
// Requires an environment variable set in your Vercel project settings:
//   GEMINI_API_KEY = AIza...
//
// The client (index.html) posts { system, message } and gets back { text }.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: 'GEMINI_API_KEY is not configured on the server. Add it under Vercel Project Settings → Environment Variables, then redeploy.'
    });
    return;
  }

  const { system, message } = req.body || {};
  if (!message) {
    res.status(400).json({ error: 'Missing "message" in request body.' });
    return;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.4 }
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      res.status(geminiRes.status).json({ error: data?.error?.message || 'Gemini API returned an error.' });
      return;
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('');

    if (!text) {
      // Most likely the response was blocked by a safety filter, or hit the token limit.
      const finishReason = data?.candidates?.[0]?.finishReason;
      res.status(200).json({ text: '', warning: finishReason ? `Gemini returned no text (finishReason: ${finishReason}).` : 'Gemini returned an empty response.' });
      return;
    }

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
