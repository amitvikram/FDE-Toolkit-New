# FDE-Toolkit Setup and Deployment

## Repository structure

```text
FDE-Toolkit/
├── worker/        Cloudflare Worker, sandbox API, AI code generation, file serving
├── dashboard/     Next.js application, admin UI, tester dashboard, Convex backend
├── convex/        Located inside dashboard, schema, mutations, actions
└── Dockerfile     Container image used by each sandbox
```

## Prerequisites

| Tool | Purpose |
|---|---|
| Node.js 18+ | Running the project locally |
| [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) | Cloudflare Worker development and deployment |
| Cloudflare account | Worker, Containers, and AI binding |
| [Convex account](https://convex.dev) | Database and backend actions |

## Third-party services

| Service | Used for |
|---|---|
| Cloudflare AI | Code generation through the Worker AI binding |
| Convex | Database, GitHub actions, and tester management |
| Supermemory | Per-sandbox long-term memory and PR change history |
| Resend | Tester invitation emails |
| ElevenLabs | Text-to-speech responses |
| Hume AI | Emotion-detection telemetry |
| Gemini | Prompt refinement and speech-to-text cleanup |
| GitHub token | Repository import, branch creation, and pull requests |

## Install dependencies

```bash
npm install
cd worker && npm install
cd ../dashboard && npm install
```

## Configure the Worker

Create `worker/.dev.vars` for local development:

```ini
GEMINI_API_KEY=your_gemini_key
SUPERMEMORY_API_KEY=your_supermemory_key
```

For production, use Wrangler secrets:

```bash
cd worker
wrangler secret put GEMINI_API_KEY
wrangler secret put SUPERMEMORY_API_KEY
```

## Configure the dashboard

Create `dashboard/.env.local`:

```ini
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<your-deployment>.convex.site
CONVEX_DEPLOYMENT=dev:<your-deployment>

NEXT_PUBLIC_WORKER_BASE_URL=https://<your-worker>.workers.dev
BETTER_AUTH_SECRET=<random-32-char-string>

RESEND_API_KEY=re_...
ELEVENLABS_API_KEY=sk_...
NEXT_PUBLIC_HUME_API_KEY=...
GEMINI_API_KEY=...
SUPERMEMORY_API_KEY=sm_...
```

## Configure Convex environment variables

Set these in the Convex dashboard:

```text
WORKER_BASE_URL          https://<your-worker>.workers.dev
GITHUB_TOKEN             ghp_... with required repository and pull-request permissions
RESEND_API_KEY           re_...
SUPERMEMORY_API_KEY      sm_...
SITE_URL                 https://your-dashboard-domain.com
```

## Run locally

Open three terminals:

```bash
# Terminal 1
cd worker && npm run dev

# Terminal 2
cd dashboard && npx convex dev

# Terminal 3
cd dashboard && npm run dev
```

Cloudflare Containers are disabled in local development when `enable_containers` is set to `false` in `wrangler.jsonc`. Sandbox preview and file APIs can still run through the Worker's direct file-serving routes.

## Deploy

### Worker

```bash
cd worker
npm run deploy
```

### Convex

```bash
cd dashboard
npx convex deploy
```

### Dashboard

Deploy the Next.js dashboard to Vercel or self-host it:

```bash
npm run build
npm start
```

Set the local environment values as production environment variables in the selected hosting platform.

## Security reminders

- Never commit API keys, GitHub tokens, or `.env.local` files.
- Use minimum required GitHub permissions.
- Separate development, test, and production credentials.
- Apply tenant and project authorization checks to every sandbox and repository operation.
- Review generated changes before creating or merging pull requests.
