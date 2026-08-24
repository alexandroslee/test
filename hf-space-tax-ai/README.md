---
title: Tax AI ZeroGPU V1.5.2
emoji: 🧾
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 5.49.1
app_file: app.py
pinned: false
license: mit
python_version: 3.12
hardware: zero-a10g
---

# Tax AI ZeroGPU — Gemma 4 E4B V1.5.2

Taiwan invoice Vision backend for the AI 超簡易營業稅申報系統。

## Architecture

GitHub Pages → Hugging Face ZeroGPU Space → Gemma 4 E4B

Release contract:

- Backend version: `1.5.2`
- Release ID: `tax-ai-1.5.2-20260822-1555`
- Space: `AlexandrosLee/tax-ai-zerogpu-v152`

The Space exposes Gradio API endpoints:

- `/invoice_api`: full invoice extraction, including tax category
- `/tax_category_api`: dedicated cropped tax-category recognition
- `/buyer_ban_api`: cropped eight-cell buyer tax-ID recognition
- `/health_api`: CPU-only health/status and release-contract verification

## V1.5.2 tax category

The invoice result includes:

- `tax_category`: `應稅 | 零稅率 | 免稅 | 待確認`
- `tax_category_source`: visual source information
- `tax_category_evidence`: short visual evidence string

Visual marks such as `V`, `✓`, `√`, a check mark or dot aligned with the printed labels `應稅 / 零稅率 / 免稅` take priority. Amount arithmetic is only a secondary cross-check and must not pretend to be a visual checkbox read.

## Safety rules

- 三聯式左上「買受人／統一編號」8 格 = `buyer_tax_id`。
- 右下「統一發票專用章」 = `seller_tax_id`。
- Tax-ID checksum is validation only. It must never invent, rescue, substitute or mutate model-read digits.
- If a digit or tax-category mark is genuinely unreadable, return an unresolved value rather than guessing.
- Human review remains mandatory before filing.

## Runtime

- ZeroGPU flavor: `zero-a10g`.
- `spaces` is imported before `torch`, so ZeroGPU CUDA emulation initializes correctly.
- Runtime entrypoint is `app.py` (V1.5.2), not the legacy `app_v150.py`.
- Gemma 4 E4B is public Apache-2.0 on Hugging Face; `HF_TOKEN` is not required for model download at this time.
