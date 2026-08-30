---
title: Tax AI Nemotron Parse V1.5.9
emoji: 🧾
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 5.49.1
app_file: app.py
pinned: false
python_version: 3.12
hardware: zero-a10g
---

# Tax AI V1.5.9 — NVIDIA Nemotron Parse 2.0

Taiwan invoice document-intelligence backend for AI 超簡易營業稅申報系統。

## Architecture

發票影像 → NVIDIA Nemotron Parse 2.0 → text / semantic class / bounding box → Tax AI spatial rule engine → buyer / seller / amounts / tax category → deterministic validation → human review.

主模型：`nvidia/NVIDIA-Nemotron-Parse-2.0`

Release contract:

- Backend version: `1.5.9`
- Release ID: `tax-ai-1.5.9-nemotron-parse-20260830`
- Target Space: `AlexandrosLee/tax-ai-nemotron-v159`

## API

- `/invoice_api`: Nemotron Parse 2.0 + Taiwan invoice spatial rules
- `/parse_api`: raw document blocks (text, semantic class, bounding boxes)
- `/health_api`: backend/model/release status

## Design rules

1. Model is responsible for seeing text and geometry; Tax AI rules decide field roles.
2. 三聯式上方／左上買受人區的 8 碼統編優先作為 buyer tax ID.
3. 右下統一發票專用章的 8 碼統編優先作為 seller tax ID.
4. `銷售額 + 營業稅 = 總計` must be validated before amounts are promoted.
5. 應稅 must be supported by visible tax-category evidence or a coherent 5% amount structure; visible mark evidence has priority.
6. Tax-ID checksum validates an observed value only and never repairs or invents a digit.
7. Human review remains the final authority before bookkeeping or filing.

## Nemotron Parse prompt

The backend uses NVIDIA's recommended structured-document prompt:

`</s><s><predict_bbox><predict_classes><output_markdown><predict_no_text_in_pic>`

The model repository's postprocessing helpers are used to recover semantic classes, text blocks and original-image coordinates.

## Deployment

This folder is intended to be copied into a Hugging Face Gradio Space configured with ZeroGPU (`zero-a10g`). Keep `spaces` imported before `torch`.
