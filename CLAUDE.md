# CLAUDE.md


## What this is

Ratnapprabbha World (RPW) internal operations platform for a multi-brand automotive dealership group (Mahindra, Honda, JCB, etc. in Maharashtra).

Current state: the original single-file prototype (`rpw-platform.tsx`, kept at the repo root as a reference, not built) has been split into a Vite + React + TypeScript app in `frontend/`. Behaviour is unchanged: all state still lives in memory in `frontend/src/App.tsx` and resets on reload. Asset Management is the first module moving to the backend; its spec, decisions and milestones are in `docs/asset-management.md`.

`backend/` (Express 5 + TypeScript, strict) is at milestone M1: config validation (`src/config/env.ts`), Sequelize connection to Supabase Postgres, Umzug migrations in `src/db/migrations`, JSON error shape, Zod `validate` middleware, `/api/health`. `createApp(deps)` in `src/app.ts` takes its dependencies so API tests run without a database. Our tables live in the `rpw` schema, never `public` (see `docs/supabase-setup.md`). Migrations only go forward; there is no down script.

Layout of `frontend/src`:
- `types/` — domain model (the contract the backend must match)
- `domain/` — pure business rules (asset codes, depreciation, custody, approval/payment state machines, permissions). Unit-tested and the first candidates to share with the backend.
- `data/seed.ts` — prototype seed data
- `components/` — shared UI kit and widgets (Barcode, EmployeePicker, SignaturePad)
- `features/<module>/` — screens per module (assets, requisitions, payments, procurement, escalations, audit, admin, shell)

TypeScript runs with `strict: false` during migration. Tighten it module by module, starting with `domain/` and `features/assets/`.

Commands (from the repo root): `npm run dev` (frontend), `npm run dev:api` (backend), `npm run build | typecheck | lint | test` (both workspaces), `npm run db:check` (read-only connection test), `npm run db:migrate[:status]`.


# Project Instructions

## Project
Build a production-quality full-stack web application.

## Technology Stack
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- Validation: Zod
- API: REST
- Testing: Unit tests and API integration tests

## Architecture
- Use a modular monolith.
- Separate frontend and backend.
- Organize backend code by feature/module.
- Keep routes, controllers, services, schemas and database access separate.
- Use reusable frontend components and feature-based folders.
- Follow existing conventions once established.

## Security
- Never hardcode secrets or credentials.
- Never read, print, or expose real .env values.
- Use process.env for backend configuration.
- Validate required environment variables at startup.
- Validate all incoming API requests with Zod.
- Never expose server secrets to frontend code.
- Use parameterized database queries.
- Do not run destructive database commands without approval.

## Development Workflow
- Start with a plan before implementation.
- Implement one feature at a time.
- Explain important architectural decisions.
- Write tests for business logic and API endpoints.
- Run lint, typecheck, tests and build where configured.
- Fix regressions introduced by changes.
- Do not claim tests passed unless they actually passed.
- Do not commit or deploy without approval.

## Environment Variables
- Use .env.example for variable names and placeholders.
- Keep real .env files out of version control.
- Do not change real secrets.
- Ask for missing configuration names, not secret values.
