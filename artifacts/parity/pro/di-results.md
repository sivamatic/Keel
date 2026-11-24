# Keel-Pro on the Decision Index: measured results

All numbers on this page come from real runs on this machine (RTX 5090 32 GB, Windows, torch 2.11 cu128,
transformers 5.20) using the DI kit @ `25c6ec7` with its own prompt and scorers (`scripts/di/hybrid_engine.py`,
`scripts/di/score_sample.py`). They are **sample estimates** of the public 0.3 index, with a group-bootstrap 95% CI.

- `dev` = iteration sample (tuning allowed). `report` = disjoint sample, scored once per finalist.
- HLE (benchmark 45) is gated and not built, so it is scored 0, which costs every row below about 1.2 index points
  (HLE is a gold benchmark in Knowledge & Reasoning).
- Targets: Jev 1.14 = 60.70 (measured by DI). Microsoft-Decision-1 is not on the Decision Index. Earlier versions of
  this page used "MSD1 ≈ 62", which was **our extrapolation** (Microsoft's +1.2 lead over Jev 1.13 on its own,
  undisclosed suite, added to Jev 1.14's 60.70), not a Microsoft number. It is no longer used.
- Board context (DI 0.4.1, 346 entries, data of 2026-11-21): the board ranks on a Full score from private tests.
  On the public index alone, 62.73 would place about #99; the best entries score 73–75.
- Latency is our RTX 5090 per-request wall time, single process, not the DI maintainers' RTX PRO 6000 measurement.

## Full public 0.3 run (the whole public suite, not a sample)

Finished 2026-11-13 16:26 (Pacific) with `python -m decision_index pipeline --edition 0.3 --engine hybrid_engine:ExactTransformersEngine
--option letters=1 --option load_4bit=1 --option adapter=<soup78>` (fast engine, `prefix_share=1` default). It ran over
several sessions and resumed from `results.jsonl` after interruptions; every request was answered (`ok` 139,677 of 139,677).
All answers are published in [neerumsr/keel-pro-di-results](https://huggingface.co/datasets/neerumsr/keel-pro-di-results).
To re-score on Windows, set `PYTHONUTF8=1` first; otherwise the kit reads files as cp1252, loses two BRIGHT queries
whose ids contain `’`, and reports 62.71 / 139,675.

| | Value |
|---|---:|
| **Public index (Decision Index 0.3)** | **62.73** |
| Raw index (before chance correction) | 71.77 |
| Areas (skill × 100): knowledge / language / retrieval / tools / arts | 47.6 / 64.2 / 63.9 / 84.1 / 56.5 |
| Requests answered | 139,677 (no errors) |
| Latency median / p80 / mean / p95 (RTX 5090, per request) | 245 / 438 / 528 / 1,265 ms |
| Requests at or under 1 s | 90.4% |

- `scores.json` says `"complete": false` only because HLE (benchmark 45, 513 requests) is gated and was not built;
  it counts as 0 (unanswered), so 62.73 is a lower bound. The board needs `"complete": true`, so HLE must be added
  and the same run resumed before submission.
- No confidence interval: this is the full public suite, not a sample. It sits inside the report sample's CI
  (58.98–64.42) and above Jev 1.14's 60.70.
- Median, p80 and mean are all under the board's 1 s rule on our RTX 5090; the board measures on an RTX PRO 6000.

## Eval service history

Areas = Knowledge & Reasoning / Language Understanding / Retrieval & Classification / Tools & Automation / Arts (skill × 100).
Scoring: `kit` = the kit's local engine (bare option key); `end-token` = Keel-Pro's serving policy (key + `<|im_end|>`,
see `SERVE.md`); `http` = the model as served by Keel's `/api/v1/systemone` (the board's method). Keel-Lite's `http`
row includes 211 rows (13%) that Keel's wire rejected with 400 (empty state, state > 8,000 characters, long
instructions or descriptions); they score zero, as they would on the board.

| Time | Name | Sample | Scoring | Rows | Public index | 95% CI | Areas | Median ms | Minutes |
|---|---|---|---|---:|---:|---|---|---:|---:|
| 2026-10-30T09:47:45 | it1-4b | dev | kit | 1633 | **45.06** | 39.84–47.45 | 38.8 / 55.1 / 27.1 / 63.4 / 37.8 | 114.0 | 15.3 |
| 2026-10-30T10:24:44 | it1-4b | dev | end-token | 1633 | **49.70** | 46.09–53.59 | 35.6 / 49.0 / 56.0 / 71.8 / 34.7 | 145.1 | 20.8 |
| 2026-10-30T10:45:12 | qwen3.5-4b-stock | dev | end-token | 1633 | **12.35** | 11.05–15.33 | 5.8 / 0.5 / 28.2 / 22.9 / 8.7 | 141.6 | 20.3 |
| 2026-10-30T11:02:18 | keel-lite | dev | http | 1633 | **5.27** | 4.68–8.11 | 1.4 / 1.2 / 15.1 / 3.7 / 8.9 | 19.2 | 2.7 |
| 2026-10-30T13:14:46 | it2-4b | dev | end-token | 1633 | **48.88** | 46.40–51.93 | 32.4 / 42.7 / 53.8 / 78.2 / 44.1 | 139.3 | 20.0 |
| 2026-10-30T16:00:53 | it3-9b | dev | end-token | 1633 | **54.25** | 49.79–57.24 | 34.9 / 62.5 / 51.7 / 79.1 / 42.4 | 154.1 | 22.9 |
| 2026-10-30T16:15:35 | qwen3.5-4b-stock | dev | kit | 1633 | **7.02** | 5.91–9.93 | 4.3 / 3.8 / 6.1 / 16.1 / 7.6 | 107.5 | 14.6 |
| 2026-10-30T16:33:03 | qwen3.5-9b-stock | dev | kit | 1633 | **10.13** | 7.80–13.75 | 7.9 / 5.6 / 9.0 / 22.4 / 7.4 | 125.4 | 17.3 |
| 2026-10-31T23:36:32 | it5-9b-letters | dev | letters | 1633 | **52.50** | 49.29–55.67 | 37.5 / 50.3 / 52.8 / 82.3 / 41.8 | 85.5 | 14.3 |
| 2026-11-01T12:02:35 | it7-27b-qlora-letters | dev | letters | 1633 | **60.32** | 55.09–62.68 | 46.2 / 64.3 / 59.1 / 86.2 / 41.9 | 318.8 | 55.7 |
| 2026-11-01T19:29:33 | it8-27b-qlora-letters | dev | letters | 1633 | **59.61** | 56.52–62.33 | 45.3 / 57.6 / 59.4 / 84.8 / 56.1 | 319.5 | 57.0 |
| 2026-11-01T20:31:03 | soup78-27b-qlora-letters | dev | letters | 1633 | **62.06** | 56.63–64.13 | 44.9 / 67.3 / 60.6 / 85.0 / 54.0 | 321.3 | 56.4 |
| 2026-11-01T22:35:39 | soup78-27b-qlora-letters | report | letters | 3272 | **61.96** | 58.98–64.42 | 48.0 / 62.5 / 61.2 / 81.7 / 62.1 | 328.7 | 115.5 |
| 2026-11-02T00:50:00 | soup78-27b-qlora-letters-prefix (fast engine, latency re-measure; same model, same rows) | report | letters | 3272 | 61.66 | 58.83–64.28 | 48.0 / 62.8 / 59.2 / 81.7 / 62.2 | 316.4 | 46.0 |
| 2026-11-13T16:26:22 | soup78-27b-qlora-letters-prefix (fast engine) | **full public** | letters | 139677 | **62.73** | — (full suite) | 47.6 / 64.2 / 63.9 / 84.1 / 56.5 | 244.6 | resumed (several sessions) |
