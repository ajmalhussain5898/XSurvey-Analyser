# XSurvey Analyser

A single-page survey analysis tool built for Infinix — upload a survey export, build a
Question Dictionary, run Frequency/Cross-Tab/Multi-Response/Descriptive analysis plus
PSM (Van Westendorp & Gabor-Granger), Max-Diff, Conjoint, and Kano, assemble an
executive Dashboard, and generate an AI-written Insights Report.

## Project structure

```
xsurvey-analyser/
├── index.html                  # the entire app (UI + logic), static, no build step
├── api/
│   └── generate-insights.js    # Vercel serverless function — proxies the Insights
│                                 # Report request to the Anthropic API server-side
├── package.json
├── vercel.json
├── .env.example
└── .gitignore
```

Everything except the `/api` function is a static file — there's no build step, no
framework, no bundler. Vercel serves `index.html` directly and deploys
`api/generate-insights.js` as a serverless function automatically because it lives
in the `/api` folder.

## Why there's a server function at all

Inside this app, one feature — **Generate Insights Report** — calls Claude to write
an executive summary from whatever's pinned to the Dashboard. That call needs an
Anthropic API key. The key must never be shipped to the browser (anyone could open
dev tools and steal it), so `api/generate-insights.js` holds the key server-side and
the front end calls that endpoint instead of Anthropic directly. Every other feature
in the app (upload, Dictionary, Analysis, Dashboard, Excel/PNG export) runs entirely
client-side and needs no server at all.

## Deploy — GitHub → Vercel

1. **Create a new GitHub repo** and push this folder to it:
   ```bash
   cd xsurvey-analyser
   git init
   git add .
   git commit -m "Initial commit — XSurvey Analyser"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Import the repo in Vercel**
   - Go to [vercel.com/new](https://vercel.com/new), choose "Import Git Repository," and pick this repo.
   - Framework preset: leave as **Other** / static — no build command, no output directory needed.

3. **Add your API key**
   - In the Vercel project → **Settings → Environment Variables**, add:
     - `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
   - (Optional) `ANTHROPIC_MODEL` if you want a model other than the default `claude-sonnet-5`.
   - Redeploy after adding the variable (env vars only apply to new deployments).

4. **Deploy.** Vercel gives you a live URL (`your-project.vercel.app`). Everything works immediately except the Insights Report, which works once step 3 is done.

## Local development

```bash
npm install -g vercel   # once, if you don't have it
cp .env.example .env.local
# edit .env.local and paste your real ANTHROPIC_API_KEY
vercel dev
```

This serves `index.html` and runs `api/generate-insights.js` locally, so you can test
the Insights Report before deploying.

## A note on data persistence

Uploaded data, the Question Dictionary, and the Dashboard are saved in the visitor's
own browser (`localStorage`), not on a server or database. That means:

- Data persists across refreshes **on the same browser, same device**.
- It is **not shared** between different people who visit the deployed URL — each
  visitor has their own local copy, and nobody's uploaded survey data is sent to
  or stored on Vercel.
- Clearing browser data, or using a different browser/device, starts fresh.

If you later need shared, multi-user, cross-device storage (e.g. so an analyst and
an executive see the same Dashboard from different computers), that requires adding
a real backend/database — happy to help design that when you're ready for it.

## Known limitations carried over from the current build

- Cross-tab significance is a simple threshold flag, not a real z-test.
- Native Excel chart export is hand-built OOXML; it's been tested to open and
  round-trip correctly, but if a chart ever looks off in your specific Excel
  version, the PNG and data-only Excel exports are reliable fallbacks.
- Max-Diff, Conjoint, and Kano use proxy methods (best-worst pick-lists,
  Borda-count ranking, and a manual Kano response-mapping step) rather than
  requiring a formal MaxDiff/CBC/Kano survey design — because most real-world
  questionnaires (including the Infinix one this was built against) aren't
  fielded in that strict format. Point them at properly designed instruments
  and the same math still applies.
