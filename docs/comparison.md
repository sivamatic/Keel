# Keel, Jev and Microsoft-Decision-1

Three models that speak the same System One wire, built for different trade-offs. This page shows where each one is the right choice, and what a million decisions costs on each.

## At a glance

| | **Keel** | **Jev** (TypeSafe) | **Microsoft-Decision-1** |
|---|---|---|---|
| Where it runs | Your CPU, in-process or on localhost | TypeSafe's hosted API | Azure AI Foundry, OpenRouter |
| Model | xtremedistil-l6-h256 NLI cross-encoder, about 13M parameters | Proprietary, size undisclosed | Post-trained Qwen3.5-9B (vendor-documented) |
| Download size | <!-- num:k3.size -->17.7 MB<!-- /num --> (Keel-3), <!-- num:k2.size -->13 MB<!-- /num --> (Keel-2) | No download | No download |
| Weights | **Open, Apache-2.0**, fine-tunable | Closed | Closed |
| Network and account | None | API key | Azure key or Entra ID |
| Privacy | Text never leaves the machine | Cloud; vendor states no training on customer data | Cloud, Azure data zones |
| Latency | <!-- num:k3.p95.idle -->13.7–14.3 ms<!-- /num --> p95 in-process on an idle CPU (Keel-3) | 70–500 ms end-to-end (vendor) | 85 ms p50, 125 ms p95 (vendor) |
| Price | $0 marginal | $0.042 per 1M input tokens, output free | $0.042 per 1M input tokens, output free |
| Context read | About 256 tokens per (state, option) pair | 64k tokens per request (vendor) | 32,768 tokens (vendor) |
| Question types | choice, score, noul | choice, score, noul, box, images | choice, score, noul |
| Languages | English | English best, others weaker (vendor) | Multilingual evaluation (vendor) |
| Accuracy on broad benchmarks | <!-- num:pub.k2.mean -->42.8%<!-- /num --> mean over 18 public datasets (measured) | not measured by us | 83.5% over 36 undisclosed benchmarks (vendor-reported) |
| Integrations | HTTP, MCP server, Jev SDK, Foundry path | HTTP, official SDKs | Foundry, OpenRouter |

Vendor figures come from the [Microsoft announcement](https://commandline.microsoft.com/microsoft-decision-1-model-foundry/), the [Microsoft Learn page](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/how-to/use-foundry-models-microsoft-decision), [TypeSafe's models page](https://docs.typesafe.ai/models) and the [TypeSafe launch post](https://typesafe.ai/blog/introducing-system-one-models-and-jev). We have not verified them.

**Keel-Pro.** If you have a GPU, Keel-Pro (model `decider-pro-1.0.0`, an open-weight Qwen3.5-27B LoRA, local sidecar) scores **62.73** on the full Decision Index public 0.3 suite (all 139,677 public requests; HLE is gated and counted as 0), and 61.96 (95% CI 58.98–64.42) on an earlier report sample. Jev 1.14 is 60.70 on the DI board, so that is on par with Jev. Microsoft-Decision-1 is not on the Decision Index, so there is no comparable number for it. On the live board (0.4.1, 346 entries), 62.73 would place about #99 on the public index; Keel-Pro has not yet been run on the board's private tests. Median latency is 245 ms on an RTX 5090 (p80 438 ms, mean 528 ms). See [Keel-Pro](keel-pro.md) and [Benchmarks](benchmarks.md#decision-index-keel-pro).

## When to choose which

**Choose Keel when:**

- the text must not leave the machine, or the machine is offline: air-gapped networks, regulated data, on-device apps, CI runners without secrets;
- the decision sits on a hot path, such as a tool-call gate or a per-message router, where 20 ms matters and 500 ms does not fit;
- you want to own the model: pin a version, fine-tune it on your own decision families, ship it inside your product;
- you want an LLM-free first pass that hands only the hard cases to an LLM. See [Token savings](token-savings.md).

**Choose a hosted 9B model (Jev or Microsoft-Decision-1) when:**

- the decision needs world knowledge or multi-step reasoning, as in exam-style questions;
- the state is long (a full contract, a long thread) and the deciding fact may be anywhere in it;
- you need images, `box` questions, or languages other than English;
- you need the best available accuracy on unfamiliar inputs and a vendor SLA, and the data can go to the cloud.

**Choose a general LLM when:**

- you need a rationale, not just a probability;
- the options are not known in advance;
- the decision is safety-critical and no Keel model is yet at zero safety misses. On our blind suite, claude-haiku-4.5 got <!-- num:llm.blind -->215/234<!-- /num --> fully right with <!-- num:llm.blind.safety -->0<!-- /num --> safety misses, against <!-- num:k3.blind -->125/234<!-- /num --> and <!-- num:k3.blind.safety -->11<!-- /num --> for the Keel-3 RC.

**Combine them.** Because all three speak the same wire, a client can ask Keel first and send low-confidence questions to Jev, Microsoft-Decision-1 or an LLM with the same request body.

<!-- diagram:keel-first -->

## Cost per 1 million decisions

### The hosted models

Jev and Microsoft-Decision-1 both list $0.042 per 1M input tokens, with output free. Cost therefore depends only on the size of the request. We assume a mean of **654 input tokens per decision**, the mean H2O measured on the third-party JevBench suite, and show 300 and 2,000 tokens for sensitivity.

```text
price per token  = $0.042 / 1,000,000 = $4.2e-8
cost per 1M      = tokens per decision × 1,000,000 × $4.2e-8

  300 tokens  →   300 × 1e6 × 4.2e-8 = $12.60
  654 tokens  →   654 × 1e6 × 4.2e-8 = $27.47
2,000 tokens  → 2,000 × 1e6 × 4.2e-8 = $84.00
```

### Keel

Keel has no per-token price. It costs CPU time you already have.

```text
CPU time  = 1,000,000 decisions × ~10 ms = 10,000 s ≈ 2.8 CPU-hours (single thread, idle-laptop p50)
power     = 2.8 h × 0.015 kW (assumed extra package power) × $0.15/kWh ≈ $0.006
rented    = 2.8 vCPU-hours × $0.05 (assumed) ≈ $0.14

at 20 ms (the loaded-box p50): 5.6 CPU-hours ≈ $0.28 rented vCPU
```

### A general LLM

For comparison, a dedicated LLM decision call on our held-out suites averaged about 248 o200k tokens of visible prompt and answer (24,830 tokens over 100 decisions). At an assumed list price of $1 per 1M input and $5 per 1M output tokens, which is roughly the small-model tier, and assuming a 230/18 input/output split, that is:

```text
input   230 × 1e6 × $1e-6 = $230
output   18 × 1e6 × $5e-6 =  $90
total ≈ $320 per 1M decisions, before hidden reasoning tokens
```

Hidden reasoning on claude-haiku-4.5 added about 367 tokens per question in our measurements, which more than doubles the output bill. Running each decision as a sub-agent in a coding harness (about 21k input tokens per call) is far more expensive again.

<!-- diagram:cost-bars -->

| Per 1M decisions | Keel | Jev | Microsoft-Decision-1 | Small LLM (assumed $1/$5) |
|---|---:|---:|---:|---:|
| Cash, 654-token decisions | ≈ $0.01–0.28 | $27.47 | $27.47 | ≈ $320 at 248 tokens |
| Serial wall time, one request in flight | ≈ 3–6 h | ≈ 19–139 h (70–500 ms) | ≈ 24 h (85 ms) | days |

The honest reading: $27 per million decisions is already cheap. Keel's real advantages are **offline operation, privacy, latency and having no account**, not the bill. And on a 2,000-token state, Keel is reading a truncated input, so it is not doing the same work as a 32k–64k model.

## Wire compatibility

| Feature | Keel | Notes |
|---|---|---|
| `POST /v1/systemone` with state and questions | Yes | At `/api/v1/systemone` |
| Foundry path `/providers/microsoft/v1/systemone` | Yes | Same handler |
| `Authorization: Bearer` and `api-key` headers | Yes | Local key, not a vendor key |
| choice, score, noul | Yes | |
| Jev-style confidence | Yes | With `jev-*` aliases |
| box questions, images | No | Returns 400 |
| Compressed request bodies | No | Use `compression=False` in Jev SDKs |
| `models.list()` in the Jev SDK | No | Keel returns an OpenAI-style list |
| Long-context header | Ignored | Keel reads about 256 tokens per pair |

## What we have not verified

- We have not run Jev or Microsoft-Decision-1 on our held-out or blind suites. The harnesses exist (`npm run keel:compare-jev`, `npm run keel:compare-msd1`) and need credentials.
- All latency and accuracy figures for Jev and Microsoft-Decision-1 on this page are vendor-reported or third-party.
- Keel is an independent project. It is not affiliated with or endorsed by TypeSafe or Microsoft. See [NOTICE](../NOTICE).
