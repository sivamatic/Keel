# Keel-Pro: the story so far

Keel-Pro is a bigger, optional Keel model that runs on a GPU. This page shows what we built, how we test it and
where it stands, mostly in pictures. Every number comes from a real run on our RTX 5090.

<!-- diagram:pro-status -->

## The goal in one line

Score at least **62** on the Decision Index (DI) public index, the open benchmark for decision models, which puts
Keel-Pro above Jev 1.14 (60.70).

**Where that sits on the live board.** The DI board (0.4.1, 346 entries, data of 2026-11-21) ranks models on a Full
score from private tests that only its maintainers run. Keel-Pro has not been submitted yet. On the public index
alone, 62.73 would place about **#99**; the best entries score 73–75. Microsoft-Decision-1 is not on the board.
All 139,677 answers are public so anyone can re-score them:
[neerumsr/keel-pro-di-results](https://huggingface.co/datasets/neerumsr/keel-pro-di-results).

## How it works, end to end

<!-- diagram:pro-journey -->

| Step | In plain words | Where |
|---|---|---|
| 1. Data | We collect practice questions from public training sets and write our own generators. We never train on DI's test questions. | `artifacts/parity/pro/DATA.md` |
| 2. Train | We teach a small add-on (a "LoRA") on top of an open Qwen3.5 model. The base model stays untouched. | `training/pro/train_lora.py` |
| 3. Score | We ask the model 1,633 DI questions (the "dev" sample) and grade it with DI's own scoring code. | `scripts/di/eval_model.py` |
| 4. Decide | Below 62? Change one thing and train again. At 62 or above? That model is the finalist. | `artifacts/parity/pro/train-notes.md` |
| 5. Report | The finalist answers a separate set of 3,272 questions, once, so the final number is not tuned. | `artifacts/parity/pro/di-results.md` |
| 6. Export | We pack the model into GGUF files that run in llama.cpp, and check they give the same answers. | `scripts/di/gguf_check.py` |
| 7. Serve | Keel sends a question to Keel-Pro only when the request asks for the `decider-pro-1.0.0` model. | `artifacts/parity/pro/SERVE.md` |
| 8. Publish | Model card and upload kit are ready. Nothing goes public without your OK. | `hf/keel-pro/`, `RELEASE_CHECKLIST.md` |

## How Keel-Pro answers a question

<!-- diagram:pro-letters -->

The model reads the situation and the options once. Each option gets a letter, and we read how likely the model
thinks each letter is. It never writes free text, so it cannot ramble or invent an option.

## Results

<!-- diagram:pro-iterations -->

- Training lifts a stock model from about **10** to **60+**.
- The biggest single jump came from a bigger base model: **9B → 27B gave +6 points**.
- Averaging two 27B runs (soup78) gave the best dev score, **62.06**.
- On the separate report sample, scored once, the finalist gets **61.96** (95% range 58.98–64.42). Jev's 60.70 is
  inside that range, so we call it **on par with Jev**.
- On the **whole public suite** (139,677 questions, all answered), it scores **62.73**, above Jev's 60.70. HLE is
  still counted as 0, so the true number is a bit higher. About 98 board entries score higher on the public index.

### Where the finalist is strong and weak (report sample)

<!-- diagram:pro-areas -->

Weakest spots for it7 on dev, with the reason (soup78 keeps the same pattern):

| Benchmark | Score | Why |
|---|---:|---|
| POP909 chords (music) | 0.02 | These practice questions were too long for the 4,096-token limit, so it7 never trained on them |
| cfcolor (colour taste) | 0.03 | Personal taste from a few ratings; hard to learn |
| ChessBench | 0.15 | Needs real chess calculation |

## What each run changed

| Run | Base model | What changed | Dev index |
|---|---|---|---:|
| it1 | Qwen3.5-4B | First LoRA, 64k questions | 49.70 |
| it2 | 4B | Longer prompts, end-token scoring | 48.88 |
| it3 | 9B | Bigger base | 54.25 |
| it4 | 9B | More data (stopped early to make room for it5) | — |
| it5 | 9B | Letters read-out, 2× data; half the latency | 52.50 |
| it6 | 9B | New synthetic data, longer prompts | out of memory |
| it7 | **27B, 4-bit** | Biggest base that fits our 32 GB GPU | **60.32** |
| it7 + TTA | 27B | Ask each question twice with the options shuffled, then average | 59.83 (partial, dropped) |
| it8 | 27B | Continue it7 with fresh data, including the long chord questions | 59.61 |
| **soup78** ⭐ | 27B | Average of it7 and it8 (keep the best of both) | **62.06** |
| **soup78, report** ✅ | 27B | Final check on 3,272 fresh questions, scored once | **61.96** (CI 58.98–64.42) |
| soup78, report, fast engine | 27B | Same model and sample, shared text read once (for the 1 s rule) | 61.66 (CI 58.83–64.28) |
| **soup78, full public suite** 🏁 | 27B | Every public question (139,677), fast engine | **62.73** |

**The final number.** On fresh questions it never saw during selection, the finalist scores **61.96**,
almost the same as its dev score (62.06). That means we did not over-tune to the dev sample.

| | Index | What it means |
|---|---:|---|
| Keel-Pro (full public suite) | **62.73** | Ours, every public question, measured on this machine |
| Keel-Pro (report) | 61.96 | Ours, 3,272-question sample |
| Jev 1.14 | 60.70 | Above this |
| Best DI board entries (27B–31B) | 73–75 | Well below these |

Our 95% range (58.98–64.42) includes Jev. Plain reading: **on par with Jev**, mid-board overall, not a proven win.

**Why it8 looks lower but is not simply worse.** Music chords went from 2% to 85% right. But one
sarcasm benchmark has a single "yes" example in our test sample: it7 caught it, it8 did not. That one tweet
moves the whole index by ~1.7 points. Small samples are noisy, so we average both models.

### The memory fix that unlocked it8, in plain words

The longest questions (music chord charts, ~5,000 words) did not fit. The model kept one giant
"who-looks-at-whom" table in memory for every question: its size grows with the length × the length.
We switched to the slimmer method that builds the table in pieces.

| | Peak GPU memory, 5,000-token question |
|---|---:|
| Before | 29.9 GB (over our limit, skipped) |
| After | **23.4 GB** (fits) |

## Speed

| How it runs | Median time per question |
|---|---:|
| 27B, 4-bit, RTX 5090 (how we score it) | 0.32 s |
| 27B GGUF Q8_0, llama.cpp CUDA, RTX 5090 | **0.24 s** |
| 27B GGUF Q4_K_M (16.8 GB file), llama.cpp CUDA, RTX 5090 | **0.24 s** |
| 27B GGUF Q4_K_M, CPU only (12 threads) | 15.4 s |
| 27B GGUF Q8_0, CPU only | 32.9 s |

The DI board's latency rule is per request, on one RTX PRO 6000: the **median, mean and 80th percentile** must all be
at most 1 second. The first engine read the long shared text again for every question. The fast engine reads it
**once** per request and then answers all questions together.

<!-- diagram:pro-prefix -->

| Report sample (3,272 requests), RTX 5090 | Before | **After** | Board limit | |
|---|---:|---:|---:|---|
| Median | 329 ms | **316 ms** | 1,000 ms | ✅ |
| 80th percentile | 2,232 ms | **847 ms** | 1,000 ms | ✅ |
| Mean | 2,082 ms | **844 ms** | 1,000 ms | ✅ |
| Whole sample | 114 min | **46 min** | | |

Same answers as before on **17,150 of 17,182** questions (99.8%). The few flips come from tiny rounding
differences when questions are computed together. Scored on the same report sample, the fast engine gets
**61.66** (CI 58.83–64.28), against 61.96 for the slow one. Still above Jev's 60.70. We report both and treat 61.66
as the number the board path would produce. Our RTX 5090 is the same Blackwell chip family as the board's RTX PRO
6000, which has slightly more cores and 3× the memory; we have not measured on one.

| Family (many questions per request) | Before, mean | After, mean |
|---|---:|---:|
| ContractNLI (17 questions) | 18.8 s | 1.8 s |
| ACOS (59 questions) | 14.3 s | 2.5 s |
| Home-Appliance (18 questions) | 7.5 s | 1.3 s |
| ToolRet (32 questions) | 8.9 s | 3.9 s |
| BRIGHT (32 questions) | 12.6 s | 6.5 s |

**Whole public suite (139,677 requests, fast engine, RTX 5090):** median **245 ms**, 80th percentile **438 ms**,
mean **528 ms**, all under the 1 s limit ✅. 90% of requests finish within 1 s; the slowest 5% take over 1.27 s.

The GGUF builds also reuse the shared text (llama.cpp prompt cache), but answer the questions one at a time
(about 140 ms each). So for many-question requests they are slower (ContractNLI 7.7 s); they are best for
single questions. The CPU builds are for offline use. Both GGUF files pick the same answer as the scored model
on 30 of 30 checked questions.

## Honesty rules we follow

- Numbers come only from real runs. Vendor numbers are labelled.
- The "report" sample is scored once, for the finalist only, so the result is not tuned to it.
- We never train on DI test questions, and we never edit a test case to improve a score.
- DI's HLE benchmark needs a gated download, so we score it as 0. That costs about 1.2 points on every row above.

## Read more

- Model card: `artifacts/parity/pro/MODEL_CARD.md`. Files, licence and limitations.
- Training notebook: `artifacts/parity/pro/train-notes.md`. Every run, lever and failure.
- Serving guide: `artifacts/parity/pro/SERVE.md`. How to run the sidecar.
