# Tax AI V1.5.9 — NVIDIA Nemotron Parse 2.0 (non-nested ZeroGPU)
# r4: 8-grid buyer BAN reconstruction + buyer ROI second pass.
# IMPORTANT: import spaces before torch.
import spaces
import os, re, sys, time
from typing import Any, Dict, List, Tuple
import gradio as gr
import torch
from PIL import Image
from huggingface_hub import snapshot_download
from transformers import AutoModel, AutoProcessor, GenerationConfig

BACKEND_VERSION = "1.5.9"
RELEASE_ID = "tax-ai-1.5.9-nemotron-parse-20260831-r4"
MODEL_ID = "nvidia/NVIDIA-Nemotron-Parse-2.0"
HF_TOKEN = os.getenv("HF_TOKEN") or None
TASK_PROMPT = "</s><s><predict_bbox><predict_classes><output_markdown><predict_no_text_in_pic>"

MODEL_DIR = snapshot_download(MODEL_ID, token=HF_TOKEN)
if MODEL_DIR not in sys.path:
    sys.path.insert(0, MODEL_DIR)
from postprocessing import extract_classes_bboxes, transform_bbox_to_original, postprocess_text  # noqa:E402

processor = AutoProcessor.from_pretrained(MODEL_DIR, trust_remote_code=True, token=HF_TOKEN)
generation_config = GenerationConfig.from_pretrained(MODEL_DIR, trust_remote_code=True)
model = AutoModel.from_pretrained(
    MODEL_DIR,
    trust_remote_code=True,
    torch_dtype=torch.bfloat16,
    token=HF_TOKEN,
)
model.to("cuda")
model.eval()


def _decode(v: Any) -> Image.Image:
    if isinstance(v, Image.Image):
        return v.convert("RGB")
    if isinstance(v, dict):
        p = v.get("path") or v.get("name")
        if p:
            return Image.open(p).convert("RGB")
    if isinstance(v, str) and os.path.exists(v):
        return Image.open(v).convert("RGB")
    raise ValueError("無法讀取影像")


def _clean(v: Any) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()


def _tw_tax_text(v: Any) -> str:
    return str(v or "").replace("应", "應").replace("税", "稅")


def _digits(v: Any) -> str:
    return re.sub(r"\D", "", str(v or ""))


def _valid_ban(v: Any) -> bool:
    b = _digits(v)
    if not re.fullmatch(r"\d{8}", b):
        return False
    weights = [1, 2, 1, 2, 1, 2, 4, 1]
    total = 0
    for d, w in zip(b, weights):
        p = int(d) * w
        total += p // 10 + p % 10
    return total % 5 == 0 or (b[6] == "7" and (total + 1) % 5 == 0)


def _money(v: Any):
    s = re.sub(r"[^0-9]", "", str(v or ""))
    return int(s) if s else None


def _blocks(image: Image.Image, generated: str) -> List[Dict[str, Any]]:
    classes, bboxes, texts = extract_classes_bboxes(generated)
    out = []
    for cls, bbox, text in zip(classes, bboxes, texts):
        try:
            bb = [int(round(float(x))) for x in transform_bbox_to_original(bbox, image.width, image.height)]
        except Exception:
            continue
        try:
            txt = postprocess_text(
                text,
                cls=cls,
                table_format="markdown",
                text_format="plain",
                blank_text_in_figures=False,
            )
        except Exception:
            txt = str(text or "")
        x1, y1, x2, y2 = bb
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2
        out.append(
            {
                "class": str(cls),
                "text": _clean(txt),
                "bbox": bb,
                "cx": round(cx / max(1, image.width), 5),
                "cy": round(cy / max(1, image.height), 5),
                "w": round(max(0, x2 - x1) / max(1, image.width), 5),
                "h": round(max(0, y2 - y1) / max(1, image.height), 5),
            }
        )
    return out


def _parse_document(image: Image.Image) -> Dict[str, Any]:
    inputs = processor(
        images=[image],
        text=TASK_PROMPT,
        return_tensors="pt",
        add_special_tokens=False,
    ).to("cuda")
    with torch.inference_mode():
        outputs = model.generate(**inputs, generation_config=generation_config)
    generated = processor.batch_decode(outputs, skip_special_tokens=True)[0]
    return {
        "blocks": _blocks(image, generated),
        "raw_text": generated,
        "width": image.width,
        "height": image.height,
    }


def _near(blocks, b, r=.22):
    return " ".join(
        o["text"]
        for o in blocks
        if (o["cx"] - b["cx"]) ** 2 + (o["cy"] - b["cy"]) ** 2 <= r * r
    )


_ALLOWED_BAN_SEP = re.compile(r"^[\s|｜│¦&,，:：;；/\\\-_.．]*$")
_CJK_OR_LATIN = re.compile(r"[A-Za-z\u3400-\u9fff]")


def _ban_sequences_from_text(text: str) -> List[Dict[str, Any]]:
    """Recover 8-digit Taiwan BANs even when every digit is a separate table cell.

    Nemotron Parse may return a handwritten grid as:
      | 5 | 4 | 1 | 6 | 9 | 8 | 8 | 2 |
    rather than one contiguous 54169882 token.  We therefore join adjacent
    digit groups only when the separators are table/spacing punctuation, never
    when words occur between the groups.
    """
    t = str(text or "")
    groups = list(re.finditer(r"\d+", t))
    out: List[Dict[str, Any]] = []
    seen = set()
    for i in range(len(groups)):
        value = ""
        pieces = []
        start = groups[i].start()
        last_end = start
        for j in range(i, min(len(groups), i + 8)):
            g = groups[j]
            if j > i:
                sep = t[last_end:g.start()]
                if len(sep) > 12 or _CJK_OR_LATIN.search(sep) or not _ALLOWED_BAN_SEP.fullmatch(sep):
                    break
            value += g.group(0)
            pieces.append(g.group(0))
            last_end = g.end()
            if len(value) > 8:
                break
            if len(value) == 8:
                key = (value, start, last_end)
                if key not in seen:
                    seen.add(key)
                    ctx_start = max(0, start - 160)
                    ctx_end = min(len(t), last_end + 160)
                    layout = "continuous" if len(pieces) == 1 else ("grid" if len(pieces) >= 6 else "segmented")
                    out.append(
                        {
                            "value": value,
                            "start": start,
                            "end": last_end,
                            "layout": layout,
                            "piece_count": len(pieces),
                            "context": t[ctx_start:ctx_end],
                            "before": t[ctx_start:start],
                        }
                    )
                break
    return out


def _ban_items(blocks) -> List[Dict[str, Any]]:
    items = []
    for b in blocks:
        for c in _ban_sequences_from_text(b.get("text", "")):
            v = c["value"]
            ctx = _tw_tax_text(c["context"])
            before = _tw_tax_text(c["before"])
            valid = _valid_ban(v)
            buyer_cue = bool(re.search(r"買受人|買方|買受|客戶|抬頭", ctx))
            ban_cue = bool(re.search(r"統一編號|統編", ctx))
            seller_cue = bool(re.search(r"統一發票專用章|發票專用章|營業人|銷售人|銷售方|賣方|店章", ctx))

            bs = 0.0
            ss = 0.0
            if b.get("cy", 1) < .58:
                bs += 1.0
            if b.get("cx", 1) < .78:
                bs += 1.0
            if buyer_cue:
                bs += 6.0
            if ban_cue and not seller_cue:
                bs += 2.0
            if c["layout"] in ("grid", "segmented"):
                bs += 1.0
            if re.search(r"買受人|買方|統一編號|統編", before[-100:]):
                bs += 2.0
            if valid:
                bs += 2.0

            if seller_cue:
                ss += 7.0
            if b.get("cy", 0) > .45:
                ss += .5
            if b.get("cx", 0) > .45:
                ss += .5
            if valid:
                ss += 2.0
            if c["layout"] in ("grid", "segmented"):
                ss -= .5

            items.append(
                {
                    "value": v,
                    "block": b,
                    "layout": c["layout"],
                    "piece_count": c["piece_count"],
                    "context": ctx,
                    "valid_checksum": valid,
                    "buyer_score": round(bs, 2),
                    "seller_score": round(ss, 2),
                }
            )
    return items


def _candidate_json(x, score_key):
    return {
        "score": x[score_key],
        "value": x["value"],
        "bbox": x["block"].get("bbox"),
        "layout": x["layout"],
        "piece_count": x["piece_count"],
        "valid_checksum": x["valid_checksum"],
        "context": x["context"][:220],
    }


def _choose_bans(blocks) -> Tuple[str, str, dict]:
    items = _ban_items(blocks)
    br = sorted(items, key=lambda x: x["buyer_score"], reverse=True)
    sr = sorted(items, key=lambda x: x["seller_score"], reverse=True)

    buyer = ""
    for x in br:
        if x["valid_checksum"] and x["buyer_score"] >= 5.0:
            buyer = x["value"]
            break

    seller = ""
    for x in sr:
        if x["valid_checksum"] and x["seller_score"] >= 6.5:
            seller = x["value"]
            break

    if buyer and seller and buyer == seller:
        alt = [x for x in br if x["value"] != seller and x["valid_checksum"] and x["buyer_score"] >= 5.0]
        buyer = alt[0]["value"] if alt else ""

    return buyer, seller, {
        "buyer_candidates": [_candidate_json(x, "buyer_score") for x in br[:6]],
        "seller_candidates": [_candidate_json(x, "seller_score") for x in sr[:6]],
    }


def _buyer_roi(image: Image.Image):
    """Return a form-specific buyer region, or the whole image if it is already a wide buyer crop."""
    w, h = image.size
    aspect = w / max(1, h)
    if aspect >= 2.35:
        return image.copy(), [0, 0, w, h], "wide-input-as-buyer-roi"
    x1 = int(round(w * .03))
    y1 = int(round(h * .10))
    x2 = int(round(w * .62))
    y2 = int(round(h * .35))
    x2 = max(x1 + 16, min(w, x2))
    y2 = max(y1 + 16, min(h, y2))
    return image.crop((x1, y1, x2, y2)), [x1, y1, x2, y2], "taiwan-triplicate-buyer-roi"


def _choose_buyer_roi(blocks):
    items = [x for x in _ban_items(blocks) if x["valid_checksum"]]
    if not items:
        return "", {"resolved": False, "reason": "no-valid-8-digit-candidate", "candidates": []}
    ranked = sorted(
        items,
        key=lambda x: (x["buyer_score"] + (2.0 if x["layout"] in ("grid", "segmented") else 0.0)),
        reverse=True,
    )
    top = ranked[0]
    augmented = top["buyer_score"] + (2.0 if top["layout"] in ("grid", "segmented") else 0.0)
    unique_values = list(dict.fromkeys(x["value"] for x in ranked))
    accept = augmented >= 5.0 or len(unique_values) == 1
    return (top["value"] if accept else ""), {
        "resolved": bool(accept),
        "reason": "buyer-roi-valid-grid-or-single-candidate" if accept else "ambiguous-valid-candidates",
        "candidates": [_candidate_json(x, "buyer_score") for x in ranked[:6]],
    }


def _invoice_no(blocks):
    r = []
    for b in blocks:
        for m in re.finditer(r"(?<![A-Z0-9])([A-Z]{2})[-－]?([0-9]{8})(?!\d)", b["text"].upper().replace(" ", "")):
            r.append((5 if b["cy"] < .35 else 2, f"{m.group(1)}-{m.group(2)}"))
    return sorted(r, reverse=True)[0][1] if r else ""


def _date(blocks):
    for b in sorted(blocks, key=lambda x: x["cy"]):
        t = b["text"]
        m = re.search(r"(?:民國)?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", t)
        if m:
            return f"{int(m.group(1)) + 1911:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        m = re.search(r"(?<!\d)(\d{3})[./-](\d{1,2})[./-](\d{1,2})(?!\d)", t)
        if m:
            return f"{int(m.group(1)) + 1911:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return ""


def _labeled(full, aliases):
    lab = "|".join(map(re.escape, aliases))
    for p in [
        rf"(?:{lab})[^0-9]{{0,24}}([0-9][0-9,，]*)",
        rf"(?:{lab}).{{0,40}}?\|\s*([0-9][0-9,，]*)",
    ]:
        m = re.search(p, full, re.S)
        if m:
            return _money(m.group(1))
    return None


def _amounts(blocks):
    full = _tw_tax_text("\n".join(b["text"] for b in blocks))
    sales = _labeled(full, ["銷售額", "未稅金額", "未稅", "銷售金額"])
    tax = _labeled(full, ["營業稅額", "營業稅", "稅額"])
    total = _labeled(full, ["總計", "總額", "含稅總額", "合計"])
    coherent = sales is not None and tax is not None and total is not None and sales + tax == total
    tax5 = coherent and sales > 0 and abs(tax - round(sales * .05)) <= max(2, round(sales * .002))
    return {
        "sales_amount": sales,
        "tax_amount": tax,
        "total_amount": total,
        "coherent": coherent,
        "tax_5pct": tax5,
    }


def _taxcat(blocks, a):
    marks = []
    labels = []
    for b in blocks:
        t = _tw_tax_text(b["text"])
        for cat in ["應稅", "零稅率", "免稅"]:
            if cat in t:
                labels.append((cat, b))
                if re.search(rf"(?:{cat}).{{0,12}}[Vv✓√✔●]|[Vv✓√✔●].{{0,12}}(?:{cat})", t):
                    return {
                        "category": cat,
                        "confidence": .98,
                        "source": "visible-mark-same-block",
                        "evidence": f"{cat} 與選取標記同區塊",
                    }
        if re.fullmatch(r"[Vv✓√✔●○O]", t.strip()):
            marks.append(b)
    best = None
    for cat, label in labels:
        for mark in marks:
            d = ((mark["cx"] - label["cx"]) ** 2 + (mark["cy"] - label["cy"]) ** 2) ** .5
            if d <= .13 and (best is None or d < best[0]):
                best = (d, cat)
    if best:
        return {
            "category": best[1],
            "confidence": .95,
            "source": "visible-mark-spatial",
            "evidence": f"標記與「{best[1]}」空間距離 {best[0]:.3f}",
        }
    if a["tax_5pct"]:
        return {
            "category": "應稅",
            "confidence": .84,
            "source": "amount-cross-check",
            "evidence": "金額等式與 5% 稅額一致；未宣稱看見勾選",
        }
    return {
        "category": "待確認",
        "confidence": 0.0,
        "source": "unresolved",
        "evidence": "未找到可靠課稅別標記",
    }


def _confidence(d, a, t):
    s = .05
    s += .15 if d["invoice_number"] else 0
    s += .10 if d["invoice_date"] else 0
    s += .15 if d["seller_tax_id"] else 0
    s += .15 if d["buyer_tax_id"] else 0
    s += .25 if a["coherent"] else (.08 if any(a[k] is not None for k in ["sales_amount", "tax_amount", "total_amount"]) else 0)
    s += .15 * t["confidence"] if t["category"] != "待確認" else 0
    return round(min(.99, s), 3)


def _invoice_from_parsed(parsed):
    blocks = parsed["blocks"]
    buyer, seller, ban_evidence = _choose_bans(blocks)
    amounts = _amounts(blocks)
    tax_category = _taxcat(blocks, amounts)
    data = {
        "invoice_type": "電子發票" if any("電子發票" in b["text"] for b in blocks) else "手開/文件型發票",
        "invoice_number": _invoice_no(blocks),
        "invoice_date": _date(blocks),
        "seller_tax_id": seller,
        "buyer_tax_id": buyer,
        "sales_amount": amounts["sales_amount"],
        "tax_amount": amounts["tax_amount"],
        "total_amount": amounts["total_amount"],
        "tax_category": tax_category["category"],
        "tax_category_source": tax_category["source"],
        "tax_category_evidence": tax_category["evidence"],
    }
    evidence = {
        "ban": ban_evidence,
        "amounts": amounts,
        "tax_category": tax_category,
    }
    return data, _confidence(data, amounts, tax_category), evidence


@spaces.GPU(duration=120)
def parse_api(image_value):
    started = time.time()
    image = _decode(image_value)
    parsed = _parse_document(image)
    return {
        "backend_version": BACKEND_VERSION,
        "release_id": RELEASE_ID,
        "model": MODEL_ID,
        "prompt": TASK_PROMPT,
        **parsed,
        "block_count": len(parsed["blocks"]),
        "elapsed_ms": int((time.time() - started) * 1000),
    }


@spaces.GPU(duration=120)
def invoice_api(image_value):
    started = time.time()
    image = _decode(image_value)
    parsed = _parse_document(image)
    data, confidence, evidence = _invoice_from_parsed(parsed)

    # If the full-page parse did not resolve the buyer, perform one targeted
    # buyer-region parse inside the SAME ZeroGPU job.  This is specifically for
    # Taiwan triplicate invoices whose handwritten BAN appears as 8 boxed cells.
    if not data["buyer_tax_id"]:
        roi, roi_box, roi_mode = _buyer_roi(image)
        roi_parsed = _parse_document(roi)
        buyer, roi_evidence = _choose_buyer_roi(roi_parsed["blocks"])
        evidence["buyer_roi"] = {
            "mode": roi_mode,
            "bbox": roi_box,
            "resolved_value": buyer,
            **roi_evidence,
            "blocks": roi_parsed["blocks"],
            "raw_text": roi_parsed["raw_text"],
        }
        if buyer:
            data["buyer_tax_id"] = buyer
            evidence["ban"]["buyer_candidates"] = [
                {
                    "score": 10.0,
                    "value": buyer,
                    "bbox": roi_box,
                    "layout": "buyer-roi-grid",
                    "piece_count": 8,
                    "valid_checksum": True,
                    "context": "buyer ROI second pass",
                }
            ] + evidence["ban"].get("buyer_candidates", [])
            confidence = _confidence(data, evidence["amounts"], evidence["tax_category"])

    warnings = []
    if data["buyer_tax_id"] and data["buyer_tax_id"] == data["seller_tax_id"]:
        warnings.append("buyer/seller role conflict")
    if all(evidence["amounts"][k] is not None for k in ["sales_amount", "tax_amount", "total_amount"]) and not evidence["amounts"]["coherent"]:
        warnings.append("金額不符合：銷售額＋稅額＝總計")

    return {
        "backend_version": BACKEND_VERSION,
        "release_id": RELEASE_ID,
        "model": MODEL_ID,
        "count": 1,
        "results": [
            {
                "data": data,
                "confidence": confidence,
                "source": "nvidia-nemotron-parse-2.0-spatial-v159-r4-grid-buyer",
                "warnings": warnings,
                "evidence": evidence,
                "blocks": parsed["blocks"],
                "raw_text": parsed["raw_text"],
                "elapsed_ms": int((time.time() - started) * 1000),
            }
        ],
    }


def health_api():
    return {
        "status": "ok",
        "backend_version": BACKEND_VERSION,
        "release_id": RELEASE_ID,
        "model": MODEL_ID,
        "architecture": "document-parse -> grid/segmented BAN reconstruction -> buyer ROI fallback -> spatial-rules -> validation",
        "task_prompt": TASK_PROMPT,
        "gpu_mode": "ZeroGPU",
        "nested_gpu_calls": False,
        "tax_label_normalization": "应→應, 税→稅",
        "buyer_ban_strategy": "continuous-or-8-grid + checksum + buyer-ROI second pass",
    }


with gr.Blocks(title="Tax AI V1.5.9 — NVIDIA Nemotron Parse 2.0") as demo:
    gr.Markdown(
        "# 🧾 Tax AI V1.5.9 — NVIDIA Nemotron Parse 2.0\n"
        "主模型先解析文字＋版面＋座標，再由 Tax AI 空間規則決定欄位角色；r4 新增買受人 8 格手寫統編重組。"
    )
    with gr.Tab("發票主辨識"):
        i = gr.Image(type="pil", label="發票影像")
        o = gr.JSON(label="V1.5.9 辨識結果")
        gr.Button("Nemotron Parse 2.0 辨識", variant="primary").click(invoice_api, i, o, api_name="invoice_api")
    with gr.Tab("文件 Blocks"):
        pimg = gr.Image(type="pil", label="文件影像")
        po = gr.JSON(label="Text / Class / Bounding Boxes")
        gr.Button("解析文件").click(parse_api, pimg, po, api_name="parse_api")
    hi = gr.Textbox(value="health", visible=False)
    ho = gr.JSON(visible=False)
    gr.Button("Health", visible=False).click(lambda _x: health_api(), hi, ho, api_name="health_api")

demo.queue(default_concurrency_limit=1).launch()
