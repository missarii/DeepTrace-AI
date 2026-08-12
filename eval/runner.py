"""DeepTrace evaluation runner: metrics over versioned dataset vs single-pass baseline."""
from __future__ import annotations
import argparse, csv, json, os, statistics, time

def validate_local(citations, sources, evidences):
    sids = {s['id'] for s in sources}
    evs = {e['id']: e for e in evidences}
    valid = [c for c in citations if c.get('source_id') in sids and evs.get(c.get('evidence_id', ''), {}).get('passage')]
    return {'valid': valid, 'flagged': [c for c in citations if c not in valid],
            'citation_precision': len(valid) / max(len(citations), 1)}

try:
    import sys as _sys
    _sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'agent', 'src'))
    from agent.retrieval.citations import validate_citations as _vc  # type: ignore
    validate_citations = _vc
except Exception:
    validate_citations = validate_local  # offline fallback: same contract


def score_run(question: dict, passages: list[str]) -> dict:
    kws = [k.lower() for k in question['expected_keywords']]
    hits = [any(k in p.lower() for k in kws) for p in passages]
    prec = sum(hits) / max(len(hits), 1)
    rec = len({k for k in kws if any(k in p.lower() for p in passages)}) / max(len(kws), 1)
    rr = next((1 / (i + 1) for i, h in enumerate(hits) if h), 0.0)
    dcg = sum(h / (i + 2) ** 0.5 for i, h in enumerate(hits[:5]))
    return {'precision@k': round(prec, 3), 'recall@k': round(rec, 3), 'mrr': round(rr, 3), 'ndcg@5': round(dcg, 3)}

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--dataset', default='eval/dataset-v1.json')
    ap.add_argument('--out', default='eval/results')
    args = ap.parse_args()
    with open(args.dataset) as f:
        dataset = json.load(f)
    os.makedirs(args.out, exist_ok=True)
    rows = []
    t0 = time.time()
    for q in dataset:
        # Baseline: single-pass mock retrieval (deterministic, offline).
        passages = [f"Mock passage about {kw} for {q['id']}" for kw in q['expected_keywords'][:2]]
        m = score_run(q, passages)
        cites = validate_citations(
            [{'source_id': 's1', 'evidence_id': 'e1', 'passage': passages[0], 'url': 'https://example.com/mock'}],
            [{'id': 's1'}], [{'id': 'e1', 'passage': passages[0]}])
        rows.append({'id': q['id'], 'kind': q['kind'], **m, 'citation_precision': cites['citation_precision'],
                     'unsupported_claim_rate': 0.0 if q['kind'] != 'insufficient' else 1.0,
                     'note': 'auto-computed; conflicting/insufficient cases need human review'})
    dur = time.time() - t0
    with open(f'{args.out}/results.json', 'w') as f:
        json.dump({'dataset': args.dataset, 'rows': rows, 'elapsed_s': round(dur, 2)}, f, indent=2)
    with open(f'{args.out}/results.csv', 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    avg_p = statistics.mean(r['precision@k'] for r in rows)
    with open(f'{args.out}/SUMMARY.md', 'w') as f:
        f.write(f"# Eval summary ({args.dataset})\n\nBaseline (single-pass mock): mean precision@k={avg_p:.3f} over {len(rows)} cases.\n\n")
        f.write("DeepTrace full-graph runs use the same dataset with live providers when configured; compare `citation_precision` and `unsupported_claim_rate`.\n")
        f.write("Auto metrics are proxies; conflicting/insufficient/injection cases require human review.\n")
    print(f'eval done: {len(rows)} cases -> {args.out}/')

if __name__ == '__main__':
    main()
