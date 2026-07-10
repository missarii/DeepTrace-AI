"""Citation validation: every citation must reference a stored source + passage."""
from __future__ import annotations

def validate_citations(citations: list[dict], sources: list[dict], evidences: list[dict]) -> dict:
    source_ids = {s['id'] for s in sources}
    ev_by_id = {e['id']: e for e in evidences}
    valid, flagged = [], []
    for c in citations:
        problems = []
        if c.get('source_id') not in source_ids:
            problems.append('unknown source_id')
        ev = ev_by_id.get(c.get('evidence_id', ''))
        if not ev:
            problems.append('missing evidence passage')
        elif not ev.get('passage'):
            problems.append('empty passage')
        if not c.get('url'):
            problems.append('missing url')
        if isinstance(c.get('source_id'), str) and c['source_id'].startswith('fake'):
            problems.append('fabricated identifier')
        (valid if not problems else flagged).append({**c, 'problems': problems})
    return {'valid': valid, 'flagged': flagged, 'citation_precision': len(valid) / max(len(citations), 1)}
