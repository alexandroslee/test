# Tax AI V1.5.9 — NVIDIA Nemotron Parse 2.0
# IMPORTANT: ZeroGPU requires `spaces` before torch/CUDA imports.
import spaces

import io
import os
import re
import sys
import time
from typing import Any, Dict, List, Tuple

import gradio as gr
import torch
from PIL import Image
from huggingface_hub import snapshot_download
from transformers import AutoModel, AutoProcessor, AutoTokenizer, GenerationConfig

BACKEND_VERSION = "1.5.9"
RELEASE_ID = "tax-ai-1.5.9-nemotron-parse-20260830"
MODEL_ID = "nvidia/NVIDIA-Nemotron-Parse-2.0"
HF_TOKEN = os.getenv("HF_TOKEN") or None
TASK_PROMPT = "</s><s><predict_bbox><predict_classes><output_markdown><predict_no_text_in_pic>"

MODEL_DIR = snapshot_download(MODEL_ID, token=HF_TOKEN)
if MODEL_DIR not in sys.path:
    sys.path.insert(0, MODEL_DIR)
from postprocessing import extract_classes_bboxes, transform_bbox_to_original, postprocess_text  # noqa: E402

processor = AutoProcessor.from_pretrained(MODEL_DIR, trust_remote_code=True, token=HF_TOKEN)
tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, token=HF_TOKEN)
generation_config = GenerationConfig.from_pretrained(MODEL_DIR, trust_remote_code=True)
model = AutoModel.from_pretrained(
    MODEL_DIR,
    trust_remote_code=True,
    torch_dtype=torch.bfloat16,
    token=HF_TOKEN,
)
model.to("cuda")
model.eval()


def _decode_image(value: Any) -> Image.Image:
    if isinstance(value, Image.Image):
        return value.convert("RGB")
    if isinstance(value, dict):
        path = value.get("path") or value.get("name")
        if path:
            return Image.open(path).convert("RGB")
    if isinstance(value, str) and os.path.exists(value):
        return Image.open(value).convert("RGB")
    raise ValueError("無法讀取影像")


def _clean_text(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _digits(text: Any) -> str:
    return re.sub(r"\D", "", str(text or ""))


def _valid_ban(value: str) -> bool:
    b = _digits(value)
    if not re.fullmatch(r"\d{8}", b):
        return False
    weights = [1, 2, 1, 2, 1, 2, 4, 1]
    total = 0
    for d, w in zip(b, weights):
        p = int(d) * w
        total += p // 10 + p % 10
    return total % 5 == 0 or (b[6] == "7" and (total + 1) % 5 == 0)


def _money(text: Any):
    s = re.sub(r"[^0-9]", "", str(text or ""))
    if not s:
        return None
    try:
        return int(s)
    except Exception:
        return None


def _parse_blocks(image: Image.Image, generated_text: str) -> List[Dict[str, Any]]:
    classes, bboxes, texts = extract_classes_bboxes(generated_text)
    out = []
    for cls, bbox, text in zip(classes, bboxes, texts):
        try:
            bb = transform_bbox_to_original(bbox, image.width, image.height)
            bb = [int(round(float(x))) for x in bb]
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
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        out.append({
            "class": str(cls),
            "text": _clean_text(txt),
            "bbox": bb,
            "cx": round(cx / max(1, image.width), 5),
            "cy": round(cy / max(1, image.height), 5),
            "w": round(max(0, x2 - x1) / max(1, image.width), 5),
            "h": round(max(0, y2 - y1) / max(1, image.height), 5),
        })
    return out


def _nearby_text(blocks: List[Dict[str, Any]], block: Dict[str, Any], radius=0.22) -> str:
    parts = []
    for other in blocks:
        dx = other["cx"] - block["cx"]
        dy = other["cy"] - block["cy"]
        if dx * dx + dy * dy <= radius * radius:
            parts.append(other["text"])
    return " ".join(parts)


def _ban_candidates(blocks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    items = []
    for block in blocks:
        for m in re.finditer(r"(?<!\d)(\d{8})(?!\d)", block["text"].replace(" ", "")):
            value = m.group(1)
            key = (value, tuple(block["bbox"]))
            if key in seen:
                continue
            seen.add(key)
            items.append({"value": value, "block": block, "valid_checksum": _valid_ban(value)})
    return items


def _choose_bans(blocks: List[Dict[str, Any]]) -> Tuple[str, str, Dict[str, Any]]:
    candidates = _ban_candidates(blocks)
    buyer_ranked, seller_ranked = [], []
    for item in candidates:
        b = item["block"]
        context = _nearby_text(blocks, b)
        buyer_score = 0.0
        seller_score = 0.0
        if b["cy"] < 0.52:
            buyer_score += 3
        if b["cx"] < 0.70:
            buyer_score += 1
        if re.search(r"買受人|買方|統一編號", context):
            buyer_score += 5
        if b["cy"] > 0.48:
            seller_score += 2
        if b["cx"] > 0.48:
            seller_score += 2
        if re.search(r"統一發票專用章|發票專用章|營業人|銷售人|賣方", context):
            seller_score += 6
        if item["valid_checksum"]:
            buyer_score += 0.5
            seller_score += 0.5
        buyer_ranked.append((buyer_score, item["value"], b, context))
        seller_ranked.append((seller_score, item["value"], b, context))
    buyer_ranked.sort(reverse=True, key=lambda x: x[0])
    seller_ranked.sort(reverse=True, key=lambda x: x[0])
    buyer = buyer_ranked[0][1] if buyer_ranked and buyer_ranked[0][0] >= 3 else ""
    seller = seller_ranked[0][1] if seller_ranked and seller_ranked[0][0] >= 3 else ""
    if buyer and seller and buyer == seller:
        alternatives = [x for x in buyer_ranked if x[1] != seller and x[0] >= 3]
        buyer = alternatives[0][1] if alternatives else ""
    evidence = {
        "buyer_candidates": [{"score": x[0], "value": x[1], "bbox": x[2]["bbox"]} for x in buyer_ranked[:5]],
        "seller_candidates": [{"score": x[0], "value": x[1], "bbox": x[2]["bbox"]} for x in seller_ranked[:5]],
    }
    return buyer, seller, evidence


def _invoice_number(blocks: List[Dict[str, Any]]) -> str:
    ranked = []
    for b in blocks:
        t = b["text"].upper().replace(" ", "")
        for m in re.finditer(r"(?<![A-Z0-9])([A-Z]{2})[-－]?([0-9]{8})(?!\d)", t):
            score = 5 if b["cy"] < 0.35 else 2
            ranked.append((score, f"{m.group(1)}-{m.group(2)}"))
    ranked.sort(reverse=True)
    return ranked[0][1] if ranked else ""


def _invoice_date(blocks: List[Dict[str, Any]]) -> str:
    for b in sorted(blocks, key=lambda x: x["cy"]):
        t = b["text"]
        m = re.search(r"(?:民國)?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日", t)
        if m:
            y = int(m.group(1)) + 1911
            return f"{y:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        m = re.search(r"(?<!\d)(\d{3})[./-](\d{1,2})[./-](\d{1,2})(?!\d)", t)
        if m:
            return f"{int(m.group(1))+1911:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        m = re.search(r"(?<!\d)(20\d{2})[./-](\d{1,2})[./-](\d{1,2})(?!\d)", t)
        if m:
            return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return ""


def _extract_labeled_money(full_text: str, aliases: List[str]):
    label = "|".join(map(re.escape, aliases))
    patterns = [
        rf"(?:{label})[^0-9]{{0,24}}([0-9][0-9,，]*)",
        rf"(?:{label}).{{0,40}}?\|\s*([0-9][0-9,，]*)",
    ]
    for p in patterns:
        m = re.search(p, full_text, re.S)
        if m:
            return _money(m.group(1))
    return None


def _amounts(blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    full = "\n".join(b["text"] for b in blocks)
    sales = _extract_labeled_money(full, ["銷售額", "未稅金額", "未稅", "銷售金額"])
    tax = _extract_labeled_money(full, ["營業稅額", "營業稅", "稅額"])
    total = _extract_labeled_money(full, ["總計", "總額", "含稅總額", "合計"])
    coherent = sales is not None and tax is not None and total is not None and sales + tax == total
    tax_5pct = coherent and sales > 0 and abs(tax - round(sales * 0.05)) <= max(2, round(sales * 0.002))
    return {"sales_amount": sales, "tax_amount": tax, "total_amount": total, "coherent": coherent, "tax_5pct": tax_5pct}


def _tax_category(blocks: List[Dict[str, Any]], amount_info: Dict[str, Any]) -> Dict[str, Any]:
    marks = []
    labels = []
    for b in blocks:
        t = b["text"]
        for cat in ["應稅", "零稅率", "免稅"]:
            if cat in t:
                labels.append((cat, b))
                if re.search(rf"(?:{cat}).{{0,12}}[Vv✓√✔●]|[Vv✓√✔●].{{0,12}}(?:{cat})", t):
                    return {"category": cat, "confidence": 0.98, "source": "visible-mark-same-block", "evidence": f"{cat} 與選取標記同區塊：{t[:80]}"}
        if re.fullmatch(r"[Vv✓√✔●○O]", t.strip()):
            marks.append(b)
    best = None
    for cat, label in labels:
        for mark in marks:
            dx, dy = mark["cx"] - label["cx"], mark["cy"] - label["cy"]
            dist = (dx * dx + dy * dy) ** 0.5
            if dist <= 0.13 and (best is None or dist < best[0]):
                best = (dist, cat, label, mark)
    if best:
        return {"category": best[1], "confidence": 0.95, "source": "visible-mark-spatial", "evidence": f"標記與「{best[1]}」空間距離 {best[0]:.3f}"}
    if amount_info.get("tax_5pct"):
        return {"category": "應稅", "confidence": 0.84, "source": "amount-cross-check", "evidence": "銷售額＋稅額＝總計，且稅額約為未稅 5%；未宣稱看見勾選"}
    return {"category": "待確認", "confidence": 0.0, "source": "unresolved", "evidence": "未找到可靠課稅別標記"}


def _confidence(data: Dict[str, Any], amounts: Dict[str, Any], taxcat: Dict[str, Any]) -> float:
    score = 0.0
    if data.get("invoice_number"):
        score += 0.15
    if data.get("invoice_date"):
        score += 0.10
    if data.get("seller_tax_id"):
        score += 0.15
    if data.get("buyer_tax_id"):
        score += 0.15
    if amounts.get("coherent"):
        score += 0.25
    elif any(amounts.get(k) is not None for k in ["sales_amount", "tax_amount", "total_amount"]):
        score += 0.08
    if taxcat.get("category") != "待確認":
        score += 0.15 * float(taxcat.get("confidence") or 0)
    score += 0.05
    return round(min(0.99, score), 3)


@spaces.GPU(duration=120)
def parse_api(image_value: Any) -> Dict[str, Any]:
    started = time.time()
    image = _decode_image(image_value)
    inputs = processor(images=[image], text=TASK_PROMPT, return_tensors="pt", add_special_tokens=False).to("cuda")
    with torch.inference_mode():
        outputs = model.generate(**inputs, generation_config=generation_config)
    generated_text = processor.batch_decode(outputs, skip_special_tokens=True)[0]
    blocks = _parse_blocks(image, generated_text)
    return {
        "backend_version": BACKEND_VERSION,
        "release_id": RELEASE_ID,
        "model": MODEL_ID,
        "prompt": TASK_PROMPT,
        "width": image.width,
        "height": image.height,
        "blocks": blocks,
        "block_count": len(blocks),
        "raw_text": generated_text,
        "elapsed_ms": int((time.time() - started) * 1000),
    }


@spaces.GPU(duration=120)
def invoice_api(image_value: Any) -> Dict[str, Any]:
    started = time.time()
    parsed = parse_api(image_value)
    blocks = parsed["blocks"]
    buyer, seller, ban_evidence = _choose_bans(blocks)
    amounts = _amounts(blocks)
    taxcat = _tax_category(blocks, amounts)
    data = {
        "invoice_type": "手開/文件型發票" if not any("電子發票" in b["text"] for b in blocks) else "電子發票",
        "invoice_number": _invoice_number(blocks),
        "invoice_date": _invoice_date(blocks),
        "seller_tax_id": seller,
        "buyer_tax_id": buyer,
        "sales_amount": amounts["sales_amount"],
        "tax_amount": amounts["tax_amount"],
        "total_amount": amounts["total_amount"],
        "tax_category": taxcat["category"],
        "tax_category_source": taxcat["source"],
        "tax_category_evidence": taxcat["evidence"],
    }
    confidence = _confidence(data, amounts, taxcat)
    warnings = []
    if buyer and seller and buyer == seller:
        warnings.append("buyer/seller role conflict")
    if all(amounts.get(k) is not None for k in ["sales_amount", "tax_amount", "total_amount"]) and not amounts["coherent"]:
        warnings.append("金額不符合：銷售額＋稅額＝總計")
    return {
        "backend_version": BACKEND_VERSION,
        "release_id": RELEASE_ID,
        "model": MODEL_ID,
        "count": 1,
        "results": [{
            "data": data,
            "confidence": confidence,
            "source": "nvidia-nemotron-parse-2.0-spatial-v159",
            "warnings": warnings,
            "evidence": {"ban": ban_evidence, "amounts": amounts, "tax_category": taxcat},
            "blocks": blocks,
            "raw_text": parsed["raw_text"],
            "elapsed_ms": int((time.time() - started) * 1000),
        }],
    }


def health_api() -> Dict[str, Any]:
    return {
        "status": "ok",
        "backend_version": BACKEND_VERSION,
        "release_id": RELEASE_ID,
        "model": MODEL_ID,
        "architecture": "document-parse -> spatial-rules -> validation",
        "task_prompt": TASK_PROMPT,
        "gpu_mode": "ZeroGPU",
    }


with gr.Blocks(title="Tax AI V1.5.9 — NVIDIA Nemotron Parse 2.0") as demo:
    gr.Markdown("# 🧾 Tax AI V1.5.9 — NVIDIA Nemotron Parse 2.0\n文件解析主模型：文字＋座標＋結構 → Tax AI 規則引擎。")
    with gr.Tab("發票主辨識"):
        invoice_image = gr.Image(type="pil", label="發票影像")
        invoice_out = gr.JSON(label="V1.5.9 辨識結果")
        gr.Button("NVIDIA Nemotron Parse 2.0 辨識", variant="primary").click(invoice_api, invoice_image, invoice_out, api_name="invoice_api")
    with gr.Tab("文件解析 Blocks"):
        parse_image = gr.Image(type="pil", label="文件影像")
        parse_out = gr.JSON(label="Blocks / Bounding Boxes")
        gr.Button("解析文字＋版面＋座標").click(parse_api, parse_image, parse_out, api_name="parse_api")
    health_in = gr.Textbox(value="health", visible=False)
    health_out = gr.JSON(visible=False)
    gr.Button("Health", visible=False).click(lambda _x: health_api(), health_in, health_out, api_name="health_api")

demo.queue(default_concurrency_limit=1).launch()
