"""Extraction + normalization: Trafilatura/BS4 (both optional), hashing, chunking, dedup, RRF."""
from __future__ import annotations
import hashlib
from urllib.parse import urlparse

try:
    from trafilatura import extract as trafi_extract  # type: ignore
except Exception:
    trafi_extract = None  # type: ignore

try:
    from bs4 import BeautifulSoup  # type: ignore
except Exception:
    BeautifulSoup = None  # type: ignore

def extract_text(html: str, url: str = '') -> tuple[str, dict]:
    meta: dict = {'url': url}
    text = ''
    if trafi_extract:
        try:
            text = trafi_extract(html, include_comments=False, include_tables=True) or ''
        except Exception:
            text = ''
    if (not text or len(text) < 200) and BeautifulSoup:
        soup = BeautifulSoup(html, 'lxml')
        for tag in soup(['script', 'style', 'nav', 'footer', 'aside']):
            tag.decompose()
        title = soup.title.string.strip() if soup.title and soup.title.string else ''
        meta['title'] = title
        text = soup.get_text(separator='\n')
        text = '\n'.join(line.strip() for line in text.splitlines() if line.strip())
    if not text:
        import re
        text = re.sub(r'<[^>]+>', ' ', html)
        text = ' '.join(text.split())
    return text.strip(), meta


def extract_text(html: str, url: str = '') -> tuple[str, dict]:
    meta: dict = {'url': url}
    text = ''
    if trafi_extract:
        try:
            text = trafi_extract(html, include_comments=False, include_tables=True) or ''
        except Exception:
            text = ''
    if not text or len(text) < 200:
        soup = BeautifulSoup(html, 'lxml')
        for tag in soup(['script', 'style', 'nav', 'footer', 'aside']):
            tag.decompose()
        title = soup.title.string.strip() if soup.title and soup.title.string else ''
        meta['title'] = title
        text = soup.get_text(separator='\n')
        text = '\n'.join(line.strip() for line in text.splitlines() if line.strip())
    return text.strip(), meta

def content_hash(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def chunk_text(text: str, size: int = 1200, overlap: int = 200) -> list[dict]:
    chunks = []
    i, ordinal = 0, 0
    while i < len(text):
        end = min(len(text), i + size)
        # snap to sentence boundary
        snap = text.rfind('. ', i + size - 200, end)
        if snap > i + 400:
            end = snap + 1
        chunks.append({'ordinal': ordinal, 'text': text[i:end], 'start': i, 'end': end})
        ordinal += 1
        i = end - overlap if end < len(text) else end
        if i <= 0:
            break
    return chunks

def deduplicate(items: list[dict], key: str = 'hash') -> list[dict]:
    seen: set[str] = set()
    out = []
    for it in items:
        h = it.get(key, '')
        if h in seen:
            continue
        seen.add(h)
        out.append(it)
    return out

def rrf_fuse(rankings: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    return sorted(scores.items(), key=lambda x: -x[1])

def domain_of(url: str) -> str:
    try:
        return (urlparse(url).hostname or '').lower()
    except Exception:
        return ''
