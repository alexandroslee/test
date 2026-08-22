# Tax AI ZeroGPU backend V1.5.0
# IMPORTANT: ZeroGPU requires `spaces` before torch/CUDA imports.
import spaces

import base64, io, json, os, re, time
from typing import Any

import gradio as gr
import torch
from PIL import Image
from transformers import AutoModelForMultimodalLM, AutoProcessor

BACKEND_VERSION = "1.5.0"
MODEL_ID = "google/gemma-4-E4B-it"
HF_TOKEN = os.getenv("HF_TOKEN") or None
ALLOWED_TAX_CATEGORIES = {"應稅", "零稅率", "免稅", "待確認"}

processor = AutoProcessor.from_pretrained(MODEL_ID, token=HF_TOKEN)
# Gemma 4: high visual-token budget for OCR / small printed marks.
processor.image_processor.max_soft_tokens = 1120
model = AutoModelForMultimodalLM.from_pretrained(
    MODEL_ID, token=HF_TOKEN, dtype=torch.bfloat16
)
model.to("cuda")
model.eval()

INVOICE_PROMPT = r"""
你是台灣統一發票影像辨識模型。只能依圖片上實際可見內容抽取資料，不可猜測、不可用統編檢查碼修字。

只輸出 JSON，欄位固定如下：
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
  "tax_category_source": "票面勾選|票面文字|無法辨識",
  "tax_category_evidence": "簡短描述你在票面看到的實際位置與符號",
  "confidence": 0.0到1.0
}

【台灣三聯式／手開統一發票固定版面規則】
1. 左上「買受人」區塊內，「統一編號」旁／下方 8 格 = buyer_tax_id。
2. 右下「營業人蓋用統一發票專用章」內的 8 碼統編 = seller_tax_id。
3. 不可交換 buyer_tax_id 與 seller_tax_id。
4. invoice_number 是 2 個英文字母 + 8 個數字，不可把統編當發票號碼。

【金額欄位】
5. 「銷售額」旁的金額 = sales_amount = 未稅金額。
6. 「營業稅」或「稅額」旁的金額 = tax_amount。
7. 「總計」「合計」「總額」旁的金額 = total_amount = 含稅總額。
8. 如果票面清楚印出三個數字，必須直接讀票面；不要用 5% 公式取代票面值。
9. sales_amount + tax_amount = total_amount 只能做一致性檢查，不可用來修改 OCR 數字。

【課稅別：V1.5.0 最高優先規則】
10. 必須仔細查看票面是否有「應稅」「零稅率」「免稅」三個標籤，以及其上方、下方、旁邊或底線附近的 V、✓、勾、圈選、黑點或其他明顯選取符號。
11. 課稅別的證據優先序：票面選取符號 > 明確票面文字敘述 > 金額邏輯。模型本身只負責回報票面視覺證據；不要只因為稅額 > 0 就聲稱你看到了勾選。
12. 若 V／✓／勾明確落在「應稅」欄，tax_category="應稅"，tax_category_source="票面勾選"。
13. 若明確落在「零稅率」欄，tax_category="零稅率"；若明確落在「免稅」欄，tax_category="免稅"。
14. 若三個標籤存在但符號位置看不清楚，tax_category="待確認"，不可猜測。
15. tax_category_evidence 必須描述真正看到的證據，例如：「V 位於『應稅』下方，『零稅率』『免稅』欄未見標記」。
16. 本張電子發票常見版面可能是同一列：「應稅 V　零稅率___　免稅___」。請依符號實際相對位置判斷。

【電子發票】
17. 電子發票 QR 是號碼、統編與金額的權威來源；Vision 主要用來交叉辨識票面文字與課稅別勾選。
18. 看不清楚的欄位回空字串、null 或「待確認」，不可硬猜。
19. 僅回傳 JSON，不要解釋。
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


def _clean_tax_category(v: Any) -> str:
    s = str(v or "").strip()
    if s in ALLOWED_TAX_CATEGORIES:
        return s
    aliases = {
        "taxable": "應稅", "tax": "應稅", "5%": "應稅",
        "zero-rated": "零稅率", "zero rated": "零稅率", "0%": "零稅率",
        "exempt": "免稅",
    }
    return aliases.get(s.lower(), "待確認")


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
    raw, vision_debug = _generate(image, INVOICE_PROMPT, 850)
    obj = _extract_json(raw)

    sales = _money(obj.get("sales_amount"))
    tax = _money(obj.get("tax_amount"))
    total = _money(obj.get("total_amount"))
    category = _clean_tax_category(obj.get("tax_category"))
    category_source = str(obj.get("tax_category_source") or "無法辨識").strip()
    category_evidence = str(obj.get("tax_category_evidence") or "").strip()

    warnings = []
    if sales is not None and tax is not None and total is not None and sales + tax != total:
        warnings.append(f"金額一致性警告：銷售額 {sales} + 稅額 {tax} != 總計 {total}；保留原圖辨識值，不自動改字。")
    if category in {"零稅率", "免稅"} and tax is not None and tax > 0:
        warnings.append(f"課稅別交叉檢查警告：票面 Vision 判為「{category}」，但稅額 {tax} > 0；不自動改值，請人工核對。")

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
        "backend_version": BACKEND_VERSION,
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
                "priority": ["票面勾選", "票面文字", "金額交叉驗證"],
                "allowed": ["應稅", "零稅率", "免稅", "待確認"],
                "visual_evidence_required_for_visual_claim": True,
            },
        }],
        "model": MODEL_ID,
        "checksum_used": False,
        "tax_category_supported": True,
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
        "backend_version": BACKEND_VERSION,
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
        "backend_version": BACKEND_VERSION,
        "model": MODEL_ID,
        "gpu_mode": "ZeroGPU",
        "visual_token_budget": int(processor.image_processor.max_soft_tokens),
        "tax_category_supported": True,
        "tax_category_values": ["應稅", "零稅率", "免稅", "待確認"],
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


with gr.Blocks(title="Tax AI ZeroGPU V1.5.0 — Gemma 4 E4B") as demo:
    gr.Markdown("# 🧾 Tax AI ZeroGPU V1.5.0 — Gemma 4 E4B\n台灣發票：QR 金額＋課稅別（應稅／零稅率／免稅）票面辨識。")
    with gr.Tab("整張發票"):
        img1 = gr.Image(type="pil", label="發票影像")
        out1 = gr.JSON(label="辨識結果")
        gr.Button("Gemma 4 E4B 辨識").click(ui_invoice, inputs=img1, outputs=out1)
    with gr.Tab("買受人8格"):
        img2 = gr.Image(type="pil", label="8格統編裁切")
        out2 = gr.JSON(label="辨識結果")
        gr.Button("辨識8格").click(ui_buyer, inputs=img2, outputs=out2)

    api_in = gr.Textbox(visible=False); api_out = gr.JSON(visible=False)
    gr.Button(visible=False).click(invoice_api, inputs=api_in, outputs=api_out, api_name="invoice_api")
    ban_in = gr.Textbox(visible=False); ban_out = gr.JSON(visible=False)
    gr.Button(visible=False).click(buyer_ban_api, inputs=ban_in, outputs=ban_out, api_name="buyer_ban_api")
    h_in = gr.Textbox(value="health", visible=False); h_out = gr.JSON(visible=False)
    gr.Button(visible=False).click(lambda _x: health_api(), inputs=h_in, outputs=h_out, api_name="health_api")

if __name__ == "__main__":
    demo.queue(default_concurrency_limit=1).launch(ssr_mode=False)
