---
title: Tax AI Nemotron Parse V1.5.9
emoji: 🧾
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 5.49.1
app_file: app_v159.py
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
- Release ID: `tax-ai-1.5.9-nemotron-parse-20260830-r3`
- Runtime Space slot: `AlexandrosLee/tax-ai-zerogpu-v152` (existing Free-tier ZeroGPU slot reused)
- Runtime: `app_v159.py`

## API

- `/invoice_api`: one ZeroGPU job performs Nemotron Parse 2.0 + Taiwan invoice spatial rules
- `/parse_api`: one ZeroGPU job returns raw document blocks (text, semantic class, bounding boxes)
- `/health_api`: CPU-only backend/model/release status

`invoice_api` does not call another `@spaces.GPU` function. Parse + spatial reconciliation are completed inside the same allocated GPU job to avoid nested ZeroGPU queue/lease problems.

## Taiwan text normalization

Document OCR can legitimately emit compatible CJK glyph variants such as `應税√`, `应税`, `零税率`, or `免税`. V1.5.9 r3 normalizes only tax-label glyphs before rule evaluation:

- `应` → `應`
- `税` → `稅`

Observed numbers and tax IDs are never repaired or invented by this normalization.

## Design rules

1. Model is responsible for seeing text and geometry; Tax AI rules decide field roles.
2. 三聯式上方／左上買受人區的 8 碼統編優先作為 buyer tax ID.
3. 右下統一發票專用章的 8 碼統編優先作為 seller tax ID.
4. `銷售額 + 營業稅 = 總計` must be validated before amounts are promoted.
5. 應稅 must be supported by visible tax-category evidence or a coherent 5% amount structure; visible mark evidence has priority.
6. Tax-ID checksum validates an observed value only and never repairs or invents a digit.
7. Human review remains the final authority before bookkeeping or filing.

## Nemotron Parse prompt

`</s><s><predict_bbox><predict_classes><output_markdown><predict_no_text_in_pic>`

The model repository's postprocessing helpers recover semantic classes, text blocks and original-image coordinates.

## Deployment

This source is deployed into the existing ZeroGPU Space `AlexandrosLee/tax-ai-zerogpu-v152` because the Free Hugging Face account already uses its two ZeroGPU Space slots. Keep `spaces` imported before `torch`.
