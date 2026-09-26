# 10x Astro Starter

![](./public/template.png)

A modern, opinionated starter template for building fast, accessible web applications.

## Tech Stack

- [Astro](https://astro.build/) v7 - Modern web framework with server-first rendering
- [React](https://react.dev/) v19 - UI library for interactive components
- [TypeScript](https://www.typescriptlang.org/) v6 - Type-safe JavaScript
- [Tailwind CSS](https://tailwindcss.com/) v4 - Utility-first CSS framework
- [Supabase](https://supabase.com/) - Authentication and backend-as-a-service
- [Cloudflare Workers](https://workers.cloudflare.com/) - Edge deployment runtime

## Prerequisites

- Node.js v24.21.0 or newer 24.x (as specified in `.nvmrc`)
- npm (comes with Node.js)

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/przeprogramowani/10x-astro-starter.git
cd 10x-astro-starter
```

2. Install dependencies:

```bash
npm install
```

3. Set up Supabase and configure environment variables — see [Supabase Configuration](#supabase-configuration) below.

4. Create a `.dev.vars` file for local Cloudflare dev secrets:

```bash
cp .env.example .dev.vars
```

5. Run the development server:

```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server (Cloudflare workerd runtime)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint with type-checked rules
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Run Prettier
- `npm test` - Run the unit tests (Vitest)
- `npm run test:db` - Run the per-user isolation suite in `tests/db/` against a running local Supabase (`npx supabase start` first)
- `npm run db:types` - Regenerate `src/lib/database.types.ts` from the local Supabase schema (never edit that file by hand)
- `npm run smoke` - Smoke test the auth flow and the gear routes against a running server backed by local Supabase (`BASE_URL`, defaults to `http://localhost:4321`)

## Project Structure

```md
.
├── src/
│ ├── layouts/ # Astro layouts
│ ├── pages/ # Astro pages
│ │ └── api/ # API endpoints
│ ├── components/ # UI components (Astro & React)
│ └── assets/ # Static assets
├── public/ # Public assets
├── wrangler.jsonc # Cloudflare Workers config
```

## Supabase Configuration

This project uses [Supabase](https://supabase.com/) for authentication. Environment variables are declared via Astro's `astro:env` schema and are treated as **server-only secrets** — they are never exposed to the client.

### First-time setup (local, no cloud project needed)

Requires [Docker](https://www.docker.com/) and ~7 GB RAM.

1. Create your `.env` file:

```bash
cp .env.example .env
```

2. Initialize the local Supabase project (creates a `supabase/` config folder):

```bash
npx supabase init
```

3. Start the local stack (downloads Docker images on first run):

```bash
npx supabase start
```

4. Copy the credentials printed by the CLI into your `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

5. To stop the stack when done:

```bash
npx supabase stop
```

The local Studio UI is available at `http://localhost:54323`.

`npx supabase start` applies the migrations in `supabase/migrations/` (sites, telescopes and eyepieces, each with per-user RLS). The hosted project's schema changes only when CI's `migrate` job runs after a merge to `main`.

### Using a cloud Supabase project instead

If you prefer to use a hosted Supabase project, add these variables to your `.env` and `.dev.vars` files:

| Variable       | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `SUPABASE_URL` | Project URL from Supabase dashboard → Settings → API       |
| `SUPABASE_KEY` | `anon` public key from Supabase dashboard → Settings → API |

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_KEY=<anon-key>
```

### Email confirmation in local development

By default Supabase requires email confirmation before a user can sign in. To skip this during local development:

1. Open the Supabase dashboard for your project
2. Go to **Authentication → Email → Confirm email**
3. Toggle it **off**

Users can then sign in immediately after sign-up without clicking a confirmation link.

### Auth routes

| Route                 | Description                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| `/auth/signin`        | Email/password sign-in form                                               |
| `/auth/signup`        | Email/password sign-up form                                               |
| `/auth/confirm-email` | Post-signup "check your inbox" page                                       |
| `/dashboard`          | Retired starter page: redirects to `/tonight` (anonymous: `/auth/signin`) |

Route protection is handled in `src/middleware.ts`. Add paths to the `PROTECTED_ROUTES` array there to require authentication.

## Deployment

This project deploys to [Cloudflare Workers](https://workers.cloudflare.com/).

1. Build the project:

```bash
npm run build
```

2. Deploy with Wrangler:

```bash
npx wrangler deploy
```

Set `SUPABASE_URL` and `SUPABASE_KEY` as secrets in your Cloudflare dashboard or via `npx wrangler secret put`.

## Smoke test

`scripts/smoke.mjs` is a dependency-free Node script that walks the auth flow (sign-up, sign-in, protected page, sign-out) and the gear routes (create a site, a telescope and an eyepiece; reject an invalid site) over HTTP. Run it against the dev server or the production preview after dependency upgrades:

```bash
npm run dev            # or: npm run build && npm run preview
BASE_URL=http://localhost:4321 npm run smoke
```

It needs a local Supabase (`npx supabase start`, email confirmation disabled in `supabase/config.toml`). Never run it against the hosted project: it signs up real users.

> **Note:** this script exists primarily to guard the development of the starter itself — it is a fast sanity check that dependency upgrades did not break the build, the Cloudflare adapter or the Supabase auth flow. It is **not** a substitute for a real test suite. Once you build your own product on top of this starter, add proper tests (unit, integration, end-to-end) suited to your application.

## CI

GitHub Actions runs two jobs on every push and PR to `main`:

- **ci** — lint, `astro check`, unit tests (`npm test`) and build. Configure `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets for the build step.
- **smoke** — starts a local Supabase via the Supabase CLI, builds, serves the production preview on the Cloudflare runtime and runs `npm run smoke` against it. No secrets required.

## Data sources

- **[OpenNGC](https://github.com/mattiaverga/OpenNGC)** by Mattia Verga, licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The Messier catalogue in
  `src/lib/catalogue/` is generated from OpenNGC at commit `da90466031b0372c896588b85be6016c617e205b`
  by `npm run catalogue:build`. The generated catalogue files are derived works and are themselves
  licensed CC BY-SA 4.0; see `src/lib/catalogue/LICENSE-DATA.md` for the exact changes and acknowledgements.
  - This research has made use of the NASA/IPAC Extragalactic Database (NED), which is operated by the
    Jet Propulsion Laboratory, California Institute of Technology, under contract with the National
    Aeronautics and Space Administration.
  - This research has made use of the SIMBAD database, operated at CDS, Strasbourg, France.
  - OpenNGC used several HEASARC tables (messier, mwsc, lbn, plnebulae, lmcextobj, smcclustrs).
- **[astronomy-engine](https://github.com/cosinekitty/astronomy)** by Don Cross (MIT) provides the sun,
  moon and object position calculations.

## License

MIT (application code). Catalogue data files are CC BY-SA 4.0 — see "Data sources" above.
