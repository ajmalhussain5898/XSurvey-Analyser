# XSurvey Analyser

A survey analysis tool built for Infinix — upload a survey export, build a Question
Dictionary, run Frequency/Cross-Tab/Multi-Response/Descriptive analysis plus PSM
(Van Westendorp & Gabor-Granger), Max-Diff, Conjoint, and Kano, assemble an
executive Dashboard, and chat with an AI grounded in whatever's pinned to it.

Everyone signs in first. There are three roles:

- **Analyst** — full access: Data, Analysis, Dashboard, Insights chat.
- **Executive Viewer** — Dashboard and Insights chat only, read-only.
- **Admin** — everything an Analyst has, plus the **Admin Portal** tab to approve
  access requests and manage everyone's access.

## Project structure

```
xsurvey-analyser/
├── index.html                    # the entire front end (UI + logic), static, no build step
├── api/
│   ├── auth-login.js              # POST — sign in, returns a session token
│   ├── auth-request-access.js     # POST — public "request access" form submission
│   ├── admin-list.js              # GET  — (admin) pending requests + active users
│   ├── admin-approve.js           # POST — (admin) approve a request, creates the user
│   ├── admin-reject.js            # POST — (admin) reject a request
│   ├── admin-revoke.js            # POST — (admin) revoke a user's access
│   ├── admin-role.js              # POST — (admin) change a user's role
│   └── chat.js                    # POST — the interactive AI chat (Generate Insights Report tab)
├── lib/
│   ├── auth.js                    # password hashing + signed session tokens (no external deps)
│   └── kv.js                      # Redis (Upstash) client wrapper
├── package.json
├── vercel.json
├── .env.example
└── .gitignore
```

Everything except `/api` is a static file — no build step, no framework, no bundler.
Vercel serves `index.html` directly and deploys everything under `/api` as
serverless functions automatically.

## What's new in this version

1. **Login + Admin Portal.** Nobody sees the tool without signing in. New people
   land on a **Request Access** screen; you approve or reject them from the
   **Admin Portal** tab, which also lets you change anyone's role or revoke access.
   Approving a request generates a password and shows it to you once, on screen —
   nothing is emailed automatically, so send it to the person yourself.
2. **Interactive AI chat.** The Generate Insights Report tab is now a real
   back-and-forth chat, not a single "click to generate" report. Every message is
   automatically grounded in whatever's currently pinned to the Dashboard, but you
   can ask it anything — draft a summary, drill into one section, ask a general
   question.
3. **Three themes.** Black (default), White, and Blue — switch anytime from the
   swatches in the left nav; your choice is remembered.
4. **Empty sections never appear in exports.** The "Download Dashboard as PDF" and
   "Download LaTeX" buttons now skip any Dashboard section that has no pinned
   chart/table and no key insight text.

## Why there are server functions at all

- **Login/Admin Portal** need a server + database — passwords and roles can't live
  in the browser. `api/auth-*.js` and `api/admin-*.js` handle this, backed by an
  Upstash Redis store (see setup below).
- **AI chat** calls Gemini, which needs an API key that must never reach the
  browser. `api/chat.js` holds that key server-side; it also requires a valid
  login token, so only approved users can use it.

Every other feature (upload, Dictionary, Analysis, Dashboard, Excel/PNG/PDF/LaTeX
export) runs entirely client-side and needs no server at all.

## Deploy — GitHub → Vercel

1. **Create a new GitHub repo** and push this folder to it:
   ```bash
   cd xsurvey-analyser
   git init
   git add .
   git commit -m "XSurvey Analyser v2 — login, Admin Portal, AI chat, themes"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

2. **Import the repo in Vercel** — [vercel.com/new](https://vercel.com/new) →
   Import Git Repository → pick this repo. Framework preset: **Other** / static —
   no build command, no output directory.

3. **Add an Upstash Redis store** (this is the database for logins/roles)
   - In your Vercel project → **Storage** → **Create Database** → choose
     **Upstash Redis** (or install the Upstash integration from the Vercel
     Marketplace if that's what's offered) → **Connect** it to this project.
   - This automatically injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or
     `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — `lib/kv.js` reads
     either). Nothing to type in manually here.

4. **Set environment variables** — Project → **Settings → Environment Variables**:

   | Variable | Value |
   |---|---|
   | `GEMINI_API_KEY` | your key from [aistudio.google.com](https://aistudio.google.com) |
   | `GEMINI_MODEL` | optional, defaults to `gemini-2.5-flash` |
   | `SESSION_SECRET` | any long random string — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `ADMIN_EMAIL` | your email — this becomes your Admin login |
   | `ADMIN_PASSWORD` | a strong password you choose |

   Redeploy after adding these (env vars only apply to new deployments).

5. **Deploy**, then open the live URL and **sign in with `ADMIN_EMAIL` /
   `ADMIN_PASSWORD`**. That first login automatically creates your Admin account
   in the database — no manual database step needed. From then on, approve
   everyone else from the **Admin Portal** tab.

## Local development

```bash
npm install -g vercel   # once, if you don't have it
npm install              # installs @upstash/redis
cp .env.example .env.local
# edit .env.local with real values (you still need a real Upstash Redis store —
# create one in Vercel and copy its REST URL/token into .env.local for local testing)
vercel dev
```

## A note on data persistence

- **Login accounts and roles** live in your Upstash Redis store — shared across
  everyone, survives deploys.
- **Uploaded survey data, the Question Dictionary, and the Dashboard** are still
  saved per-browser in `localStorage`, exactly as before — not shared between
  people, not sent to or stored on Vercel. Clearing browser data, or using a
  different browser/device, starts fresh for that person.
- If you later need the Dashboard/dataset itself to be shared across people and
  devices (not just logins), that's a further step — happy to help design that
  when you're ready.

## Known limitations carried over from the previous build

- Cross-tab significance is a simple threshold flag, not a real z-test.
- Native Excel chart export is hand-built OOXML; tested to open and round-trip
  correctly, but the PNG and data-only Excel exports are reliable fallbacks if a
  chart ever looks off in your specific Excel version.
- Max-Diff, Conjoint, and Kano use proxy methods (best-worst pick-lists,
  Borda-count ranking, manual Kano response-mapping) rather than requiring a
  formal MaxDiff/CBC/Kano survey design, since most real-world questionnaires
  (including the Infinix one this was built against) aren't fielded that way.

## New limitations to be aware of

- The generated password on approval is shown **once**, on screen, and isn't
  stored anywhere retrievable — copy it before navigating away. If it's missed,
  there's currently no "reset password" action; the workaround for now is to
  revoke that user and have them submit a fresh access request.
- There's no automated email delivery — you send credentials to people yourself
  (WhatsApp, email, etc.). Adding an email API (e.g. Resend) later would let
  approval emails go out automatically — say the word if you want that added.
