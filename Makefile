.PHONY: install migrate seed dev test lint build evaluate health

install:
	cd apps/web && npm install
	cd ../api && npm install
	cd ../../packages/shared && npm install
	python3 -m pip install -r apps/agent/requirements.txt

migrate:
	cd apps/api && npx prisma migrate deploy

seed:
	cd apps/api && npx ts-node prisma/seed.ts

dev:
	docker compose up --build

test:
	cd apps/web && npm test -- --run
	cd ../api && npm test
	cd ../../apps/agent && python3 -m pytest -q

lint:
	cd apps/web && npm run lint
	cd ../api && npm run lint
	cd ../../apps/agent && ruff check . && mypy src || true

build:
	cd apps/web && npm run build
	cd ../api && npm run build

evaluate:
	python3 eval/runner.py --dataset eval/dataset-v1.json --out eval/results/

health:
	curl -sf http://localhost:3000/api/v1/health && curl -sf http://localhost:8000/health && echo OK
