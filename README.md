# Job Vettai

*Vettai* means "the hunt". Job Vettai is an animated, AI-powered job search studio that runs in the browser and deploys to Vercel in a few clicks.

It brings the workflow of the open-source [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) framework (a Claude Code command-line project) to a website: build your profile once, scan job portals, rank every posting against an honest fit framework, draft a tailored CV and cover letter with a reviewer pass, prep for interviews, and track every application.

## What it costs

Everything can run for free, with no credit card anywhere:

| Piece | Cost |
|---|---|
| Hosting on Vercel's Hobby plan | Free (for personal, non-commercial use) |
| Job search (LinkedIn public listings, freehire.me), fonts, icons, libraries | Free, no accounts or keys |
| **Free AI**: Mistral (main) and Groq (backup) | Free tiers, no card. Unlocks CV import from PDF, in-depth evaluation, tailored drafting with reviewer + revision, interview prep, mock interviews |
| **Built-in engine** (no key at all) | Free: keyword-based fit scoring, ranking, template CV and cover letter, interview prep pack, tracker, upskill heatmap |
| **Claude** (optional) | Pay-per-use Anthropic API credits, only if you add an Anthropic key |

The site never asks for payment details.

**When the free AI is busy.** Free tiers have per-minute, daily and (on Mistral) monthly limits. Short per-minute waits are sat out automatically. If every AI engine is still busy or out of quota, that request shows an error and the browser switches to the **built-in engine** for a few minutes (per-minute limits) up to an hour (daily or monthly limits, outages), then goes back to AI by itself. Saved AI results are never replaced by built-in ones without asking. The switch stays on if an Anthropic balance runs out, until the key is changed or removed. You can also switch to the built-in engine yourself in Settings (**Built-in engine only**). After fixing a key, press **Test AI connection** in Settings; when an engine answers, AI switches back on.

### Get the free AI keys (5 minutes)

1. **Mistral (main engine):** sign up at [console.mistral.ai](https://console.mistral.ai) and choose the free plan (it may ask you to verify a phone number). Create a key under **API Keys**.
   *Privacy:* on the free plan Mistral may use your requests to improve its models. To opt out, go to **Admin → Privacy** and turn off **Anonymous improvement data**.
2. **Groq (backup engine):** sign up at [console.groq.com](https://console.groq.com) and create a key under **API Keys**.
   *Privacy:* under **Settings → Data Controls**, turn on **Zero Data Retention**.
3. In Vercel → your project → **Settings → Environment Variables**, add `MISTRAL_API_KEY` and `GROQ_API_KEY` (tick Production and Preview). If you had `ANTHROPIC_API_KEY` set and don't want to pay for Claude, delete it.
4. **Redeploy** (Deployments → latest → Redeploy), then open **Settings → Test AI connection** on your site. Both engines should answer.

One key is enough; two give a backup when one is busy.

## Pages

| Page | What it does | Animation style |
|---|---|---|
| **Dashboard** | Stats, application funnel, fit-score distribution, top matches, activity feed, "next best actions" | Aurora hero, counting number tickers, tilt + spotlight stat cards, bars that grow in, rotating gradient border |
| **Profile** (`/setup`) | Import a CV (PDF or text) and Claude extracts a structured profile; edit basics, skills, experience, goals, STAR stories | 3D sliding sections, chips that spring in, scanning-line import, pulsing drop zone |
| **Job Search** (`/scrape`) | Searches LinkedIn public listings and freehire.me together, dedupes, saves to your pipeline; add jobs by URL or pasted text | Shimmer skeletons, staggered blur-in cards, cursor-following spotlight, bookmark particle burst |
| **Rank & Shortlist** (`/rank`) | Batch triage scoring; deal-breakers veto, deadlines add 🔥 urgency, stale postings are flagged | Rising podium for the top 3, animated score rings, rows that re-order live as scores arrive |
| **Apply Studio** (`/apply`) | Source-host check, eligibility / language / location gates, 4-dimension fit evaluation, then draft → reviewer critique → revise → ATS keyword check; print to PDF, copy, or download Markdown | Stepper with a travelling light beam, radar chart, requirement ticks, documents that unfold like paper |
| **Interview Prep** (`/interview`) | Stage-specific prep pack mapped to your STAR stories, honest gap bridges, questions to ask, and a live mock interview with feedback | 3D flip cards, chat bubbles that slide in, typing indicator |
| **Tracker** (`/outcome`) | Kanban board of applications; drag between stages, timeline, notes, follow-up and thank-you drafts, CSV export | Cards that glide between columns, pulsing "follow up" badges for quiet applications |
| **Upskill** (`/upskill`) | Skill-gap heatmap across your target jobs and a phased learning plan | Heatmap tiles that ripple in diagonally, a timeline that draws itself |
| **Settings** | AI engines and connection test, optional Claude key and model, theme (dark / light / system), reduce motion, backup export/import, reset | Morphing selection pills, spring switches |

Every page works on phones (bottom tab bar) and respects your operating system's reduced-motion setting.

## How the AI works

Every AI route asks for structured output against a JSON schema, so every evaluation, draft and prep pack comes back as validated JSON. The weighted overall score (technical 30%, experience 25%, behavioral 15%, career 30%) and verdict bands are computed in code, not by the model.

The engine is chosen per request:

1. **The visitor's own Claude key**, if they enter one in Settings (stored only in their browser), plus a Workspace ID if that key isn't tied to a workspace.
2. **The deployment's engines**, in this order, optionally protected by an access code:
   - **Mistral** (`MISTRAL_API_KEY`, free): `mistral-medium-latest`, then `mistral-small-latest`.
   - **Groq** (`GROQ_API_KEY`, free): `openai/gpt-oss-120b`, then `openai/gpt-oss-20b`. Groq's free tier allows about 8,000 tokens a minute, so very long inputs are trimmed in the middle to fit.
   - **Claude** (`ANTHROPIC_API_KEY`, paid), only if set.
   When one engine is busy, rate-limited or down, the next one answers.
3. **The built-in engine** if none is available, or for a few minutes to an hour when all are busy: keyword-overlap scoring and template drafts, so the site is never broken.

Mistral and Groq can't read PDFs directly, so the server extracts the PDF's text first (scanned, image-only PDFs need the CV pasted as text).

Job postings, CVs and web pages are always treated as untrusted data: the prompts tell the model never to follow instructions found inside them, and HTML comments are stripped before text reaches the model. Drafts may only use facts from your profile; gaps are stated, never invented around.

## Deploy to Vercel

1. Push this repository to GitHub (already done if you are reading this there).
2. Go to [vercel.com/new](https://vercel.com/new), import the repository, and keep the detected **Next.js** settings.
3. Under **Environment Variables**, add:

   | Name | Required | Value |
   |---|---|---|
   | `MISTRAL_API_KEY` | Recommended (free) | Main AI engine. See [Get the free AI keys](#get-the-free-ai-keys-5-minutes). |
   | `GROQ_API_KEY` | Recommended (free) | Backup AI engine, used when Mistral is busy. |
   | `APP_ACCESS_CODE` | Recommended | Any passphrase. Visitors must enter it in Settings before the site's AI keys are used, so strangers can't use up your free quota (or credits). |
   | `MISTRAL_MODEL`, `GROQ_MODEL` | Optional | Another model from the same provider. On Groq, `openai/gpt-oss-*` models get strict structured output; other Groq models use JSON mode, which is less reliable. |
   | `ANTHROPIC_API_KEY` | Optional (paid) | Your key from [console.anthropic.com](https://console.anthropic.com), tried after the free engines. |
   | `ANTHROPIC_WORKSPACE_ID` | Only if Anthropic asks for it | If you see "This API key is not scoped to a workspace", your key was created at organisation level. Set this to the workspace ID (`wrkspc_01…`, from Console → Settings → Workspaces), or create a new key inside a workspace instead. |
   | `ANTHROPIC_MODEL` | Optional | Defaults to `claude-opus-5-5`. Visitors can also pick a model in Settings. |

   With no keys at all, the site still works with the built-in engine.

4. Click **Deploy**. Your site is live at `https://<project>.vercel.app`.

Changed or added an environment variable later (for example `MISTRAL_API_KEY`)? Vercel only applies it to new deployments: open **Deployments**, choose the latest one, and click **Redeploy**.

The AI routes set `maxDuration` up to 300 seconds; drafting with review and revision makes three sequential calls, so keep Vercel's Fluid Compute enabled (the default).

## Troubleshooting

Open **Settings → Connection check** on your live site and press **Test AI connection**. It shows the deployed version, which variables are set (never their values), the engine order, and each engine's answer or exact error.

**"The AI engines can't answer right now (…)"** Every engine was busy, out of quota or down; the brackets give each engine's reason. The browser uses the built-in engine for the time the message states and then retries AI by itself. If it keeps happening, add the second free engine (Mistral and Groq have separate limits), or set `APP_ACCESS_CODE` so only you use your quota. A reason such as "key rejected" or "free allowance used up" needs fixing rather than waiting: see below.

**"… free allowance used up"** Mistral's free plan has a monthly allowance; when it is spent, Mistral answers again next month (or turn on pay-as-you-go). Groq keeps working as the backup meanwhile.

**"No AI engine could be used. Mistral: key rejected…"** Every configured key was refused. Check the keys in Vercel and redeploy; Settings → Test AI connection shows each engine's exact error.

**"Mistral rejected MISTRAL_API_KEY" / "Groq rejected GROQ_API_KEY".** The key was mistyped, deleted or pasted with extra characters. Create a new key, update it in Vercel and redeploy.

**"The Anthropic credit balance is empty…"** Claude is paid. Add the free Mistral or Groq key instead, and delete `ANTHROPIC_API_KEY` if you don't want Claude.

**"This API key is not scoped to a workspace…"**

1. **Is the fix deployed?** If the error starts with `Anthropic API rejected the request: 400 {…}`, the site is running an older build without workspace support. Make sure the latest code is merged into `main` and Vercel has finished deploying it (Connection check → *Site version* shows the commit).
2. **Which key is used?** A key saved in the site's Settings page (in your browser) overrides the Vercel key. Either add its Workspace ID in Settings, or click **Remove my browser key**.
3. **Site key:** in Vercel → Settings → Environment Variables, add `ANTHROPIC_WORKSPACE_ID` with the workspace ID (`wrkspc_01…`, from Anthropic Console → Settings → Workspaces). Tick **Production** and **Preview**.
4. **Redeploy.** Vercel applies variable changes only to new deployments: Deployments → latest → **Redeploy**.

Or skip the workspace ID entirely by creating a new API key *inside* a workspace in the Anthropic Console and using that as `ANTHROPIC_API_KEY`.

## Run locally

```bash
npm install
cp .env.example .env.local   # optionally add MISTRAL_API_KEY / GROQ_API_KEY
npm run dev                  # http://localhost:3000
```

`npm run build` creates a production build and `npm run typecheck` runs TypeScript.

## Your data

Your profile, saved jobs, applications and reports live in your browser's local storage; the server stores nothing. Use **Settings → Export backup** regularly, especially before clearing browser data or switching devices. The dashboard's **Load sample data** button fills the app with a fictional tax professional's job hunt so you can explore every page.

## Job sources

- **LinkedIn**: public, unauthenticated guest listings, any country. Automated access is against LinkedIn's terms, so keep it to personal, low-volume use.
- **freehire.me**: an open job aggregator API with structured skills and salary data. Set `FREEHIRE_API_URL` to use a self-hosted instance.
- **Manual**: paste any posting URL (LinkedIn, company careers pages and most ATS pages with JSON-LD are parsed) or the posting text. URL fetching only reaches public web hosts; private and internal addresses are refused.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Zustand · Zod · Mistral and Groq (OpenAI-compatible APIs) · Anthropic SDK · unpdf · Lucide icons.

```
src/
  app/            pages + API routes (app/api/*)
  components/     shell (sidebar, nav), ui primitives, motion effects, charts
  lib/            types, fit framework, heuristic engine, store, document export
  lib/server/     AI engine chain (Mistral, Groq, Claude), PDF text, prompts, schemas, job sources, safe posting fetcher
```

## Credits

The fit framework, drafter-reviewer workflow, honesty rules and interview / upskill methods are adapted from [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search) (MIT License). Job Vettai is an independent project and is not affiliated with LinkedIn, freehire.me, Mistral AI, Groq or Anthropic.
