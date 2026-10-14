# Job Vettai

*Vettai* means "the hunt". Job Vettai is an animated, AI-powered job search studio that runs in the browser and deploys to Vercel in a few clicks.

It brings the workflow of the open-source [ai-job-search](https://github.com/MadsLorentzen/ai-job-search) framework (a Claude Code command-line project) to a website: build your profile once, scan job portals, rank every posting against an honest fit framework, draft a tailored CV and cover letter with a reviewer pass, prep for interviews, and track every application.

## What it costs

Nothing is required to be paid:

| Piece | Cost |
|---|---|
| Hosting on Vercel's Hobby plan | Free (for personal, non-commercial use) |
| Job search (LinkedIn public listings, freehire.me), fonts, icons, libraries | Free, no accounts or keys |
| Every page in **heuristic mode** (no API key) | Free: keyword-based fit scoring, ranking, template CV and cover letter, interview prep pack, tracker, upskill heatmap |
| **Claude AI mode** (optional) | Pay-per-use Anthropic API credits, only if you add a key. Unlocks CV import from PDF, in-depth evaluation, tailored drafting with reviewer + revision, mock interviews |

The site never asks for payment details. The AI key is optional and can be added or removed any time in Settings.

**Free mode.** Anthropic's API has no free tier. If the Anthropic credit runs out, the site switches that browser to **Free mode** automatically, so every page keeps working with the free built-in engine instead of failing. You can also turn Free mode on yourself in Settings to avoid any AI cost. After adding credit, press **Test AI connection** in Settings; when it succeeds, Free mode switches off again. To make the whole site free for every visitor, delete `ANTHROPIC_API_KEY` in Vercel and redeploy.

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
| **Settings** | API key, model, theme (dark / light / system), reduce motion, backup export/import, reset | Morphing selection pills, spring switches |

Every page works on phones (bottom tab bar) and respects your operating system's reduced-motion setting.

## How the AI works

The API routes call Claude through the official Anthropic SDK with structured outputs, so every evaluation, draft and prep pack comes back as validated JSON. The weighted overall score (technical 30%, experience 25%, behavioral 15%, career 30%) and verdict bands are computed in code, not by the model.

The engine is chosen per request:

1. **The visitor's own API key**, if they enter one in Settings (stored only in their browser), plus a Workspace ID if that key isn't tied to a workspace.
2. **The deployment's key** (`ANTHROPIC_API_KEY`), optionally protected by an access code.
3. **Heuristic mode** if neither is available: keyword-overlap scoring and template drafts, so the site is never broken.

Job postings, CVs and web pages are always treated as untrusted data: the prompts tell Claude never to follow instructions found inside them, and HTML comments are stripped before text reaches the model. Drafts may only use facts from your profile; gaps are stated, never invented around.

## Deploy to Vercel

1. Push this repository to GitHub (already done if you are reading this there).
2. Go to [vercel.com/new](https://vercel.com/new), import the repository, and keep the detected **Next.js** settings.
3. Under **Environment Variables**, add:

   | Name | Required | Value |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | Recommended | Your key from [console.anthropic.com](https://console.anthropic.com). Without it, visitors use their own key or heuristic mode. |
   | `ANTHROPIC_WORKSPACE_ID` | Only if Anthropic asks for it | If you see "This API key is not scoped to a workspace", your key was created at organisation level. Set this to the workspace ID (`wrkspc_01…`, from Console → Settings → Workspaces), or create a new key inside a workspace instead. |
   | `APP_ACCESS_CODE` | Strongly recommended with a key | Any passphrase. Visitors must enter it in Settings before your key is used, so strangers cannot spend your credits. |
   | `ANTHROPIC_MODEL` | Optional | Defaults to `claude-opus-5-5`. Visitors can also pick a model in Settings. |

4. Click **Deploy**. Your site is live at `https://<project>.vercel.app`.

Changed or added an environment variable later (for example `ANTHROPIC_WORKSPACE_ID`)? Vercel only applies it to new deployments: open **Deployments**, choose the latest one, and click **Redeploy**.

The AI routes set `maxDuration` up to 300 seconds; drafting with review and revision makes three sequential calls, so keep Vercel's Fluid Compute enabled (the default).

## Troubleshooting

Open **Settings → Connection check** on your live site and press **Test AI connection**. It shows the deployed version, which variables are set (never their values), which key is being used, and the exact error if Claude can't be reached.

**"This API key is not scoped to a workspace…"**

1. **Is the fix deployed?** If the error starts with `Anthropic API rejected the request: 400 {…}`, the site is running an older build without workspace support. Make sure the latest code is merged into `main` and Vercel has finished deploying it (Connection check → *Site version* shows the commit).
2. **Which key is used?** A key saved in the site's Settings page (in your browser) overrides the Vercel key. Either add its Workspace ID in Settings, or click **Remove my browser key**.
3. **Site key:** in Vercel → Settings → Environment Variables, add `ANTHROPIC_WORKSPACE_ID` with the workspace ID (`wrkspc_01…`, from Anthropic Console → Settings → Workspaces). Tick **Production** and **Preview**.
4. **Redeploy.** Vercel applies variable changes only to new deployments: Deployments → latest → **Redeploy**.

Or skip the workspace ID entirely by creating a new API key *inside* a workspace in the Anthropic Console and using that as `ANTHROPIC_API_KEY`.

## Run locally

```bash
npm install
cp .env.example .env.local   # optionally add ANTHROPIC_API_KEY
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

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Zustand · Zod · Anthropic SDK · Lucide icons.

```
src/
  app/            pages + API routes (app/api/*)
  components/     shell (sidebar, nav), ui primitives, motion effects, charts
  lib/            types, fit framework, heuristic engine, store, document export
  lib/server/     Claude client, prompts, schemas, job sources, safe posting fetcher
```

## Credits

The fit framework, drafter-reviewer workflow, honesty rules and interview / upskill methods are adapted from [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search) (MIT License). Job Vettai is an independent project and is not affiliated with LinkedIn, freehire.me or Anthropic.
