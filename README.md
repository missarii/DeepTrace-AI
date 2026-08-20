# DeepTrace AI - Autonomous Research Engine

> **Ask a hard question. Get evidence, not vibes.** An open-source platform that plans, searches, extracts, verifies, and synthesizes complex topics into structured, citation-backed research reports.

[![CI](https://github.com/your-org/deeptrace-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/deeptrace-ai/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)
[![Stack](https://img.shields.io/badge/stack-React%2019%20NestJS%20FastAPI%20LangGraph-purple)]()
[![Demo](https://img.shields.io/badge/demo-zero%20keys%20needed-green)]()

---

## Contents

1. Purpose 2. Features 3. How the agent works 4. Technologies 5. Architecture
6. Repo structure 7. Getting started 8. Configuration 9. API overview 10. Live events
11. Data model 12. Security 13. Evaluation 14. Testing 15. Operations 16. Roadmap 17. License

---

## 1. Purpose

Complex questions - *"compare deep-learning aerial threat detection across vision, radar, and sensor fusion: approaches, datasets, metrics, limits, gaps"* - cannot be answered by one search or a chatbot paragraph. They need planning, multi-query retrieval, source inspection, contradiction handling, and honest uncertainty.

DeepTrace AI exists to do exactly that:

- **Decompose** a question into subquestions, objectives, queries, completion criteria.
- **Retrieve** from real search providers with full provenance (provider, query, rank, URL, timestamps).
- **Extract** pages safely, normalize, deduplicate, chunk with stable offsets, rank with keyword + vector fusion.
- **Verify** claims against stored passages (supports | contradicts | mixed | insufficient | unverified). Never invents DOIs, quotes, URLs, or dates.
- **Synthesize** a structured report where factual claims link to real evidence.
- **Persist everything** so research is inspectable, reproducible, exportable.
- **Admit gaps** instead of hallucinating.

**Who it is for:** researchers, analysts, engineers, students, and builders who want auditable answers.

## 2. Features

### Research workflow
- New research form: question, depth (quick/standard/comprehensive), objectives, dates, source types, language, max seconds, search budget, include/exclude domains. Validated client + server.
- Live workspace: plan, subtasks, queries, sources, extraction/verification progress, decisions + retries, elapsed time + usage, provisional findings, cancel/retry controls.
- Bounded autonomy: depth presets cap iterations/searches/sources; server enforces seconds, tokens, concurrency, content size, est. cost.
- Gap-closing loop: coverage scoring each round; targeted follow-ups only if gaps remain AND budget allows.
- Demo mode (zero keys): deterministic labeled DEMO data; never disguised as real research.

### Reports and evidence
- Report viewer: summary, methodology, findings, themes, comparisons, contradictions, gaps, limitations, bibliography, inline citations, claim-to-evidence panel, Markdown + printable export, copy-citation.
- Source explorer: title, domain, canonical URL, dates, type, passages, relevance (explained), linked claims, include/exclude reason.
- Evidence explorer: supporting vs contradicting passages, independence, sufficiency, status, uncertainty reasons.
- Knowledge graph: ReactFlow entities/claims/sources/relations with search, filter, zoom/pan; inferred edges marked provisional.
- Uploads: PDF/TXT/MD/DOCX validated (type, 20 MB), page refs preserved, kept distinct from web evidence.

### Platform
- Auth: register/login/logout, JWT access 15m + rotating refresh 7d (hashed), Argon2id, per-user deletion.
- Dashboard: search, status filter, pagination, real persisted stats, skeletons/empty/error states.
- Settings: provider + budget defaults, usage/cost estimates (labeled), retention controls. Secrets never reach the browser.


## 3. How the agent works

Pipeline: `question -> plan -> subquestions -> searches -> extraction -> dedup/rank -> claims -> verify -> coverage -> (iterate?) -> synthesize -> validate citations -> report`.

### 3.1 The 13 LangGraph nodes (`apps/agent/src/agent/graph.py`)

| # | Node | What it does |
|---|------|--------------|
| 1 | `validate_request` | Rejects empty/short questions; records errors in typed state. |
| 2 | `understand_objective` | Normalizes objectives, language, scope for downstream nodes. |
| 3 | `create_research_plan` | LLM drafts PLAN JSON; Pydantic validates; 3 bounded retries then structured fallback (fallback shapes structure only, never evidence). Emits `plan.created`. |
| 4 | `decompose_questions` | Expands subquestions into dataset/eval/limitation query variants (max 20). |
| 5 | `select_search_strategy` | Picks per-query strategy within budget and domain allow/deny lists. |
| 6 | `execute_searches` | Concurrent provider calls (semaphore 4), rate-limit aware; records provider/query/rank/URL/latency/error; never claims a failed call succeeded. |
| 7 | `fetch_and_extract` | SSRF-safe fetch -> Trafilatura/BS4 text + metadata -> injection scan -> SHA-256 hash -> URL + content dedup. |
| 8 | `rank` | Reciprocal Rank Fusion over keyword + positional rankings -> relevance score. |
| 9 | `extract_claims` | Chunks (1200 chars/200 overlap, sentence-snapped, offsets kept) -> candidate claims, each bound to an evidence ID. |
| 10 | `verify_claims` | Word-overlap + hedge detection (`not/however` -> mixed); sets claim + evidence status. |
| 11 | `assess_coverage` | Counts sources, supported/total claims; emits gaps (few claims, low diversity, unsupported items). |
| 12 | Loop guard | Repeats 6-11 while gaps AND iteration < max AND searches < budget AND time remains. Else finishes with limitations. |
| 13 | `synthesize` + `validate_citations` | Report from stored artifacts only; empty-claim path returns honest insufficient-evidence report; citation check enforces stored source + passage + URL. |

### 3.2 State, budgets, and safety

- Typed `ResearchState` (run/question/depth/objectives/config/plan/queries/searches_done/iteration/sources/evidences/claims/coverage/report/errors/started_at).
- Depth presets: quick (1 iter, 6 searches, 12 sources), standard (2/16/30), comprehensive (3/24/60); plus max seconds/tokens/content/cost caps from env.
- Untrusted content wrapped in `<untrusted>` blocks; instruction/data separation; injection regex scan flags poisoned pages; allowlisted tools only.
- SSRF: scheme allowlist, host/DNS blocklists (localhost, private, loopback, link-local, metadata), redirect revalidation, timeouts, 2 MB + content-type limits.
- Persistence: agent POSTs artifacts to `POST /api/v1/internal/runs/:id/artifacts` (bearer token); Prisma owns the schema — no dual-ORM drift.

### 3.3 Model and search providers

## 4. Technologies

| Layer | Choices |
|-------|---------|
| Frontend | React 19, TypeScript strict, Vite, Tailwind CSS, Radix UI, React Router, TanStack Query, Zustand, React Hook Form + Zod, React Flow, Recharts, Vitest + Testing Library, Playwright |
| Product API | Node.js + TypeScript, NestJS, REST `/api/v1`, OpenAPI/Swagger, SSE, Prisma ORM, PostgreSQL + pgvector, Redis, BullMQ, JWT + refresh rotation, Argon2id, Helmet, Throttler |
| Agent | Python 3.12, FastAPI, LangGraph, Pydantic, HTTPX, Trafilatura + BeautifulSoup, SQLAlchemy-free callback persistence, Pytest + asyncio, Ruff + mypy |
| Retrieval | Tavily/Brave abstraction, HTTPX fetch, Trafilatura/BS4 extract, PG full-text + pgvector, local/OpenAI embeddings, RRF fusion, hash + canonical-URL dedup |
| AI | OpenAI-compatible, Anthropic, Ollama, Mock adapters; separate chat vs embedding models |
| Infra | Docker + Compose (postgres pgvector, redis, api, worker, agent, web), GitHub Actions, JSON logs, OpenTelemetry hooks, health/readiness probes, ESLint/Prettier |

## 5. Architecture

```
browser --REST/SSE--> NestJS API --BullMQ/Redis--> worker --SSE--> FastAPI agent (LangGraph)
   |                       | Prisma                              |--> Tavily/Brave, OpenAI/Anthropic/Ollama
   |                       v Postgres (pgvector)                 +--> SSRF-safe fetch -> Trafilatura/BS4
   +-- React 19 + Query + Zustand + Flow + Recharts              artifacts persisted via API callback
```

Key decisions (see `docs/ADR/`): Prisma owns the schema; AgentEvent(seq) table is the durable log (Redis is transport); autonomy is bounded; citation checks prove provenance not truth; secrets are env-first server-side.

## 6. Repository structure

```
apps/web/        React app (pages, components, lib/api, stores, hooks, tests)
apps/api/        NestJS (auth, projects, research, settings, worker, prisma schema)
apps/agent/      FastAPI + LangGraph (graph, providers, retrieval, security, tests)
packages/shared/ Event + report + enum contracts shared across stacks
eval/            dataset-v1.json, runner.py, results/ (JSON/CSV/MD)
docker/          api.Dockerfile, agent.Dockerfile, web.Dockerfile, nginx.conf

## 7. Getting started

```bash
cp .env.example .env
docker compose up --build
# web   http://localhost:5173
# api   http://localhost:3000/api/v1  (swagger: /api/docs)
# agent http://localhost:8000         (docs: /docs, health: /health)
make migrate && make seed && make health
```

Demo (no keys): register as `demo@deeptrace.ai`, New research, check demo, watch live, open the report. Or visit `/report/demo` directly.

| Command | Purpose |
|---------|---------|
| `make install` | install web + api + shared + agent deps |
| `make migrate` | `prisma migrate deploy` from empty DB |
| `make seed` | demo user + labeled demo project |
| `make dev` | compose stack |
| `make test` | web + api + agent suites |
| `make lint` | eslint + prettier + ruff (+mypy) |
| `make build` | production builds |
| `make evaluate` | eval dataset -> `eval/results/` |
| `make health` | API + agent health checks |

## 8. Configuration

Copy `.env.example`. Live research needs a search key + a chat key:

```bash
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=tvly-...
CHAT_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
```

Alternatives: `SEARCH_PROVIDER=brave` + `BRAVE_API_KEY`; `CHAT_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`; `CHAT_PROVIDER=ollama` + `OLLAMA_BASE_URL`/`OLLAMA_CHAT_MODEL` (optional, disabled by default). Budgets: `MAX_ITERATIONS`, `MAX_SEARCH_CALLS`, `MAX_CONCURRENT_FETCH`, `MAX_CONTENT_CHARS`, `MAX_MODEL_TOKENS`, `MAX_RUN_SECONDS`, `MAX_EST_COST_USD`, `ALLOW_JS_RENDER`, `MAX_UPLOAD_MB`. Never commit real keys.


## 10. Live progress and events

`GET /research/:id/stream` streams versioned events: research.started, plan.created, task.started, search.started/completed, source.discovered/extracted, evidence.created, claim.verified, coverage.updated, synthesis.started, report.completed/failed/cancelled. Persisted in AgentEvent(runId, seq); reconnect with `?after=seq` replays gaps; 15s heartbeats; abandoned streams cleaned up.

## 11. Data model

PostgreSQL via Prisma: User, RefreshToken, UserSettings, Project, ResearchRun, ResearchPlan, ResearchTask, SearchExecution, Source (+Snapshot, +Chunk vector(384)), Evidence, Claim, ClaimEvidence, ResearchReport (+Section, +Citation), AgentEvent, ModelUsage, KnowledgeEntity/Relationship, UploadedDocument, AuditEvent. UUIDs, timestamps, ownership FKs, unique(runId, canonicalUrl), indexes on owner/created/relevance/seq, cascade deletes, tenant check on every query.

## 12. Security

SSRF: HTTP/S only, localhost/private/link-local/metadata blocked, redirect + DNS revalidation, timeouts, size/type limits, per-domain concurrency, isolated JS rendering (off by default). Injection: untrusted data wrapped, never executed; allowlisted tools; secrets never in prompts/logs. Web: Zod/class-validator input, JWT guards + ownership, rate limits, explicit CORS, secure cookies + CSRF-aware, Helmet, sanitized exports, no stack traces in prod.

## 9. API overview

## 13. Evaluation

`eval/dataset-v1.json` (7 cases: factual, multi-hop, comparative, time-sensitive, conflicting, insufficient, injection) + `eval/runner.py` -> `eval/results/{results.json,results.csv,SUMMARY.md}`. Metrics: P@k, R@k, MRR, nDCG@5, citation precision, unsupported-claim rate, completion rate, p50/p95 seconds, searches/run, est $/run. Baseline: single-pass mock retrieval on identical questions. Conflicting/insufficient/injection cases require human review. See `docs/EVALUATION.md`.

## 14. Testing

Backend (Jest): auth, ownership, validation, job creation, idempotency, cancel/retry, replay, persistence, citation export, deletion. Agent (Pytest, offline mocks): plan valid/invalid, search ok/fail, canonicalize/dedup, ranking, extraction, contradictions, insufficient path, budgets, injection, citation integrity, timeouts. Frontend (Vitest): validation, creation, progress, reconnect merge, rendering, cancel/errors. E2E (Playwright): register -> demo run -> events -> report -> citations -> export + auth boundaries. Default suite needs no paid keys.

## 15. Observability and operations

Structured JSON logs with request/run IDs; `/health` + `/ready` (DB/Redis/agent); provider latency/error, queue depth/duration, step duration/retries, token/cost tracking (honest estimates); OpenTelemetry hooks; `docs/DEPLOYMENT.md`, `TROUBLESHOOTING.md`, `BACKUP.md` (pg_dump/restore; jobs rebuild from DB).

## 16. Roadmap and limitations

Done: all 9 phases incl. demo, exports, graph, eval, CI. Honest limits: citation checks prove provenance not truth; costs estimated; PDF is printable HTML; local models vary; old reports never pose as current sources. Next: reranker toggle, upload malware-scan hook, multi-language retrieval, scheduled re-validation of time-sensitive claims.

## 17. Contributing

PRs welcome: keep modules small, boundaries explicit (Prisma owns schema), add/extend tests for agent + security paths, run `make lint && make test && make evaluate`, update docs + `.env.example` for new config. No secrets in commits.

## 18. License

Apache-2.0 — see [LICENSE](./LICENSE).


Auth: `POST /auth/register|login|refresh|logout`, `GET /auth/me`, `DELETE /auth/me`. Projects: `GET|POST /projects`, `GET|PATCH|DELETE /projects/:id`. Research: `POST|GET /research`, `GET /research/:id`, `POST /research/:id/cancel|retry`, `GET /research/:id/{events,plan,sources,evidence,claims,report,graph}`, `GET /research/:id/stream` (SSE), `GET /research/:id/export/{markdown,pdf}`. Settings: `GET|PATCH /settings`, `GET /usage`. Internal: `POST /internal/runs/:id/artifacts` (agent bearer). Versioned envelopes, pagination, request IDs, Swagger at `/api/docs`, typed client in `apps/web/src/lib/api.ts`.

docs/            ARCHITECTURE, ADR, DEPLOYMENT, EVALUATION, TROUBLESHOOTING, BACKUP
.github/workflows/ci.yml   docker-compose.yml   Makefile   .env.example
```


- Chat: OpenAI-compatible, Anthropic, Ollama, Mock — per-provider handling for tools, structured output, limits, streaming, timeouts, retries. Chat model and embedding model configured separately; no large downloads.
- Search: Tavily, Brave, Mock via one interface; mock is deterministic offline (example.com URLs) for tests/demo.

- **Synthesize** a structured report (summary, methodology, findings, comparisons, contradictions, gaps, limitations, bibliography) where factual claims link to real evidence.
- **Persist everything** - plan, searches, sources, snapshots, chunks, evidence, claims, report, citations, events, usage, graph - so research is inspectable, reproducible, exportable.
- **Admit gaps**: says insufficient-evidence explicitly instead of hallucinating.

**Who it is for:** researchers, analysts, engineers, students, and builders who want auditable answers - and a portfolio-grade showcase of agentic systems done right.
