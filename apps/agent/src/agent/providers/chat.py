"""Model provider adapters: openai-compatible, anthropic, ollama, mock. Never called from browser."""
from __future__ import annotations
import httpx
from .config import settings

class ChatResult(dict):
    pass

async def chat(messages: list[dict], max_tokens: int = 2000, temperature: float = 0.2) -> dict:
    provider = settings.chat_provider
    if provider == 'mock' or not provider:
        return {'text': mock_reply(messages), 'prompt_tokens': 50, 'completion_tokens': 80, 'model': 'mock-1'}
    if provider == 'openai':
        return await openai_chat(messages, max_tokens, temperature)
    if provider == 'anthropic':
        return await anthropic_chat(messages, max_tokens, temperature)
    if provider == 'ollama':
        return await ollama_chat(messages, max_tokens, temperature)
    return {'text': mock_reply(messages), 'prompt_tokens': 50, 'completion_tokens': 80, 'model': 'mock-1'}

def mock_reply(messages: list[dict]) -> str:
    last = messages[-1]['content'] if messages else ''
    # Deterministic, structured-output-friendly mock used by tests + demo-free runs.
    if 'PLAN' in last or 'plan' in last.lower():
        return '{"primary_question": "q", "subquestions": ["a", "b"], "objectives": [], "source_types": ["papers"], "queries": ["q1", "q2"], "completion_criteria": ["done"]}'
    return 'Mock finding: evidence suggests the topic has multiple approaches; verification requires live sources.'

async def openai_chat(messages: list[dict], max_tokens: int, temperature: float) -> dict:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post('https://api.openai.com/v1/chat/completions', headers={'Authorization': f'Bearer {settings.openai_api_key}'},
                         json={'model': settings.openai_chat_model, 'messages': messages, 'max_tokens': max_tokens, 'temperature': temperature})
        r.raise_for_status()
        j = r.json()
        return {'text': j['choices'][0]['message']['content'], 'prompt_tokens': j.get('usage', {}).get('prompt_tokens', 0),
                'completion_tokens': j.get('usage', {}).get('completion_tokens', 0), 'model': settings.openai_chat_model}

async def anthropic_chat(messages: list[dict], max_tokens: int, temperature: float) -> dict:
    sys = '\n'.join(m['content'] for m in messages if m['role'] == 'system')
    conv = [{'role': 'user' if m['role'] == 'system' else m['role'], 'content': m['content']} for m in messages if m['role'] != 'system']
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post('https://api.anthropic.com/v1/messages', headers={'x-api-key': settings.anthropic_api_key, 'anthropic-version': '2023-06-01'},
                         json={'model': settings.anthropic_chat_model, 'max_tokens': max_tokens, 'temperature': temperature, 'system': sys, 'messages': conv})
        r.raise_for_status()
        j = r.json()
        return {'text': ''.join(b.get('text', '') for b in j.get('content', [])), 'prompt_tokens': j.get('usage', {}).get('input_tokens', 0),
                'completion_tokens': j.get('usage', {}).get('output_tokens', 0), 'model': settings.anthropic_chat_model}

async def ollama_chat(messages: list[dict], max_tokens: int, temperature: float) -> dict:
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(f'{settings.ollama_base_url}/api/chat', json={'model': settings.ollama_chat_model, 'messages': messages, 'stream': False, 'options': {'num_predict': max_tokens, 'temperature': temperature}})
        r.raise_for_status()
        j = r.json()
        return {'text': j.get('message', {}).get('content', ''), 'prompt_tokens': 0, 'completion_tokens': 0, 'model': settings.ollama_chat_model, 'estimated': True}
