"""Search provider abstraction: tavily | brave | mock. Records provider/query/rank provenance."""
from __future__ import annotations
import httpx
from ..config import settings
from ..schemas import SearchResult

async def search(query: str, max_results: int = 8) -> list[SearchResult]:
    provider = settings.search_provider
    if provider == 'tavily' and settings.tavily_api_key:
        return await tavily_search(query, max_results)
    if provider == 'brave' and settings.brave_api_key:
        return await brave_search(query, max_results)
    return mock_search(query, max_results)

def mock_search(query: str, n: int) -> list[SearchResult]:
    # Deterministic, offline — clearly fake URLs under example.com so tests never hit network.
    base = abs(hash(query)) % 1000
    return [SearchResult(provider='mock', query=query, rank=i, url=f'https://example.com/mock/{base}/{i}',
                         title=f'Mock result {i} for {query[:40]}', snippet=f'Illustrative snippet {i} mentioning {query[:60]}.') for i in range(n)]

async def tavily_search(query: str, n: int) -> list[SearchResult]:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post('https://api.tavily.com/search', headers={'Authorization': f'Bearer {settings.tavily_api_key}'},
                         json={'query': query, 'max_results': n, 'search_depth': 'advanced'})
        r.raise_for_status()
        out = []
        for i, item in enumerate(r.json().get('results', [])[:n]):
            out.append(SearchResult(provider='tavily', query=query, rank=i, url=item.get('url', ''), title=item.get('title', ''), snippet=item.get('content', '')[:500]))
        return out

async def brave_search(query: str, n: int) -> list[SearchResult]:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get('https://api.search.brave.com/res/v1/web/search', headers={'X-Subscription-Token': settings.brave_api_key}, params={'q': query, 'count': n})
        r.raise_for_status()
        out = []
        for i, item in enumerate(r.json().get('web', {}).get('results', [])[:n]):
            out.append(SearchResult(provider='brave', query=query, rank=i, url=item.get('url', ''), title=item.get('title', ''), snippet=item.get('description', '')[:500]))
        return out
