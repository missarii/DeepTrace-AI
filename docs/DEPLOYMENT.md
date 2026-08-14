# Deployment
- `docker compose up --build` (postgres pgvector, redis, agent, api, worker, web).
- Migrations: `make migrate` (`prisma migrate deploy`); back up with `pg_dump` — see BACKUP.md.
- Env: copy `.env.example`; set `JWT_*_SECRET`, `AGENT_SERVICE_TOKEN`, provider keys.
- Health: `make health` hits `/api/v1/health`, `/ready`, agent `/health`.
