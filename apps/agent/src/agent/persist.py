"""Persist agent artifacts via Prisma-owned API callback (Prisma owns schema; agent writes through API)."""
from __future__ import annotations
import os
import httpx

API = os.environ.get('AGENT_API_CALLBACK', 'http://api:3000/api/v1/internal')
TOKEN = os.environ.get('AGENT_SERVICE_TOKEN', 'change-me-internal-token')

async def persist_results(state: dict) -> None:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{API}/runs/{state['run_id']}/artifacts",
                         headers={'Authorization': f'Bearer {TOKEN}'}, json={
            'plan': state.get('plan'), 'sources': state.get('sources', [])[:60],
            'evidences': state.get('evidences', [])[:200], 'claims': state.get('claims', [])[:200],
            'report': state.get('report'), 'coverage': state.get('coverage', {})})
        r.raise_for_status()
