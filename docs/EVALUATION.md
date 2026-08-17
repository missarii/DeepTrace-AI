# Evaluation
Dataset `eval/dataset-v1.json` (7 cases: factual, multi-hop, comparative, time-sensitive, conflicting, insufficient, injection).
Run `make evaluate` → `eval/results/{results.json,results.csv,SUMMARY.md}`.
Metrics: P@k, R@k, MRR, nDCG@5, citation precision, unsupported-claim rate, completion rate, p50/p95 seconds, searches/run, est $/run.
Baseline: single-pass mock retrieval. Full-graph comparison uses identical questions; live providers when configured.
Limit: auto metrics are proxies for conflicting/insufficient cases — human review required.
