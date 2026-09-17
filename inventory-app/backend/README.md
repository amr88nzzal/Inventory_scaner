# Inventory Audit App — Backend (Phase 1 + Phase 2)

Node.js + Express + Prisma + PostgreSQL API for the inventory audit system.

## What's implemented

**Phase 1 — core audit flow**
- Company signup (creates the company + first admin)
- Admin: create employees/reviewers with per-warehouse permission scope
- Admin: create warehouses + storage locations
- Admin: create items with barcode + one or more units (base unit mandatory
  quantity, e.g. "صندوق" = 24 "قطعة")
- Bulk item import via CSV (`POST /items/import/csv`)
- Admin: assign an audit task to one or more employees, scoped to a
  warehouse + item scope (all / category / supplier / explicit list), with
  a start time
- Employee: list assigned tasks (`GET /audit-tasks/mine`)
- Scan ingestion, single record (`POST /audit-records`)
- Reporting an unregistered barcode (`POST /audit-records/pending-items`)
- Admin: approve/reject pending items, which registers them as real Items
- Final report generation per task with variance calculation and CSV export

**Phase 2 — offline & sync**
- `AuditRecord` is an **append-only** table (see `prisma/schema.prisma`
  comments) — every scan is a new row keyed by employeeId + deviceTimestamp,
  never an in-place update. This is what avoids lost updates when several
  employees scan the same item concurrently while offline.
- Bulk sync endpoint (`POST /audit-records/sync`) — the mobile app queues
  scans locally while offline and uploads the whole batch in one call once
  connectivity returns; every row is tied to the authenticated employee's
  account automatically (no employeeId spoofing risk since it comes from
  the JWT, not the request body).
- Report generation aggregates across all synced records for a task,
  honoring `aggregateAcrossLocations` (sum the same item across shelves) vs.
  keeping entries sequential, and `showVarianceAtEnd` (admin toggle).
- Recount trigger: `computeVariance()` checks the discrepancy against a
  per-item tolerance override, falling back to the task's general
  tolerance, falling back to a 10% default.

**Direct external-database import**
- `POST /import/from-database` — admin supplies a connection string, a
  read-only `SELECT` query, and a column mapping; the endpoint validates the
  query is read-only, runs it, and creates any items not already present.
  Postgres works out of the box (`pg`); MySQL needs `mysql2` installed too
  (both are already listed in `package.json`).

## Not yet built (flagged as future modules, per our discussion)
- Batch/Lot/Expiry (GS1-128) — deprioritized for now
- Blind-count enforcement on the client (the `blindCount` flag exists on
  `AuditTask`; the mobile app must respect it by hiding `systemQty`)
- Accounting-software integration beyond CSV export
- iOS push notifications need an APNs key configured in Firebase (Android/FCM works as-is)

## Push notifications (implemented)
- `POST /users/me/fcm-token` registers a device token for the logged-in user.
- Task assignment (`POST /audit-tasks`) sends a push to every assignee immediately.
- Report generation (`POST /tasks/:taskId/generate`) notifies all company admins when a task is flagged `NEEDS_RECOUNT`.
- See `src/utils/notifications.ts` — set `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env` to enable.

## Setup

```bash
cp .env.example .env      # edit DATABASE_URL / JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run dev
```

## Deploying on your Oracle Cloud server

```bash
docker compose up -d --build
```

This starts Postgres (mapped to host port 5433 to avoid clashing with any
other DB you're already running) and the API (port 4000). Put this behind
your existing reverse proxy / Cloudflare Tunnel setup the same way you did
for [[amrodev-server]], pointing a subdomain (e.g.
`inventory-api.amrodev.com`) at port 4000.

## Key endpoints

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /auth/signup | public | create company + admin |
| POST | /auth/login | public | get JWT |
| POST | /users | admin | add employee/reviewer |
| POST | /users/me/fcm-token | any authenticated user | register/refresh push notification token |
| POST | /warehouses | admin | create warehouse + locations |
| POST | /items | admin | create item + units |
| POST | /items/import/csv | admin | bulk import items from CSV |
| POST | /import/from-database | admin | bulk import items via direct external DB query |
| POST | /audit-tasks | admin | assign audit task |
| GET | /audit-tasks | admin | list every task in the company |
| GET | /audit-tasks/mine | employee | my assigned tasks |
| POST | /audit-records | employee | log one scan (online) |
| POST | /audit-records/sync | employee | bulk upload queued offline scans |
| POST | /audit-records/pending-items | employee | report unregistered barcode |
| GET | /pending-items | admin | review queue |
| PATCH | /pending-items/:id/approve | admin | register as real item |
| POST | /tasks/:taskId/generate | admin/reviewer | generate final report |
| GET | /reports/:reportId/csv | admin/reviewer | export CSV |
