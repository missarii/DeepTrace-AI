"""DeepTrace agent service: FastAPI + LangGraph autonomous research workflow."""
from __future__ import annotations
import json, time, uuid
from typing import AsyncIterator
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from agent.graph import run_research_stream
from agent.config import settings

app = FastAPI(title='DeepTrace Agent', version='1.0.0')

class RunRequest(BaseModel):
    question: str = Field(min_length=10, max_length=2000)
    depth: str = 'standard'
    objectives: list[str] = []
    config: dict = {}
    ownerId: str = ''
    projectId: str = ''

@app.get('/health')
async def health():
    return {'status': 'ok', 'provider': settings.chat_provider, 'search': settings.search_provider}

@app.get('/ready')
async def ready():
    return {'status': 'ready', 'chat': settings.chat_provider, 'search': settings.search_provider, 'js_render': settings.allow_js_render}

@app.post('/v1/runs/{run_id}')
async def run_research(run_id: str, req: RunRequest, authorization: str = Header(default='')):
    if settings.internal_token and authorization != f'Bearer {settings.internal_token}':
        raise HTTPException(status_code=401, detail='bad internal token')
    async def gen() -> AsyncIterator[str]:
        async for evt in run_research_stream(run_id, req.question, req.depth, req.objectives, req.config):
            yield f"data: {json.dumps(evt)}\n\n"
    return StreamingResponse(gen(), media_type='text/event-stream')
