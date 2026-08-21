---
title: Tax AI ZeroGPU
emoji: 🧾
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 5.49.1
app_file: app.py
pinned: false
license: mit
python_version: 3.12
---

# Tax AI ZeroGPU — Gemma 4 E4B

Taiwan invoice Vision backend for the AI 超簡易營業稅申報系統。

## Architecture

GitHub Pages → Hugging Face ZeroGPU Space → Gemma 4 E4B

The Space exposes Gradio API endpoints:

- `/invoice_api`: full invoice extraction
- `/buyer_ban_api`: cropped eight-cell buyer tax-ID recognition
- `/health_api`: CPU-only health/status

## Safety rules

- 三聯式左上「買受人／統一編號」8 格 = `buyer_tax_id`。
- 右下「統一發票專用章」 = `seller_tax_id`。
- Tax-ID checksum is validation only. It must never invent, rescue, substitute or mutate model-read digits.
- If a digit is genuinely unreadable, return `null` rather than guessing.
- Human review remains mandatory before filing.

## Hugging Face setup

Create a **Gradio Space** named `tax-ai-zerogpu`, select **ZeroGPU** in Space Settings, accept the Gemma 4 E4B model terms, and add a Space secret named `HF_TOKEN` if the gated model requires authentication.
