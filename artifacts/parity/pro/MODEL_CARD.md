---
license: apache-2.0
base_model: Qwen/Qwen3.5-27B
base_model_relation: adapter
library_name: peft
pipeline_tag: text-classification
language: [en]
tags: [decision-model, lora, qlora, peft, qwen3.5, decision-index, routing, agents, llm-as-judge, keel]
model-index:
  - name: Keel-Pro
    results:
      - task:
          type: text-classification
          name: Typed decisions (choice, score, yes/no)
        dataset:
          name: Decision Index 0.3 (public suite, 139,677 requests)
          type: apolinario/decision-index
        metrics:
          - type: decision_index
            name: Public index (HLE gated, counted as 0)
            value: 62.73
        source:
          name: Self-reported full public run
          url: https://github.com/sivamatic/Keel/blob/main/artifacts/parity/pro/di-results.md
---

# Keel-Pro

Keel-Pro is an open-weight decision model: given a `state` and one or more typed questions (`choice`, `score`,
`noul` = yes/no), it returns a probability over the options. It is a LoRA fine-tune of **Qwen/Qwen3.5-27B** (Apache-2.0)
and serves Keel's optional `decider-pro-1.0.0` pin through a loopback sidecar
(`serve/keel_pro_server.py`, see [SERVE.md](https://github.com/sivamatic/Keel/blob/main/artifacts/parity/pro/SERVE.md)). Keel-Lite (the CPU ONNX model) stays Keel's default.

**At a glance:** Decision Index public 0.3 = **62.73** on the full public suite (all 139,677 requests answered,
self-run with the DI kit). Median latency 245 ms per request on one RTX 5090. Apache-2.0, open weights, runs on
your own GPU.

**Read this first.**
- The live DI board (0.4.1, 346 entries, data of 2026-11-21) ranks on a **Full score from private tests** run by its
  maintainers. Keel-Pro has **not** been submitted yet, so it has no Full score.
- On the public index alone, 62.73 would place about **#99 of 346**. The best entries (27B–31B) score 73–75 public and
  72–74 Full. Jev 1.14 is 60.70 public, 60.24 Full.
- Training used **train splits of public datasets behind 24 of the 37 DI benchmarks, in DI's prompt format** (never
  DI eval rows; see DATA.md). Expect the private Full score to come in lower than the public index.
- Microsoft-Decision-1 is not on the Decision Index, so there is no comparable number for it.
- Every answer from the 62.73 run is public and re-scorable:
  [neerumsr/keel-pro-di-results](https://huggingface.co/datasets/neerumsr/keel-pro-di-results).

## Quick start

```bash
git clone https://github.com/sivamatic/Keel && cd Keel
pip install -r serve/requirements.txt
hf download Qwen/Qwen3.5-27B --local-dir models/Qwen3.5-27B
hf download neerumsr/keel-pro --local-dir models/keel-pro
python serve/keel_pro_server.py --model-dir models/Qwen3.5-27B --adapter models/keel-pro --load-4bit --port 8090
```

Then run Keel with `KEEL_PRO_URL=http://127.0.0.1:8090` and call it with model `decider-pro-1.0.0`:

```bash
curl -s http://127.0.0.1:8080/api/v1/systemone -H "Authorization: Bearer $KEEL_TOKEN" -H "Content-Type: application/json" -d '{
  "model": "decider-pro-1.0.0",
  "state": {"ticket": "I was charged twice this month"},
  "questions": {"route": {"type": "choice", "instructions": "Which team handles this?",
    "criteria": {"billing": "payments and invoices", "tech": "bugs and outages", "account": "login and profile"}}}
}'
```

The answer has `answers.route.choice`, `.confidence` and `.probabilities`. Docker, Compose and Kubernetes recipes:
[deployment guide](https://github.com/sivamatic/Keel/blob/main/docs/deployment.md). Smaller GPU? Use the GGUF build with
llama.cpp ([neerumsr/keel-pro-GGUF](https://huggingface.co/neerumsr/keel-pro-GGUF), Q4_K_M is a 16.8 GB file).

## Results on the Decision Index (public 0.3 index)

Measured on this machine with the DI kit's own prompts and scorers ([di-results.md](https://github.com/sivamatic/Keel/blob/main/artifacts/parity/pro/di-results.md) has every run). The full public row covers every public request; the other rows are
**sample estimates** with a group-bootstrap 95% CI: `dev` (1,633 rows, used for iteration) and `report`
(3,272 disjoint rows, scored once for the finalist). HLE is gated and scored 0 (costs about 1.2 points).

| Model | Sample | Public index | 95% CI | Median latency |
|---|---|---:|---|---:|
| **Keel-Pro (soup78), fast engine** | **full public suite (139,677 requests)** | **62.73** | — (full suite) | **245 ms** (p80 438, mean 528) |
| Keel-Pro (finalist, soup78) | report | 61.96 | 58.98–64.42 | 329 ms |
| Keel-Pro (soup78), fast engine | report | 61.66 | 58.83–64.28 | 316 ms (mean 844, p80 847) |
| Keel-Pro (finalist, soup78) | dev | 62.06 | 56.63–64.13 | 321 ms |
| Keel-Pro it7 (single run) | dev | 60.32 | 55.09–62.68 | 319 ms |
| Jev 1.14 | full suite | 60.70 | — | — (DI board public index; Full score 60.24) |
| Best entries on the DI 0.4.1 board | full suite | 73–75 | — | DI board, 2026-11-21 (e.g. karpo-decision-31B 75.05, GLiDE 27B 72.49) |
| Keel-Lite (`decider-3.0.0`) over HTTP | dev | 5.27 | 4.68–8.11 | 19 ms |
| Stock Qwen3.5-9B (kit prompt) | dev | 10.13 | 7.80–13.75 | 125 ms |

Latency is our RTX 5090 (32 GB) per-request wall time, one process, not DI's RTX PRO 6000 measurement.

**Full public run.** The whole public 0.3 suite (139,677 requests, every one answered) scores **62.73**, with
areas knowledge 0.476, language 0.642, retrieval 0.639, tools 0.841, arts 0.565. HLE (gated) still counts as 0,
so this is a lower bound, and `scores.json` is not yet `"complete": true` for the board. Median, p80 and mean
latency (245 / 438 / 528 ms) are all under the board's 1 s rule on our RTX 5090.

Report-sample area scores (soup78): knowledge 0.480, language 0.625, retrieval 0.612, tools 0.817, arts 0.621.
Read honestly: 61.96 is above Jev 1.14's 60.70 point estimate, but 60.70 lies inside our 95% CI, so this is
**on par with Jev**, not a proven win, and well behind the top of the board. Three candidates (it7, it8, soup78) were
compared on `dev`; the `report` sample was scored once, for soup78 only.

Fast engine (`hybrid_engine.py`, `prefix_share=1`, the default): for a request with several questions, the token
prefix every prompt shares (system + state) is run once and the questions' remaining tokens continue copies of that
cache in right-padded batches. Same prompts and read-out; on the report sample it agrees with the one-pass-per-question
run on 17,150 of 17,182 answers (bf16 batching differences) and scores 61.66. It was built for the latency rule, not
to change the score, and we list both rows rather than pick one.

## Training

- Base: Qwen/Qwen3.5-27B. LoRA r32, alpha 64, no dropout, on the attention, linear-attention (`in_proj_qkv`, `in_proj_z`,
  `out_proj`) and MLP projections. QLoRA: the base is loaded in 4-bit NF4 with double quantization and bf16 compute; only the LoRA weights train (217.6M parameters). Trained with a 4,096 (it7) / 5,120 (it8) token cap on one RTX 5090 (32 GB).
- The released adapter (**soup78**) is the exact average of two runs: it7 (48k rows, lr 1e-4) and it8 (it7 continued on
  ~20k fresh rows, including long POP909 chord rows, lr 5e-5). PEFT `cat` at 0.5/0.5 gives a rank-64 adapter whose
  weight change is the mean of the two (`training/pro/soup_adapters.py`).
- Data: train splits of public datasets mapped to 24 DI benchmarks plus own synthetic generators; never DI
  eval rows. Every source, revision, split and licence is in [DATA.md](https://github.com/sivamatic/Keel/blob/main/artifacts/parity/pro/DATA.md).
- Read-out (`letters`): options are shown as `A. key: description`; the answer is the softmax over the label
  logits at one position (one forward pass). Half the training rows permute option order.
- Iterations, levers and failures: [train-notes.md](https://github.com/sivamatic/Keel/blob/main/artifacts/parity/pro/train-notes.md).

## Files

| File | What |
|---|---|
| `adapter_model.safetensors`, `adapter_config.json` | The LoRA, rank 64 (load on top of the base with PEFT) |
| `tokenizer.json`, `tokenizer_config.json`, `chat_template.jinja` | Unchanged from the base |
| `keel-pro.json` | Model id, read-out policy (`letters`) and how the adapter was built |
| `NOTICE`, `LICENSE`, `SHA256SUMS` | Attribution, Apache-2.0 text, file checksums |

Merged GGUF builds for llama.cpp (`keel-pro-Q8_0.gguf`, `keel-pro-Q4_K_M.gguf`) are in
[neerumsr/keel-pro-GGUF](https://huggingface.co/neerumsr/keel-pro-GGUF).

GGUF fidelity: both `keel-pro-Q8_0.gguf` (29.0 GB) and `keel-pro-Q4_K_M.gguf` (16.8 GB) pick the same option as the
measured transformers run (4-bit NF4 base + adapter) on **30 of 30** dev questions (`scripts/di/gguf_check.py`, llama.cpp
b12029). Median per question with the CUDA llama-server (`-ngl 99`, RTX 5090): **243 ms** (Q8_0) and **242 ms**
(Q4_K_M), again 30 of 30 agreement. CPU-only llama-server (12 threads): 15.4 s for either file.

## Limitations

- The full public run (62.73) has no CI because it covers the whole public suite; the sample rows have wide CIs
  (±3 points). HLE is gated and counted as 0, and the DI board also scores private tests we cannot run.
- Latency (full public suite, RTX 5090, fast engine): median 245 ms, p80 438 ms, mean 528 ms per request, inside
  the DI board's ≤ 1,000 ms rule; p95 is 1.27 s (long retrieval rows with 32 candidates). Not yet measured on
  the board's RTX PRO 6000.
- Weakest on reasoning-heavy benchmarks (GPQA, ChessBench, CRUXEval) and on taste/arts tasks.
- Needs a GPU for interactive latency (the Q4_K_M GGUF is a 16.8 GB file); CPU GGUF works but is seconds per question.
- English only. Probabilities are the model's own (no calibration layer).
- Not a safety classifier; use Keel-Lite's hybrid mode or a human gate for safety-critical decisions.

## License

Apache-2.0 for the adapter and code; the Qwen3.5 base is Apache-2.0 (notice kept in `NOTICE`). Some training rows
come from CC BY-SA sources (MNLI portions, SNLI, ARC, HoVer/Wikipedia). They are attributed in `DATA.md` and
`docs/licenses.md` and never redistributed. No non-commercial data (ANLI, RACE) was used for training.
