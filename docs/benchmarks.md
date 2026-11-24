# Benchmarks

Keel against an LLM baseline, the lexical fallback and the larger Keel-3-Pro candidate, on suites the models never trained on. Every Keel and LLM number on this page was measured by scripts in this repository. Jev and Microsoft-Decision-1 numbers are vendor-reported or third-party, and are labelled as such.

## Read this first

- **We have not measured Jev or Microsoft-Decision-1 ourselves.** No credentials were available during this round. Every cell for those two models is either "not measured" or a cited figure from the vendor or a third party.
- **Small suites.** The older held-out suites have 20–60 cases each. Expect ±10–15 points of noise.
- **"Fully right"** means every question in a case was answered within its accepted band. One case can contain several questions.
- **A safety miss** is a harmful answer on a case labelled safety-critical: for example, choosing `run` for a destructive command, or "not an injection" for an injection.
- **Latency.** The accuracy tables were measured on a busy shared machine, with several models loaded in one process, which inflates their latency columns. The release latency was measured separately, one model per process on an idle CPU with `scripts/keel-latency.ts`: in-process p95 <!-- num:k3.p95.idle -->13.7–14.3 ms<!-- /num --> for Keel-3 and <!-- num:k2.p95.idle -->13.3–14.5 ms<!-- /num --> for Keel-2.

## Models compared

| Name | What it is | Size | Status |
|---|---|---:|---|
| **Keel-3** `decider-3.0.0` | xtremedistil-l6-h256 NLI cross-encoder, trained in three stacked passes on data v3/v9 with distillation from Keel-3-Pro and a safety loss (candidate `t1-r11`), mixed int8 | <!-- num:k3.size -->17.7 MB<!-- /num --> | **Default** since 3.0.0. `decider-latest`, `jev-*` and the Microsoft-Decision-1 aliases resolve to it. |
| **Keel-2** `decider-2.0.0` | Same architecture, fine-tuned, int8 | <!-- num:k2.size -->13 MB<!-- /num --> | Previous default, still pinnable |
| **Keel-3-Pro** `t2-dxs-b3` | DeBERTa-v3-xsmall, about 70M parameters | <!-- num:pro.size -->108 MB<!-- /num --> | Research candidate and distillation teacher. Too slow for the 20 ms budget. |
| **Lexical** `decider-1.2.0` | Keel-1 feature model, the fallback | code only | Shipped as fallback |
| **LLM baseline** | gpt-5-mini (older suites), claude-haiku-4.5 (blind, blind-c), through the Copilot CLI | hosted | Reference |

## Headline results

<!-- diagram:bench-bars -->

| Suite | Keel-2 | Keel-3 | Keel-3-Pro | Lexical | LLM |
|---|---:|---:|---:|---:|---:|
| holdout-20 | <!-- num:k2.h20 -->15/20<!-- /num --> | <!-- num:k3.h20 -->18/20<!-- /num --> | <!-- num:pro.h20 -->18/20<!-- /num --> | <!-- num:lex.h20 -->9/20<!-- /num --> | <!-- num:llm.h20 -->16/20<!-- /num --> |
| holdout-b-20 (cleanest) | <!-- num:k2.hb20 -->10/20<!-- /num --> | <!-- num:k3.hb20 -->18/20<!-- /num --> | <!-- num:pro.hb20 -->16/20<!-- /num --> | <!-- num:lex.hb20 -->8/20<!-- /num --> | <!-- num:llm.hb20 -->13/20<!-- /num --> |
| open-60 | <!-- num:k2.open60 -->34/60<!-- /num --> | <!-- num:k3.open60 -->52/60<!-- /num --> | <!-- num:pro.open60 -->51/60<!-- /num --> | <!-- num:lex.open60 -->25/60<!-- /num --> | <!-- num:llm.open60 -->46/60<!-- /num --> |
| **Held-out 100** (the three above) | <!-- num:k2.h100 -->59/100<!-- /num --> | <!-- num:k3.h100 -->88/100<!-- /num --> | <!-- num:pro.h100 -->85/100<!-- /num --> | <!-- num:lex.h100 -->42/100<!-- /num --> | <!-- num:llm.h100 -->75/100<!-- /num --> |
| **Blind 234** | <!-- num:k2.blind -->92/234<!-- /num --> | <!-- num:k3.blind -->125/234<!-- /num --> | <!-- num:pro.blind -->134/234<!-- /num --> | <!-- num:lex.blind -->87/234<!-- /num --> | <!-- num:llm.blind -->215/234<!-- /num --> |
| **All held-out 334** | <!-- num:k2.heldout -->151/334<!-- /num --> | <!-- num:k3.heldout -->213/334<!-- /num --> | <!-- num:pro.heldout -->219/334<!-- /num --> | <!-- num:lex.heldout -->129/334<!-- /num --> | <!-- num:llm.heldout -->290/334<!-- /num --> |
| Safety misses, blind | <!-- num:k2.blind.safety -->11<!-- /num --> | <!-- num:k3.blind.safety -->11<!-- /num --> | <!-- num:pro.blind.safety -->11<!-- /num --> | <!-- num:lex.blind.safety -->22<!-- /num --> | <!-- num:llm.blind.safety -->0<!-- /num --> |
| Safety misses, all held-out | <!-- num:k2.heldout.safety -->14<!-- /num --> | <!-- num:k3.heldout.safety -->12<!-- /num --> | <!-- num:pro.heldout.safety -->13<!-- /num --> | <!-- num:lex.heldout.safety -->27<!-- /num --> | <!-- num:llm.heldout.safety -->2<!-- /num --> |
| Choice ECE, blind (lower is better) | <!-- num:k2.ece.blind -->0.182<!-- /num --> | <!-- num:k3.ece.blind -->0.108<!-- /num --> | <!-- num:pro.ece.blind -->0.109<!-- /num --> | 0.112 | <!-- num:llm.ece.blind -->0.080<!-- /num --> |
| **blind-c 100** (confirmation, not in the totals) | <!-- num:k2.blindc -->47/100<!-- /num --> | **<!-- num:k3.blindc -->40/100<!-- /num -->** | not measured | 43/100 | <!-- num:llm.blindc -->37/100 (39 answered)<!-- /num --> |
| Safety misses, blind-c | <!-- num:k2.blindc.safety -->10<!-- /num --> | **<!-- num:k3.blindc.safety -->12<!-- /num -->** | not measured | 10 | 0 |
| Latency p50 / p95, blind (loaded box, several models per process) | <!-- num:k2.blind.lat -->8.0 / 19.6 ms<!-- /num --> | <!-- num:k3.blind.lat -->14.9 / 26.7 ms<!-- /num --> | <!-- num:pro.blind.lat -->117 / 242 ms<!-- /num --> | 0.05 / 0.22 ms | <!-- num:llm.blind.lat -->55.7 / 93.1 s<!-- /num --> |
| **In-process p95, idle CPU** (one model per process) | <!-- num:k2.p95.idle -->13.3–14.5 ms<!-- /num --> | <!-- num:k3.p95.idle -->13.7–14.3 ms<!-- /num --> | not measured | not measured | not applicable |

The LLM column for the "all held-out" row mixes gpt-5-mini (held-out 100) and claude-haiku-4.5 (blind). On blind-c the LLM answers come from a cache that covers only 39 of 100 cases; unanswered cases count as wrong, so that cell understates the LLM. LLM latency is Copilot CLI wall time, including start-up, so it overstates raw API latency. Keel-2 and Keel-3 rows come from `artifacts/parity/t1-r11-parity.md`; Keel-3-Pro and lexical rows from earlier runs of the same harness.

### What the table says

- **Keel-3 beats the LLM baseline on the older held-out suites** (<!-- num:k3.h100 -->88/100<!-- /num --> vs <!-- num:llm.h100 -->75/100<!-- /num -->), and beats Keel-2 on the held-out 334 by 62 cases and on blind by 33.
- **On the blind suite, the LLM is far ahead** (<!-- num:llm.blind -->215/234<!-- /num --> vs <!-- num:k3.blind -->125/234<!-- /num -->). The blind suite is longer, more varied and adversarial, and it is closer to real agent traffic. This is the honest picture of where a 13–18 MB model stands.
- **Keel-3 regresses on blind-c.** See [the blind-c regression](#the-blind-c-regression) below.
- **Safety misses are not zero for any Keel model.** See [promotion gates](#promotion-gates).
- **Calibration improved.** Keel-3's blind ECE of <!-- num:k3.ece.blind -->0.108<!-- /num --> is well below Keel-2's, so its confidence is a usable signal for the τ gate.
- **Latency is unchanged.** On an idle CPU both models have an in-process p95 of about 14 ms.
- **Bigger is better, but slower.** Keel-3-Pro has the best Keel blind score but runs about 6× slower and is about 6× larger.

## The blind-c regression

blind-c is a 100-case **confirmation** suite, written after the others by data-1 and a different-model sub-agent, and kept untouched: it was not used to select checkpoints, calibrate, or decide the promotion. On it, **Keel-3 is worse than Keel-2**:

| blind-c 100 | Keel-2 | Keel-3 | Change |
|---|---:|---:|---:|
| Fully right | <!-- num:k2.blindc -->47/100<!-- /num --> | <!-- num:k3.blindc -->40/100<!-- /num --> | <!-- num:k3.blindc.delta -->−7<!-- /num --> |
| Safety misses | <!-- num:k2.blindc.safety -->10<!-- /num --> | <!-- num:k3.blindc.safety -->12<!-- /num --> | <!-- num:k3.blindc.safety.delta -->+2<!-- /num --> |
| Choice / score band / yes-no band | <!-- num:k2.blindc.bytype -->32 / 4 / 11<!-- /num --> | <!-- num:k3.blindc.bytype -->32 / 4 / 4<!-- /num --> | yes/no <!-- num:k3.blindc.noul.delta -->−7<!-- /num --> |

The loss is concentrated in yes/no questions. Every Keel-3 training candidate in this round was below Keel-2 on blind-c (37–41 fully right), so this is a property of the training line, not of one checkpoint. Keel-3 was still promoted because it wins clearly on the 334 held-out cases and ties or improves on safety there, but blind-c is the most recent untouched evidence and it points the other way.

**What to do about it:**

- **For safety-critical gates** (destructive commands, secrets, prompt injection, moderation), run Keel in the hybrid setting: act on Keel only above τ and send everything else to an LLM, or pin `"model": "decider-2.0.0"` for those questions. See [Token savings](token-savings.md) for the τ trade-off.
- Never let Keel alone approve a destructive action, with either model.
- Watch the next release notes: the follow-up work targets yes/no calibration and blind-c.

## Blind suite by question type

| Type | Questions | Keel-2 | Keel-3 | Keel-3-Pro | Lexical | claude-haiku-4.5 |
|---|---:|---:|---:|---:|---:|---:|
| choice | 135 | <!-- num:k2.blind.choice -->59<!-- /num --> | <!-- num:k3.blind.choice -->78<!-- /num --> | <!-- num:pro.blind.choice -->94<!-- /num --> | 62 | <!-- num:llm.blind.choice -->125<!-- /num --> |
| score | 39 | <!-- num:k2.blind.score -->13<!-- /num --> | <!-- num:k3.blind.score -->20<!-- /num --> | <!-- num:pro.blind.score -->14<!-- /num --> | 6 | <!-- num:llm.blind.score -->33<!-- /num --> |
| noul | 60 | <!-- num:k2.blind.noul -->20<!-- /num --> | <!-- num:k3.blind.noul -->27<!-- /num --> | <!-- num:pro.blind.noul -->27<!-- /num --> | 19 | <!-- num:llm.blind.noul -->57<!-- /num --> |

Score bands and yes/no questions are Keel's weakest areas. They are where the τ gate should defer most often.

## The suites

| Suite | Cases | Written by | Used in training? | Notes |
|---|---:|---|---|---|
| labeled-50 | 50 | Keel author | **Yes**, in the training mix | In-sample. Keel-2 gets 48/50. Never quoted as a quality claim. |
| holdout-20 | 20 | Keel author | No | Its failure list was looked at once during Keel-2 error analysis. |
| holdout-b-20 | 20 | Keel author | No | Written before Keel-2 was trained, with different instructions and keys. The cleanest of the older suites. |
| open-60 | 60 | Keel author | No | Open domains deliberately absent from the training families |
| **blind-234** | 234 | A separate author (data-1) | No, and never inspected by the trainers | Long states, adversarial injections, contracts, incident threads, agent gating. Trainers see only aggregates. |
| **blind-c** | 100 | data-1 plus a different-model sub-agent | No, and not used for selection or promotion | Final confirmation suite. Reported separately and excluded from "all held-out". |

Training data generation drops any example that shares a 6-gram with a held-out or blind state. The blind suite source files live in `src/lib/decider/eval-blind*.ts`. A promotion candidate is scored once on blind, and only aggregate numbers are reported back to trainers.

Reproduce the older suites with `npm run keel:bench`. Score any model directory on every suite, blind included, with `node --experimental-strip-types scripts/keel-parity-bench.ts --model <dir> --out <prefix>`. See [Training guide](training-guide.md#6-bench-and-promote).

## Public benchmarks: the gap

We also ran Keel-2 on 18 public datasets, with stratified samples of up to 1,000 items each. The unweighted mean accuracy was **<!-- num:pub.k2.mean -->42.8%<!-- /num -->**. The best Keel-3 line candidate measured so far (`t1-r1`) scored <!-- num:pub.t1r1.mean -->45.7%<!-- /num -->. The promoted Keel-3 (`t1-r11`) has not been run on the public suite yet: not measured.

| Dataset | Type | Keel-2 accuracy | Majority baseline | Jev 1.14 (third-party Decision Index) |
|---|---|---:|---:|---:|
| AG News | choice, 4-way | <!-- num:pub.k2.agnews -->79.8%<!-- /num --> | 25.0% | not on board |
| SST-2 | choice | <!-- num:pub.k2.sst2 -->74.3%<!-- /num --> | 50.9% | not on board |
| BANKING77 | choice, 77-way | <!-- num:pub.k2.banking77 -->42.6%<!-- /num --> | 1.3% | 79.9 macro-F1 |
| CLINC150 | choice, 151-way | <!-- num:pub.k2.clinc150 -->38.3%<!-- /num --> | 18.2% | 90.3 macro-F1 |
| civil_comments | noul, balanced | <!-- num:pub.k2.civil -->58.1%<!-- /num --> | 50.0% | not on board |
| ANLI | choice, 3-way | <!-- num:pub.k2.anli -->34.7%<!-- /num --> | 33.4% | 74.3 macro-F1 |
| MMLU | choice | <!-- num:pub.k2.mmlu -->26.1%<!-- /num --> | 27.4% | 91.7% |
| ARC-Challenge | choice | <!-- num:pub.k2.arcc -->23.5%<!-- /num --> | 26.6% | 97.6% |
| HellaSwag | choice | <!-- num:pub.k2.hellaswag -->29.5%<!-- /num --> | 25.7% | 94.3% |

The Jev column comes from the third-party [Decision Index](https://github.com/apolinario/decision-index) board, with its own samples, prompts and sometimes a different metric. It is indicative, not a head-to-head. Microsoft publishes no per-dataset numbers for Microsoft-Decision-1.

**What this means.** Keel is clearly above chance on topic, sentiment, intent and toxicity classification, where the answer is visible in the text. It is at chance on knowledge and reasoning benchmarks (MMLU, ARC, HellaSwag, ANLI, WinoGrande), where the answer needs facts or multi-step inference that a 13M-parameter NLI model does not have. A 9B hosted model wins on breadth. Keel is built for the typed branches inside an agent, not for exam questions.

## Decision Index: Keel-Pro

Keel-Pro is the optional GPU model: a LoRA on Qwen3.5-27B, served by `serve/keel_pro_server.py` under model `decider-pro-1.0.0`. We scored it with the [Decision Index](https://github.com/apolinario/decision-index) kit's own prompts and scorers, on seeded samples of the public 0.3 suite, on this machine. HLE is gated and scored 0, which costs about 1.2 points.

| Model | Sample | Public index | 95% CI | Median latency |
|---|---|---:|---|---:|
| **Keel-Pro (soup78)** | report, 3,272 rows, scored once | **61.96** | 58.98–64.42 | 329 ms (RTX 5090) |
| Keel-Pro (soup78), fast engine | same report rows | 61.66 | 58.83–64.28 | 316 ms; mean 844, p80 847 |
| **Keel-Pro (soup78), fast engine** | **full public suite, 139,677 requests** | **62.73** | — (full suite; HLE counted 0) | 245 ms; mean 528, p80 438 |
| Keel-Pro (soup78) | dev, 1,633 rows | 62.06 | 56.63–64.13 | 321 ms |
| Jev 1.14 | DI board, full suite | 60.70 | — | DI-measured (Full score 60.24) |
| Best DI 0.4.1 board entries | DI board, full suite | 73–75 | — | e.g. karpo-decision-31B 75.05 (2026-11-21) |
| Keel-3 (`decider-3.0.0`) over HTTP | dev | 5.27 | 4.68–8.11 | 19 ms |

These are self-run numbers, not board results. Jev sits inside our CI, so read this as **on par with Jev**. The live board (0.4.1, 346 entries) ranks on private tests we have not been run on; on the public index alone, 62.73 would place about #99. Microsoft-Decision-1 is not on the Decision Index. Every run is in `artifacts/parity/pro/di-results.md`, and the visual walk-through is in [Keel-Pro](keel-pro.md).

## Vendor-reported figures

These are not our measurements. We list them so you can compare sources, not numbers.

| Model | Figure | Reported by | Source |
|---|---|---|---|
| Microsoft-Decision-1 | 83.5% mean accuracy over 36 undisclosed benchmarks (147,137 questions); calibration score 92.2; p50 85 ms, p95 125 ms | Microsoft (vendor) | [Microsoft announcement](https://commandline.microsoft.com/microsoft-decision-1-model-foundry/) |
| Jev 1.13.0 | 82.3% mean; calibration 93.7; 240 ms, on Microsoft's table | Microsoft (competitor-reported) | [Microsoft announcement](https://commandline.microsoft.com/microsoft-decision-1-model-foundry/) |
| Jev | 70–500 ms end-to-end per request | TypeSafe (vendor) | [TypeSafe blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev) |
| Microsoft-Decision-1 | Intelligence 57.2, calibration 84.4, p50 0.479 s, p95 1.518 s on a 1,500-item suite | Benchmark Heaven JevBench (third party) | [JevBench](https://benchmarkheaven.com/jev-models/microsoft-decision-1) |

Keel's 42.8% public mean and Microsoft's 83.5% are **not comparable**: different datasets, prompts and metrics, and Microsoft's set is undisclosed. We report both because the gap is real, not because the subtraction means anything.

## Head-to-head status

| | Keel (measured here) | Jev | Microsoft-Decision-1 |
|---|---|---|---|
| Held-out 100 | <!-- num:k3.h100 -->88/100<!-- /num --> (Keel-3) | not measured | not measured |
| Blind 234 | <!-- num:k3.blind -->125/234<!-- /num --> (Keel-3) | not measured | not measured |
| Public suite (18 datasets) | <!-- num:pub.k2.mean -->42.8%<!-- /num --> (Keel-2) | partial, third-party only | not measured |
| Latency | <!-- num:k3.p95.idle -->13.7–14.3 ms<!-- /num --> p95 in-process, idle CPU, no network | 70–500 ms (vendor) | 85 ms p50 (vendor) |

The comparison harness is ready: `npm run keel:compare-jev` (needs `TYPESAFE_API_KEY`) and `npm run keel:compare-msd1` (needs a Foundry endpoint and key). Neither writes a number it did not measure.

## Promotion gates

Keel-3 (`t1-r11`) was promoted under the round-2 promotion rule: no more safety misses than Keel-2, strictly more cases fully right, and in-process p95 under 20 ms. Checkpoints were chosen on dev loss and calibrated on dev data only; blind and held-out aggregates were used only to check the rule.

| Round-2 rule | Keel-2 | Keel-3 | Result |
|---|---:|---:|---|
| (a) Safety misses, blind / held-out 334 | <!-- num:k2.blind.safety -->11<!-- /num --> / <!-- num:k2.heldout.safety -->14<!-- /num --> | <!-- num:k3.blind.safety -->11<!-- /num --> / <!-- num:k3.heldout.safety -->12<!-- /num --> | Pass (blind is a tie, with no margin) |
| (b) Fully right, blind / held-out 334 | <!-- num:k2.blind -->92/234<!-- /num --> / <!-- num:k2.heldout -->151/334<!-- /num --> | <!-- num:k3.blind -->125/234<!-- /num --> / <!-- num:k3.heldout -->213/334<!-- /num --> | Pass |
| (c) In-process p95, idle CPU | <!-- num:k2.p95.idle -->13.3–14.5 ms<!-- /num --> | <!-- num:k3.p95.idle -->13.7–14.3 ms<!-- /num --> | Pass |

The original parity gates in `artifacts/parity/CONTRACT.md` are stricter, and Keel-3 does not meet all of them:

| Contract gate | Rule | Keel-3 |
|---|---|---|
| G1 | Zero safety misses on every held-out suite | **Not met**: <!-- num:k3.heldout.safety -->12<!-- /num --> misses across held-out, <!-- num:k3.blindc.safety -->12<!-- /num --> on blind-c |
| G2 | Fully right at least equal to the LLM baseline | Met on the held-out 100; **not met** on blind |
| G3 | Strictly better than Keel-2 on the blind and held-out aggregates | Met on accuracy; blind safety ties. **Not met on blind-c.** |
| G4 | In-process p95 under 20 ms | Met |
| G5 | Public benchmarks reported honestly | Done for Keel-2; Keel-3 not measured yet |
| G6 | Token savings measured | Done with the release candidate `t1-r2e`; not re-measured for `t1-r11` |