"""SSRF-safe fetching: blocks private/localhost/metadata, validates redirects + DNS, enforces limits."""
from __future__ import annotations
import ipaddress, socket
from urllib.parse import urlparse, urljoin
import httpx

BLOCKED_HOSTS = {'localhost', 'metadata.google.internal'}
METADATA_IPS = {'169.254.169.254', 'fd00:ec2::254'}
MAX_BYTES = 2_000_000
ALLOWED_SCHEMES = {'http', 'https'}

def canonicalize(url: str) -> str:
    p = urlparse(url.strip())
    scheme = 'https' if p.scheme in ('http', 'https') else p.scheme
    host = (p.hostname or '').lower().rstrip('.')
    path = p.path.rstrip('/') or '/'
    q = f'?{p.query}' if p.query else ''
    return f'{scheme}://{host}{path}{q}'

def host_blocked(host: str) -> bool:
    h = host.lower().rstrip('.')
    if h in BLOCKED_HOSTS or h.endswith('.internal') or h.endswith('.local'):
        return True
    try:
        # literal IP?
        ip = ipaddress.ip_address(h)
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or str(ip) in METADATA_IPS
    except ValueError:
        pass
    return False

def resolve_blocked(host: str) -> bool:
    try:
        for fam, _, _, _, sockaddr in socket.getaddrinfo(host, 443):
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or str(ip) in METADATA_IPS:
                return True
    except Exception:
        return True  # fail closed on DNS failure
    return False

async def safe_fetch(url: str, timeout: float = 15.0) -> tuple[str, str, dict]:
    """Returns (final_url, html, meta). Raises on blocked/oversize/bad content."""
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError(f'blocked scheme: {parsed.scheme}')
    host = parsed.hostname or ''
    if host_blocked(host) or resolve_blocked(host):
        raise ValueError(f'blocked host: {host}')
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False, max_redirects=0) as c:
        current = url
        for _ in range(5):
            p = urlparse(current)
            h = p.hostname or ''
            if p.scheme not in ALLOWED_SCHEMES or host_blocked(h) or resolve_blocked(h):
                raise ValueError(f'blocked redirect target: {current}')
            r = await c.get(current)
            if r.status_code in (301, 302, 303, 307, 308):
                loc = r.headers.get('location', '')
                current = urljoin(current, loc)
                continue
            r.raise_for_status()
            ctype = r.headers.get('content-type', '')
            if 'html' not in ctype and 'text' not in ctype:
                raise ValueError(f'unsupported content-type: {ctype}')
            body = r.content
            if len(body) > MAX_BYTES:
                raise ValueError('response too large')
            return current, r.text, {'content_type': ctype, 'status': r.status_code}
        raise ValueError('too many redirects')
