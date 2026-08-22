---
title: Tax AI ZeroGPU
emoji: 🧾
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 5.49.1
app_file: app_v150.py
pinned: false
license: mit
python_version: 3.12
hardware: zero-a10g
---

# Tax AI ZeroGPU — Gemma 4 E4B V1.5.0

Taiwan invoice Vision backend for the AI 超簡易營業稅申報系統。

## Architecture

GitHub Pages → Hugging Face ZeroGPU Space → Gemma 4 E4B

The Space exposes Gradio API endpoints:

- `/invoice_api`: full invoice extraction, including tax category
- `/buyer_ban_api`: cropped eight-cell buyer tax-ID recognition
- `/health_api`: CPU-only health/status

## V1.5.0 tax category

The invoice result includes:

- `tax_category`: `應稅 | 零稅率 | 免稅 | 待確認`
- `tax_category_source`: `票面勾選 | 票面文字 | 金額交叉驗證 | 待確認`
- `tax_category_evidence`: short evidence string

Visual marks such as `V`, `✓`, `√`, a check mark or dot aligned with the printed labels `應稅 / 零稅率 / 免稅` take priority. Amount arithmetic is only a secondary cross-check and must not pretend to be a visual checkbox read.

## Safety rules

- 三聯式左上「買受人／統一編號」8 格 = `buyer_tax_id`。
- 右下「統一發票專用章」 = `seller_tax_id`。
- Tax-ID checksum is validation only. It must never invent, rescue, substitute or mutate model-read digits.
- If a digit or tax-category mark is genuinely unreadable, return an unresolved value rather than guessing.
- Human review remains mandatory before filing.

## Runtime

- ZeroGPU flavor: `zero-a10g`.
- PyTorch is pinned to a ZeroGPU-supported release.
- `spaces` is imported before `torch`, so ZeroGPU CUDA emulation initializes correctly.
- Gemma 4 E4B is public Apache-2.0 on Hugging Face; `HF_TOKEN` is not required for model download at this time.
