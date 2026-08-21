# IMPORTANT: ZeroGPU requires `spaces` to be imported before torch/CUDA.
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

# ZeroGPU CUDA emulation is active after importing `spaces`. Hugging Face
# recommends placing the model on CUDA at module load time, even though the
# physical GPU is allocated only while an @spaces.GPU function is running.
processor = AutoProcessor.from_pretrained(MODEL_ID, token=HF_TOKEN)
model = AutoModelForMultimodalLM.from_pretrained(
    MODEL_ID,
    token=HF_TOKEN,
    dtype=torch.bfloat16,
)
model.to("cuda")
model.eval()

INVOICE_PROMPT = r"""
你是台灣統一發票影像辨識模型。請只依圖片內容抽取資料，不可猜測。

請輸出 JSON，欄位固定如下：
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
  "confidence": 0.0到1.0
}

台灣三聯式發票固定規則：
1. 左上「買受人」區塊中，「統一編號」標籤旁或下方的 8 個格子，是 buyer_tax_id。
2. 右下「營業人蓋用統一發票專用章」內的 8 碼統編，是 seller_tax_id。
3. 絕對不可把買方統編與賣方統編交換。
4. 統編檢查碼只能作驗證，不可用來猜、修、替換或反推出任何數字。
5. 若任一重要數字看不清楚，該欄回空字串或 null，不可硬猜。
6. invoice_number 必須是 2 個大寫英文字母 + 8 個數字；不要把統編誤當發票號碼。
7. 僅回傳 JSON，不要解釋。
""".strip()

BUYER_BAN_PROMPT = r"""
這是一張從台灣三聯式統一發票裁切出的「買受人統一編號 8 格」影像。
影像中從左到右正好是 8 個格子。請逐格讀取一個數字。

規則：
- 忽略格線、印刷文字、污點與紅色印章。
- 從左到右讀 8 格，一格只能有一個數字。
- 不可使用統編檢查碼猜測、修補、替換或反推任何數字。
- 只要有任何一格真的無法辨識，buyer_tax_id 必須是 null。
- 不可因為某組數字「比較像合法統編」就改字。

只輸出 JSON：
{"buyer_tax_id":"12345678"或null,"digits":["1","2","3","4","5","6","7","8"],"confidence":0.0}
""".strip()


def _decode_image(value: Any) -> Image.Image:
    if isinstance(value, Image.Image):
        return value.convert("RGB")
    if isinstance(value, str):
        if value.startswith("data:") and "," in value:
            value = value.split(",", 1)[1]
        raw = base64.b64decode(value)
        return Image.open(io.BytesIO(raw)).convert("RGB")
    if isinstance(value, dict):
        path = value.get("path") or value.get("name")
        if path:
            return Image.open(path).convert("RGB")
    raise ValueError("無法讀取影像")


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


def _clean_tax_id(v: Any) -> str:
    d = re.sub(r"\D", "", str(v or ""))
    return d if len(d) == 8 else ""


def _clean_invoice_no(v: Any) -> str:
    s = str(v or "").upper().replace(" ", "")
    m = re.fullmatch(r"([A-Z]{2})-?(\d{8})", s)
    return f"{m.group(1)}-{m.group(2)}" if m else ""


def _generate(image: Image.Image, prompt: str, max_new_tokens: int = 600) -> str:
    messages = [{
        "role": "user",
        "content": [
            {"type": "image", "image": image},
            {"type": "text", "text": prompt},
        ],
    }]
    inputs = processor.apply_chat_template(
        messages,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
        add_generation_prompt=True,
        enable_thinking=False,
    ).to(model.device)
    n = inputs["input_ids"].shape[-1]
    with torch.inference_mode():
        output = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
        )
    return processor.decode(output[0][n:], skip_special_tokens=True).strip()


@spaces.GPU(duration=60)
def invoice_api(image_data: str) -> dict:
    started = time.time()
    image = _decode_image(image_data)
    raw = _generate(image, INVOICE_PROMPT, max_new_tokens=650)
    obj = _extract_json(raw)

    data = {
        "invoice_type": str(obj.get("invoice_type") or "其他"),
        "invoice_number": _clean_invoice_no(obj.get("invoice_number")),
        "invoice_date": str(obj.get("invoice_date") or ""),
        "seller_tax_id": _clean_tax_id(obj.get("seller_tax_id")),
        "buyer_tax_id": _clean_tax_id(obj.get("buyer_tax_id")),
        "seller_name": str(obj.get("seller_name") or ""),
        "sales_amount": obj.get("sales_amount"),
        "tax_amount": obj.get("tax_amount"),
        "total_amount": obj.get("total_amount"),
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
            "source": "hf-zerogpu-gemma4-e4b",
            "raw_text": raw,
            "warnings": [],
            "elapsed_ms": int((time.time() - started) * 1000),
        }],
        "model": MODEL_ID,
        "checksum_used": False,
    }


@spaces.GPU(duration=35)
def buyer_ban_api(image_data: str) -> dict:
    started = time.time()
    image = _decode_image(image_data)
    raw = _generate(image, BUYER_BAN_PROMPT, max_new_tokens=140)
    obj = _extract_json(raw)

    ban = obj.get("buyer_tax_id")
    ban = _clean_tax_id(ban) if ban is not None else ""
    digits = obj.get("digits") if isinstance(obj.get("digits"), list) else (list(ban) if ban else [])
    digits = [re.sub(r"\D", "", str(x))[:1] for x in digits[:8]]
    if len(digits) != 8 or any(len(x) != 1 for x in digits):
        digits = []
        ban = ""
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
        "elapsed_ms": int((time.time() - started) * 1000),
    }


def health_api() -> dict:
    return {
        "status": "ok",
        "backend": "huggingface-zerogpu",
        "model": MODEL_ID,
        "gpu_mode": "ZeroGPU",
        "checksum_used": False,
    }


def ui_invoice(image: Image.Image):
    if image is None:
        return {"error": "請上傳發票"}
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="JPEG", quality=92)
    data_url = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    return invoice_api(data_url)


def ui_buyer(image: Image.Image):
    if image is None:
        return {"error": "請上傳8格裁切影像"}
    buf = io.BytesIO()
    image.convert("RGB").save(buf, format="PNG")
    data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    return buyer_ban_api(data_url)


with gr.Blocks(title="Tax AI ZeroGPU — Gemma 4 E4B") as demo:
    gr.Markdown("# 🧾 Tax AI ZeroGPU — Gemma 4 E4B\n固定雲端 GPU 後端；不需要 Colab、Tunnel 或 OpenAI API。")
    with gr.Tab("整張發票"):
        img1 = gr.Image(type="pil", label="發票影像")
        btn1 = gr.Button("Gemma 4 E4B 辨識")
        out1 = gr.JSON(label="辨識結果")
        btn1.click(ui_invoice, inputs=img1, outputs=out1)
    with gr.Tab("買受人8格"):
        img2 = gr.Image(type="pil", label="8格統編裁切")
        btn2 = gr.Button("辨識8格")
        out2 = gr.JSON(label="辨識結果")
        btn2.click(ui_buyer, inputs=img2, outputs=out2)

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
    demo.queue(default_concurrency_limit=1).launch()
