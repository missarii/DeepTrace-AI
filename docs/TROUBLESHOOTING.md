# Troubleshooting
- API 401 → register/login again; access token is 15m, refresh rotates.
- SSE stuck on RECONNECTING → check Redis + worker logs; events replay from DB automatically.
- Agent 401 → `AGENT_SERVICE_TOKEN` must match `AGENT_INTERNAL_TOKEN`.
- No search results → `SEARCH_PROVIDER=mock` returns offline samples; set `tavily`/`brave` + key for live.
- Prisma `vector(384)` → needs pgvector image; `docker compose up postgres` first.
- PDF export downloads HTML → print-to-PDF from browser; weasyprint wiring is a follow-up.
