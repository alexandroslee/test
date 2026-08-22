# Tax AI ZeroGPU V1.5.0 — Gemma 4 E4B + Taiwan invoice tax-category recognition
# IMPORTANT: ZeroGPU requires `spaces` before torch/CUDA imports.
import spaces

import base64
import io
import json
import os
import re
import time
from typing import Any

import gradio as gr
import torch
from PIL import Image
from transformers import AutoModelForMultimodalLM, AutoProcessor

MODEL_ID = "google/gemma-4-E4B-it"
HF_TOKEN = os.getenv("HF_TOKEN") or None

processor = AutoProcessor.from_pretrained(MODEL_ID, token=HF_TOKEN)
processor.image_processor.max_soft_tokens = 1120
model = AutoModelForMultimodalLM.from_pretrained(
    MODEL_ID,
    token=HF_TOKEN,
    dtype=torch.bfloat16,
)
model.to("cuda")
model.eval()

INVOICE_PROMPT = r"""
你是台灣統一發票影像辨識模型。只能依圖片上實際可見內容抽取資料，不可猜測、不可用統編檢查碼修字。

只輸出 JSON：
{
  "invoice_type": "電子發票|二聯式發票|三聯式發票|其他",
  "invoice_number": "AA-12345678 或空字串",
  "invoice_date": "YYYY-MM-DD 或空字串",
  "seller_tax_id": "8碼或空字串",
  "buyer_tax_id": "8碼或空字串",
  "seller_name": "字串或空字串",
  "sales_amount": 整數或 null,
  "tax_amount": 整數或 null,
  "total_amount": 整數或 null,
  "tax_category": "應稅|零稅率|免稅|待確認",
  "tax_category_source": "票面勾選|票面文字|待確認",
  "tax_category_evidence": "你在票面實際看到的簡短證據，例如：V 在應稅下方",
  "confidence": 0.0到1.0
}

【台灣三聯式／手開統一發票固定版面規則】
1. 左上「買受人」區塊內，「統一編號」旁／下方 8 格 = buyer_tax_id。
2. 右下「營業人蓋用統一發票專用章」內的 8 碼統編 = seller_tax_id。
3. 不可交換 buyer_tax_id 與 seller_tax_id。
4. invoice_number 是 2 個英文字母 + 8 個數字，不可把統編當發票號碼。

【金額欄位】
5. 看到「銷售額」：其旁邊的金額就是 sales_amount，也就是未稅金額。
6. 看到「營業稅」或「稅額」：其旁邊的金額就是 tax_amount。
7. 看到「總計」「合計」「總額」：其旁邊的金額就是 total_amount，也就是含稅總額。
8. 票面若清楚印出三個金額，必須優先讀票面，不可用公式替代。
9. sales_amount + tax_amount = total_amount 只能做一致性檢查，不能為了湊算式而改字。

【課稅別：高優先級】
10. 台灣發票常印有「應稅　零稅率　免稅」三個選項，旁邊／下方會用 V、✓、√、勾、黑點、叉號或其他明顯記號選中其中一項。
11. 必須判斷記號在三個標籤中的哪一個位置：
    - 記號對齊「應稅」 => tax_category="應稅"
    - 記號對齊「零稅率」 => tax_category="零稅率"
    - 記號對齊「免稅」 => tax_category="免稅"
12. 字母 V 在這種欄位通常是「打勾符號」，不是一般文字值；要依它與三個標籤的空間位置判斷。
13. 若票面直接印「應稅」且旁邊有 V／✓，請回 tax_category_source="票面勾選"，evidence 例如「V 在應稅下方」。
14. 若沒有明顯勾選，但票面文字明確寫出單一課稅別，可回 tax_category_source="票面文字"。
15. 如果位置模糊、同時多個選項有記號、或看不清楚，tax_category 必須回「待確認」，不可猜。
16. 稅額大於 0 可以支持「應稅」的合理性，但模型不要只靠算式取代票面勾選判讀。
17. 若某欄真的看不清楚，回空字串、null 或「待確認」。
18. 僅回傳 JSON，不要解釋。
""".strip()

BUYER_BAN_PROMPT = r"""
Look carefully at the image. It contains exactly eight adjacent cells, each with one visible decimal digit.
Read the eight digits strictly from LEFT TO RIGHT. Ignore borders/grid lines, stamps and noise.
Never use a Taiwan tax-ID checksum to guess, repair, substitute, or change a digit.
If any cell truly cannot be read, buyer_tax_id must be null.
Return ONLY JSON:
{"buyer_tax_id":"12345678" or null,"digits":["1","2","3","4","5","6","7","8"],"confidence":0.0}
""".strip()


def _decode_image(value: Any) -> Image.Image:
    if isinstance(value, Image.Image):
        return value.convert("RGB")
    if isinstance(value, str):
        raw = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
        return Image.open(io.BytesIO(base64.b64decode(raw))).convert("RGB")
    if isinstance(value, dict):
        path = value.get("path") or value.get("name")
        if path:
            return Image.open(path).convert("RGB")
    raise ValueError("無法讀取影像")


def _image_data_url(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="PNG", optimize=False)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I | re.S).strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


def _parsed_to_text(parsed: Any, fallback: str) -> str:
    if isinstance(parsed, str):
        return parsed.strip()
    if isinstance(parsed, dict):
        c = parsed.get("content")
        if isinstance(c, str):
            return c.strip()
        if isinstance(c, list):
            parts = []
            for item in c:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict) and item.get("text"):
                    parts.append(str(item["text"]))
            if parts:
                return "\n".join(parts).strip()
    return fallback.strip()


def _clean_tax_id(v: Any) -> str:
    d = re.sub(r"\D", "", str(v or ""))
    return d if len(d) == 8 else ""


def _clean_invoice_no(v: Any) -> str:
    s = str(v or "").upper().replace(" ", "")
    m = re.fullmatch(r"([A-Z]{2})-?(\d{8})", s)
    return f"{m.group(1)}-{m.group(2)}" if m else ""


def _money(v: Any):
    if v is None or v == "":
        return None
    s = re.sub(r"[^0-9.-]", "", str(v))
    try:
        return int(round(float(s)))
    except Exception:
        return None


def _normalize_tax_category(v: Any) -> str:
    s = str(v or "").strip().lower()
    if not s:
        return "待確認"
    if "零稅" in s or "zero" in s:
        return "零稅率"
    if "免稅" in s or "exempt" in s:
        return "免稅"
    if "應稅" in s or "taxable" in s:
        return "應稅"
    return "待確認"


def _normalize_tax_source(v: Any) -> str:
    s = str(v or "").strip()
    if "勾" in s or "check" in s.lower() or "mark" in s.lower():
        return "票面勾選"
    if "文字" in s or "text" in s.lower():
        return "票面文字"
    return "待確認"


def _generate(image: Image.Image, prompt: str, max_new_tokens: int):
    messages = [{"role": "user", "content": [
        {"type": "image", "url": _image_data_url(image)},
        {"type": "text", "text": prompt},
    ]}]
    inputs = processor.apply_chat_template(
        messages,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
        add_generation_prompt=True,
        enable_thinking=False,
    ).to(model.device)
    if "pixel_values" not in inputs:
        raise RuntimeError(f"Gemma 4 processor missing pixel_values; keys={list(inputs.keys())}")
    n = inputs["input_ids"].shape[-1]
    with torch.inference_mode():
        output = model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
    decoded = processor.decode(output[0][n:], skip_special_tokens=False).strip()
    try:
        parsed = processor.parse_response(decoded, prefix=inputs["input_ids"])
        final = _parsed_to_text(parsed, decoded)
    except Exception:
        final = processor.decode(output[0][n:], skip_special_tokens=True).strip()
    debug = {
        "input_keys": list(inputs.keys()),
        "pixel_values": list(inputs["pixel_values"].shape),
        "visual_token_budget": int(processor.image_processor.max_soft_tokens),
    }
    return final, debug


@spaces.GPU(duration=90)
def invoice_api(image_data: str) -> dict:
    started = time.time()
    image = _decode_image(image_data)
    raw, vision_debug = _generate(image, INVOICE_PROMPT, 800)
    obj = _extract_json(raw)

    sales = _money(obj.get("sales_amount"))
    tax = _money(obj.get("tax_amount"))
    total = _money(obj.get("total_amount"))
    category = _normalize_tax_category(obj.get("tax_category"))
    category_source = _normalize_tax_source(obj.get("tax_category_source"))
    category_evidence = str(obj.get("tax_category_evidence") or "").strip()
    warnings = []

    if sales is not None and tax is not None and total is not None and sales + tax != total:
        warnings.append(f"金額一致性警告：銷售額 {sales} + 稅額 {tax} != 總計 {total}；保留原圖辨識值，不自動改字。")

    # Secondary inference only. It never pretends to be a visual checkbox read.
    if category == "待確認" and tax is not None and tax > 0:
        category = "應稅"
        category_source = "金額交叉驗證"
        category_evidence = f"票面課稅別未可靠讀出；稅額 {tax} > 0，依一般營業稅資料交叉判斷為應稅，仍可人工核對票面。"

    if category in ("零稅率", "免稅") and tax is not None and tax > 0:
        warnings.append(f"課稅別衝突：模型讀到「{category}」，但稅額為 {tax}；請人工核對票面勾選。")

    if category == "應稅" and sales not in (None, 0) and tax is not None:
        expected = round(sales * 0.05)
        if abs(tax - expected) <= 1:
            if category_source == "待確認":
                category_source = "金額交叉驗證"
            if not category_evidence:
                category_evidence = f"稅額 {tax} 與銷售額 {sales} 的 5% 交叉檢查一致。"

    data = {
        "invoice_type": str(obj.get("invoice_type") or "其他"),
        "invoice_number": _clean_invoice_no(obj.get("invoice_number")),
        "invoice_date": str(obj.get("invoice_date") or ""),
        "seller_tax_id": _clean_tax_id(obj.get("seller_tax_id")),
        "buyer_tax_id": _clean_tax_id(obj.get("buyer_tax_id")),
        "seller_name": str(obj.get("seller_name") or ""),
        "sales_amount": sales,
        "tax_amount": tax,
        "total_amount": total,
        "tax_category": category,
        "tax_category_source": category_source,
        "tax_category_evidence": category_evidence,
    }
    try:
        confidence = max(0.0, min(1.0, float(obj.get("confidence") or 0)))
    except Exception:
        confidence = 0.0

    return {
        "count": 1,
        "results": [{
            "data": data,
            "confidence": confidence,
            "source": "hf-zerogpu-gemma4-e4b-v150",
            "raw_text": raw,
            "warnings": warnings,
            "elapsed_ms": int((time.time() - started) * 1000),
            "vision_debug": vision_debug,
            "amount_semantics": {
                "sales_amount": "票面『銷售額』＝未稅金額",
                "tax_amount": "票面『營業稅／稅額』",
                "total_amount": "票面『總計／合計／總額』＝含稅總額",
                "printed_values_preferred": True,
            },
            "tax_category_semantics": {
                "options": ["應稅", "零稅率", "免稅", "待確認"],
                "visual_mark_preferred": True,
                "amount_crosscheck_is_secondary": True,
            },
        }],
        "model": MODEL_ID,
        "version": "1.5.0",
        "checksum_used": False,
    }


@spaces.GPU(duration=60)
def buyer_ban_api(image_data: str) -> dict:
    started = time.time()
    image = _decode_image(image_data)
    raw, vision_debug = _generate(image, BUYER_BAN_PROMPT, 160)
    obj = _extract_json(raw)
    ban = _clean_tax_id(obj.get("buyer_tax_id")) if obj.get("buyer_tax_id") is not None else ""
    digits = obj.get("digits") if isinstance(obj.get("digits"), list) else (list(ban) if ban else [])
    digits = [re.sub(r"\D", "", str(x))[:1] for x in digits[:8]]
    if len(digits) != 8 or any(len(x) != 1 for x in digits):
        digits, ban = [], ""
    elif not ban:
        joined = "".join(digits)
        ban = joined if len(joined) == 8 else ""
    try:
        confidence = max(0.0, min(1.0, float(obj.get("confidence") or 0)))
    except Exception:
        confidence = 0.0
    return {
        "buyer_tax_id": ban or None,
        "digits": digits,
        "confidence": confidence,
        "model": MODEL_ID,
        "checksum_used": False,
        "raw": raw,
        "vision_debug": vision_debug,
        "elapsed_ms": int((time.time() - started) * 1000),
    }


def health_api() -> dict:
    return {
        "status": "ok",
        "backend": "huggingface-zerogpu",
        "model": MODEL_ID,
        "version": "1.5.0",
        "gpu_mode": "ZeroGPU",
        "visual_token_budget": int(processor.image_processor.max_soft_tokens),
        "tax_category": True,
        "checksum_used": False,
    }


def _to_data_url(image: Image.Image, fmt="PNG"):
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format=fmt)
    return f"data:image/{fmt.lower()};base64," + base64.b64encode(buf.getvalue()).decode()


def ui_invoice(image: Image.Image):
    return {"error": "請上傳發票"} if image is None else invoice_api(_to_data_url(image))


def ui_buyer(image: Image.Image):
    return {"error": "請上傳8格裁切影像"} if image is None else buyer_ban_api(_to_data_url(image))


with gr.Blocks(title="Tax AI ZeroGPU — Gemma 4 E4B V1.5.0") as demo:
    gr.Markdown("# 🧾 Tax AI ZeroGPU — Gemma 4 E4B V1.5.0\n新增票面課稅別辨識：應稅／零稅率／免稅。V／✓／勾的位置優先於金額推論。")
    with gr.Tab("整張發票"):
        img1 = gr.Image(type="pil", label="發票影像")
        out1 = gr.JSON(label="辨識結果")
        gr.Button("Gemma 4 E4B 辨識").click(ui_invoice, inputs=img1, outputs=out1)
    with gr.Tab("買受人8格"):
        img2 = gr.Image(type="pil", label="8格統編裁切")
        out2 = gr.JSON(label="辨識結果")
        gr.Button("辨識8格").click(ui_buyer, inputs=img2, outputs=out2)

    api_in = gr.Textbox(visible=False)
    api_out = gr.JSON(visible=False)
    gr.Button(visible=False).click(invoice_api, inputs=api_in, outputs=api_out, api_name="invoice_api")
    ban_in = gr.Textbox(visible=False)
    ban_out = gr.JSON(visible=False)
    gr.Button(visible=False).click(buyer_ban_api, inputs=ban_in, outputs=ban_out, api_name="buyer_ban_api")
    h_in = gr.Textbox(value="health", visible=False)
    h_out = gr.JSON(visible=False)
    gr.Button(visible=False).click(lambda _x: health_api(), inputs=h_in, outputs=h_out, api_name="health_api")

if __name__ == "__main__":
    demo.queue(default_concurrency_limit=1).launch(ssr_mode=False)
