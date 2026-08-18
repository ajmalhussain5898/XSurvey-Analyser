// Vercel serverless function — powers the interactive "Generate Insights Report"
// chat. Keeps the Gemini API key server-side. Requires the caller to be logged in
// (any role) so AI usage is tied to an approved account.
//
// Env vars required:
//   GEMINI_API_KEY = AIza...
//   SESSION_SECRET = <same secret used to sign login tokens>
//   GEMINI_MODEL (optional, defaults to gemini-3.6-flash below)
//
// POST body: { system: string, messages: [{role:'user'|'assistant', text:string}, ...] }
// -> { text }

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const { requireAuth } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed. Use POST.' }); return; }
  if (!requireAuth(req, res)) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server. Add it under Vercel Project Settings → Environment Variables, then redeploy.' });
    return;
  }

  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Missing "messages" in request body.' });
    return;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const contents = messages
      .filter(m => m && m.text)
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.text) }] }));

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: { maxOutputTokens: 2048, temperature: 0.5 }
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
      const finishReason = data?.candidates?.[0]?.finishReason;
      res.status(200).json({ text: '', warning: finishReason ? `Gemini returned no text (finishReason: ${finishReason}).` : 'Gemini returned an empty response.' });
      return;
    }

    res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};
