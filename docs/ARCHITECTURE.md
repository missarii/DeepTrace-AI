# Architecture

```
browser ──REST/SSE──▶ NestJS API ──BullMQ/Redis──▶ worker ──SSE──▶ FastAPI agent (LangGraph)
   │                      │ Prisma                            │──▶ Tavily/Brave, OpenAI/Anthropic/Ollama
   │                      ▼ Postgres (pgvector)               └──▶ SSRF-safe fetch → Trafilatura/BS4
   └── React 19 + Query + Zustand + Flow + Recharts           artifacts persisted via API callback
```

## Decisions (ADRs in docs/ADR)
- **Prisma owns the schema.** The Python service never migrates product tables; it POSTs artifacts to an internal API callback (`/api/v1/internal/runs/:id/artifacts`, bearer token). Avoids dual-ORM drift.
- **BullMQ + persisted AgentEvent log.** Redis pub/sub is transport only; the DB event table is the durable record → SSE replay via `?after=seq`, restart recovery, cancel-safe.
- **Bounded agent loops.** Depth presets cap iterations/searches; per-run `maxSeconds`, token and cost caps enforced server-side.
- **Citation checks ≠ truth.** `validate_citations` confirms stored source + passage + URL shape; reports state this limit explicitly.
- **Env-first secrets.** Self-host release keeps provider keys in env; no secrets to the browser, none in logs.

## Data flow
1. `POST /research` → run row (queued) + `research.started` event → BullMQ job (idempotency key supported).
2. Worker streams agent SSE → mirrors events to DB; agent persists plan/sources/chunks/evidence/claims/report via callback.
3. Browser SSE reconnects with last seq → `GET /events?after=` backfills.
4. Exports rebuild Markdown/HTML from stored report + citations (never from LLM memory).

## Security
- SSRF: scheme allowlist, host/DNS blocklists (private/loopback/link-local/metadata), redirect revalidation, timeouts, 2MB + content-type limits, per-domain concurrency.
- Injection: `<untrusted>` wrapping, instruction/data separation, allowlisted tools, injection eval case.
- Auth: Argon2id, JWT access (15m) + rotating SHA-256-hashed refresh tokens (7d), tenant checks on every query.
