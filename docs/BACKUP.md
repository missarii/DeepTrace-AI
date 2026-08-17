# Backup & restore
`docker compose exec postgres pg_dump -U deeptrace deeptrace > backup.sql`
Restore: `cat backup.sql | docker compose exec -T postgres psql -U deeptrace deeptrace`
Include Redis? Not required — jobs rebuild from DB run rows (queued → re-enqueue).
