# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). Model ids (`decider-X.Y.Z`) track the
package major version.

## [Unreleased]

### Added
- All 139,677 Keel-Pro Decision Index 0.3 answers published as
  [neerumsr/keel-pro-di-results](https://huggingface.co/datasets/neerumsr/keel-pro-di-results) so the 62.73 can be
  re-scored independently.

### Fixed (documentation)
- Removed the claim that Keel-Pro is level with Microsoft-Decision-1. The "≈62" figure for MSD1 was our own
  extrapolation (Microsoft's reported lead over Jev 1.13, measured on Microsoft's own suite, added to Jev 1.14's
  public index); MSD1 is not on the Decision Index.
- Added live-board context everywhere Keel-Pro's score appears: the DI 0.4.1 board ranks on a private Full score,
  Keel-Pro is not submitted, 62.73 would be about #99 of 346 on the public index, and Keel-Pro was trained on train
  splits of datasets behind 24 of the 37 index benchmarks in DI's format.
- New social preview card that leads with openness instead of a ranking claim.
## [3.0.0] — 2026-11-15

First public, open-source release.

### Added
- Keel-Pro (`decider-pro-1.0.0`): an optional, open-weight Qwen3.5-27B LoRA served by a loopback sidecar
  (`serve/keel_pro_server.py`), published as [neerumsr/keel-pro](https://huggingface.co/neerumsr/keel-pro) and
  [neerumsr/keel-pro-GGUF](https://huggingface.co/neerumsr/keel-pro-GGUF).
- Hugging Face release tooling: `hf/keel-pro/upload.ps1` is now a runnable script (private-first repos, checksums,
  `v1.0.0` tags), and the GGUF repo has its own card (`hf/keel-pro/GGUF_CARD.md`) with a tested llama-server example.
- Press kit (`docs/press.md`) and a social preview card (`docs/media/keel-social-card.png`, shown as the README banner).
- Keel-Pro full public Decision Index 0.3 run: 139,677/139,677 requests answered, public index **62.73**
  (HLE gated, counted 0), latency median 245 / p80 438 / mean 528 ms on an RTX 5090
  (`artifacts/parity/pro/di-results.md`).
- Deployment: `Dockerfile` (Keel server, non-root, health check), `serve/Dockerfile` and pinned
  `serve/requirements.txt` (Keel-Pro sidecar, CUDA 12.8), `compose.yaml`, `compose.pro.yaml`,
  `deploy/kubernetes/` (Keel-Lite, and Keel + Keel-Pro in one GPU pod), and `docs/deployment.md` with
  Azure, Google Cloud and AWS recipes.
- CI: container build and decision smoke test on pull requests, GHCR publishing with SBOM and
  provenance on tags, CodeQL, Dependabot.
- `SUPPORT.md`, `GOVERNANCE.md`, `.github/CODEOWNERS`.
- Keel-3 (`decider-3.0.0`) is the default model (promoted 2026-10-30 to `models/keel-3`), with its
  training line and candidate pipeline (`models/candidates/`, `artifacts/parity/candidates.md`).
- MCP server (`mcp/keel-mcp-server.mjs`, `keel-mcp` bin) bridging any MCP client to the
  local HTTP API.
- Microsoft Foundry-style provider route (`/providers/microsoft/v1/systemone`) and
  `api-key` header auth for decision calls.
- Parity benchmark harness (`scripts/keel-parity-bench.ts`), blind held-out suite, public
  benchmark adapters and token-savings benchmark.
- Open-source scaffolding: Apache-2.0 `LICENSE` and `NOTICE`, contributing guide, code of
  conduct, security policy, issue and PR templates, CI, `CITATION.cff`, and a repeatable
  secret/PII/size audit (`scripts/oss-audit.mjs`).

### Changed
- Wire: accepts more Jev-shaped questions; Microsoft-Decision-1 model names resolve to
  Keel's neural model.
- Package renamed to `keel-decider`; Node `>=22.6` required (`--experimental-strip-types`).
- `package-lock.json` resolves from the public npm registry.

### Removed
- Hosting-platform sandbox leftovers: `startup.sh` and the `artifacts/keel-local.tar.gz`
  source snapshot.

## [2.0.0] — 2026-09-24

### Added
- Keel-2 (`decider-2.0.0`): 13M-parameter NLI cross-encoder fine-tuned from
  xtremedistil-l6-h256, int8 ONNX (~13 MB), in-process with ONNX Runtime; temperature
  calibration, abstain threshold and lexical blend in `keel.json`.
- Training pipeline (`training/keel/`), Python/TypeScript hypothesis parity fixtures,
  held-out and open eval suites, on/off and A/B reports.

## [1.2.0]

### Added
- Lexical decider (`decider-1.2.0`), the System One wire (`POST /api/v1/systemone`),
  the on/off switch and Copilot agent files.

[Unreleased]: https://github.com/sivamatic/Keel/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/sivamatic/Keel/releases/tag/v3.0.0
