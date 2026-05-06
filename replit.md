# Memozapia

A "Second Brain" note-taking app with AI-ready foundations — users can create, search, filter by tag, and manage notes with a beautiful glassmorphism UI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/memozapia run dev` — run the frontend (port 20588)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifact: `artifacts/memozapia/`, preview path: `/`)
- API: Express 5 (artifact: `artifacts/api-server/`, preview path: `/api`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI source of truth
- `lib/db/src/schema/notes.ts` — Notes table (Drizzle schema)
- `artifacts/api-server/src/routes/notes.ts` — Notes CRUD + tags endpoints
- `artifacts/memozapia/src/App.tsx` — Main React app with all components inline
- `artifacts/memozapia/src/memozapia.css` — Custom glassmorphism CSS (separate from Tailwind)

## Architecture decisions

- Notes app ported from CRA (create-react-app) + Express to Vite + React + PostgreSQL (Drizzle)
- The original JSON file-based database was replaced with PostgreSQL for persistence
- All frontend components are in `App.tsx` (single file) to match the original simple structure
- CSS uses a custom `mz-` prefix namespace to avoid conflicts with existing Tailwind/shadcn classes
- Tags are stored as a `text[]` array column in PostgreSQL (no separate tags table)

## Product

- Create, edit, and delete notes with title, content, and tags
- Search notes by keyword (debounced 300ms)
- Filter notes by tag
- Glassmorphism UI design with indigo/purple theme

## User preferences

- App is in Spanish (UI labels, alerts, etc.)

## Gotchas

- After changing `lib/api-spec/openapi.yaml`, always run codegen before using updated types
- `lib/api-zod/src/index.ts` must only export from `./generated/api` (not types) to avoid name conflicts
- Do not run `pnpm dev` at the workspace root — use workflow or `--filter` flag

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
