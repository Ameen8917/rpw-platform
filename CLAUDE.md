# CLAUDE.md


## What this is

Ratnapprabbha World (RPW) internal operations platform for a multi-brand automotive dealership group (Mahindra, Honda, JCB, etc. in Maharashtra).

Current state: the original single-file prototype (`rpw-platform.tsx`, kept at the repo root as a reference, not built) has been split into a Vite + React + TypeScript app in `frontend/`. Every module reads and writes through the API: Asset Management since M6, and since M8–M11 requisitions (approvals, Director step-in, procurement, verification), payments, escalations, group settings and the Admin console. Specs, decisions and milestones: `docs/asset-management.md` (M1–M7) and `docs/requisitions.md` (M8–M11).

`backend/` (Express 5 + TypeScript, strict) is at milestone M11: config validation (`src/config/env.ts`), Sequelize connection to Supabase Postgres, Umzug migrations in `src/db/migrations` (each runs in a transaction), JSON error shape, Zod `validate` middleware, `/api/health`. `createApp(deps)` in `src/app.ts` takes its dependencies so API tests run without a database. Our tables live in the `rpw` schema, never `public` (see `docs/supabase-setup.md`). Migrations only go forward; there is no down script.

Backend modules live in `src/modules/<name>/` split into `*.models.ts`, `*.repository.ts` (only place that touches models), `*.service.ts`, `*.controller.ts`, `*.routes.ts`, `*.schemas.ts`, `*.dto.ts`. DTOs match `frontend/src/types`.
- `org`: dealerships, facilities, departments, users (text IDs from the prototype, e.g. `D_JCB_NSK`). `GET /api/org/*` for everyone signed in.
- `auth`: employee code + password (scrypt), server-side sessions in an httpOnly SameSite=Strict cookie; the DB stores only HMAC(SESSION_SECRET, token). `permissionsFor()` ports the prototype's `P()`; powers the prototype tied to user IDs are `users.grants`. `requireAuth` puts `{ user, permissions }` on `res.locals.auth`. `DEV_LOGIN_ENABLED` mounts `/api/auth/dev/*` ("sign in as"), refused in production.
- `assets`: register, detail, lookup (code or tag ID), add existing asset, add accessory (capitalisation floor from settings), dispose (`asset_disposals`; issued assets must be returned first), procured assets (`createProcured`, called by the requisitions service; one `asset_procurements` row per requisition reference, with its verification). Pure rules (code format, FY, depreciation, visibility scope) in `asset-rules.ts`, ported from `frontend/src/domain/assets.ts`; keep the two in step. Codes come from `asset_code_sequences` via an upsert inside the insert's transaction. Out-of-scope assets are 404. Asset IDs are UUIDs.
- `assets` custody (`custody.*.ts`): issue / accept / return as rows in `asset_custody_events`; the asset points at its current issue (`custody_event_id`), the event that acknowledged it, and its last return. Changes lock the asset row (`lockById`) and re-check state inside the transaction. `GET /api/custody` is the register.
- `files`: Supabase Storage via its REST API (`storage.ts`, no SDK), private bucket, service role key only on the server. Upload first, then `record()` the file row inside the action's transaction, `discard()` on failure. Responses carry 10-minute signed URLs. Tests use `createMemoryStorage()`; unconfigured storage answers 503 on upload.
- `invoices`: optional AI reading of invoice photos/PDFs (decision D6, `docs/invoice-extraction.md`). `GET /api/invoices/status`, `POST /api/invoices/extract` (raw file body, type checked from its bytes). Claude through `@anthropic-ai/sdk` in `invoice-reader.ts` with a JSON-schema output, then Zod; off (503) without `ANTHROPIC_API_KEY`. Tests use a fake reader or a stub `fetch`, never the real API.
- `requisitions`: raise, decisions per stage (`POST /:id/decisions/:stage`), resubmit, procure, verify / send back, payments. Stored in the frontend's `Requisition` shape (approvals and payments in their own tables; the purchase is the `asset_procurements` row). Pure rules in `requisition-rules.ts`, ported from `frontend/src/domain/requisitions.ts` and `payments.ts`; keep them in step. Each action locks the requisition row and re-checks state in the transaction. References `REQ-<year>-<NNNN>` from `requisition_ref_sequences`. Out-of-scope requisitions are 404.
- `settings`: group limits (`GET/PUT /api/settings`); the frontend writes them into `LIMITS` on load.
- `org` writes (Admin console, `canAdminConsole`): add dealerships, locations, departments, people (with an initial password), bulk staff; activate / deactivate; authority; handover. Only the Director changes a Director.
- `audit`: append-only `audit_log` (a trigger rejects UPDATE/DELETE). Write entries with `auditRepository.record(entry, transaction)` inside the action's transaction. `GET /api/audit` needs `canSeeAudit`.

Sequelize mutates attribute definitions (it writes the column name into them), so never share one definition object between columns or between queries' `include` lists; use factories (`userRef()`, `standard()`).

Seeds: org data is upserted; assets (`db/seed/asset-data.ts`), requisitions (`db/seed/requisition-data.ts`), both generated from the frontend seed, audit entries and default group settings are inserted only if missing, never overwritten.

Tests: `*.test.ts` unit/API tests need no DB. `*.int.test.ts` run against `TEST_DATABASE_URL` in schema `rpw_test`, which `src/test/global-setup.ts` drops and rebuilds from migrations + seed on every run; they are skipped (with a warning) if it is unset.

Layout of `frontend/src`:
- `types/` — domain model (the contract the backend must match)
- `domain/` — pure business rules (asset codes, depreciation, custody, approval/payment state machines, permissions). Unit-tested and the first candidates to share with the backend.
- `lib/api.ts` — fetch client (`/api`, proxied by Vite to :4000), `ApiError`, `errorMessage()`; a 401 outside `/auth` returns to sign-in
- `features/shell/session.ts` — sign-in state (`useSession`), development "sign in as"
- `features/invoices/invoiceReader.ts` — invoice reading status/extract, photo shrinking; manual entry never depends on it
- `features/assets/api.ts` — asset and org calls, form → request body mapping
- `features/requisitions/api.ts` — requisition, settings and Admin console calls
- `data/seed.ts` — prototype seed data (tests only; everything in the app comes from the API)
- `components/` — shared UI kit and widgets (Barcode, EmployeePicker, SignaturePad)
- `features/<module>/` — screens per module (assets, requisitions, payments, procurement, escalations, audit, admin, shell)

TypeScript runs with `strict: false` during migration. Tighten it module by module, starting with `domain/` and `features/assets/`.

Commands (from the repo root): `npm run dev` (frontend), `npm run dev:api` (backend), `npm run build | typecheck | lint | test` (both workspaces), `npm run db:check[:test]` (read-only connection test), `npm run db:migrate[:status]`, `npm run storage:check` (Supabase Storage bucket round trip), `npm run db:seed` (prototype org data, assets and audit entries; sets SEED_USER_PASSWORD only where no password exists). Manual API requests: `docs/api.http` (REST Client).


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
