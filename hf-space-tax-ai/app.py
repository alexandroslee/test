# Tax AI ZeroGPU backend V1.5.1
# IMPORTANT: ZeroGPU requires `spaces` before torch/CUDA imports.
import spaces

import base64, io, json, os, re, time
from typing import Any

import gradio as gr
import torch
from PIL import Image
from transformers import AutoModelForMultimodalLM, AutoProcessor

BACKEND_VERSION = "1.5.1"
MODEL_ID = "google/gemma-4-E4B-it"
HF_TOKEN = os.getenv("HF_TOKEN") or None
ALLOWED_TAX_CATEGORIES = {"應稅", "零稅率", "免稅", "待確認"}

processor = AutoProcessor.from_pretrained(MODEL_ID, token=HF_TOKEN)
processor.image_processor.max_soft_tokens = 1120
model = AutoModelForMultimodalLM.from_pretrained(MODEL_ID, token=HF_TOKEN, dtype=torch.bfloat16)
model.to("cuda")
model.eval()

INVOICE_PROMPT = r"""
你是台灣統一發票影像辨識模型。只能依圖片上實際可見內容抽取資料，不可猜測、不可用統編檢查碼修字。
只輸出 JSON：
{
  "invoice_type":"電子發票|二聯式發票|三聯式發票|其他",
  "invoice_number":"AA-12345678 或空字串",
  "invoice_date":"YYYY-MM-DD 或空字串",
  "seller_tax_id":"8碼或空字串",
  "buyer_tax_id":"8碼或空字串",
  "seller_name":"字串或空字串",
  "sales_amount":整數或 null,
  "tax_amount":整數或 null,
  "total_amount":整數或 null,
  "tax_category":"應稅|零稅率|免稅|待確認",
  "tax_category_source":"票面勾選|票面文字|無法辨識",
  "tax_category_evidence":"簡短視覺證據",
  "confidence":0.0到1.0
}
規則：
1. 左上買受人區的 8 格統編 = buyer_tax_id；右下發票章統編 = seller_tax_id，不可交換。
2. 「銷售額」= sales_amount=未稅；「稅額／營業稅」=tax_amount；「總計／總額／合計」=total_amount。
3. 若票面有「應稅／零稅率／免稅」三欄，仔細看 V、✓、勾、黑點等選取符號的相對位置。V 在應稅旁就回應稅；在零稅率旁回零稅率；在免稅旁回免稅；看不清楚回待確認。
4. 不可只因稅額 > 0 就宣稱看到了勾選；tax_category_evidence 必須描述真正看到的位置。
5. 看不清楚回空值或待確認，不可硬猜。
""".strip()

TAX_CATEGORY_PROMPT = r"""
這張圖是從台灣電子發票裁切出的「課稅別」小區塊。通常會同時看到：
「應稅」「零稅率」「免稅」，以及 V、✓、勾、黑點、圈選等標記。

你的唯一工作是判斷「哪一個欄位被選取」。請仔細比較標記和三個文字標籤的水平位置。

規則：
- 若 V／✓／勾清楚位於「應稅」旁或其底線位置：category="應稅"。
- 若標記位於「零稅率」旁：category="零稅率"。
- 若標記位於「免稅」旁：category="免稅"。
- 若三個標籤存在但標記不清楚：category="待確認"。
- 不得使用稅額、5% 公式或統編檢查碼猜答案；只看這張裁切圖。
- evidence 要描述實際位置，例如「V 位在應稅文字右側，零稅率與免稅欄沒有標記」。

只輸出 JSON：
{"category":"應稅|零稅率|免稅|待確認","evidence":"...","confidence":0.0}
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
    buf = io.BytesIO(); image.convert("RGB").save(buf, format="PNG", optimize=False)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _extract_json(text: str) -> dict:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I | re.S).strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m: return {}
    try: return json.loads(m.group(0))
    except Exception: return {}


def _parsed_to_text(parsed: Any, fallback: str) -> str:
    if isinstance(parsed, str): return parsed.strip()
    if isinstance(parsed, dict):
        c = parsed.get("content")
        if isinstance(c, str): return c.strip()
        if isinstance(c, list):
            parts=[]
            for item in c:
                if isinstance(item,str): parts.append(item)
                elif isinstance(item,dict) and item.get("text"): parts.append(str(item["text"]))
            if parts: return "\n".join(parts).strip()
    return fallback.strip()


def _clean_tax_id(v: Any) -> str:
    d = re.sub(r"\D", "", str(v or "")); return d if len(d)==8 else ""


def _clean_invoice_no(v: Any) -> str:
    s=str(v or "").upper().replace(" ",""); m=re.fullmatch(r"([A-Z]{2})-?(\d{8})",s)
    return f"{m.group(1)}-{m.group(2)}" if m else ""


def _money(v: Any):
    if v is None or v=="": return None
    s=re.sub(r"[^0-9.-]","",str(v))
    try: return int(round(float(s)))
    except Exception: return None


def _clean_tax_category(v: Any) -> str:
    s=str(v or "").strip()
    if s in ALLOWED_TAX_CATEGORIES: return s
    aliases={"taxable":"應稅","tax":"應稅","5%":"應稅","zero-rated":"零稅率","zero rated":"零稅率","0%":"零稅率","exempt":"免稅"}
    return aliases.get(s.lower(),"待確認")


def _generate(image: Image.Image, prompt: str, max_new_tokens: int):
    messages=[{"role":"user","content":[{"type":"image","url":_image_data_url(image)},{"type":"text","text":prompt}]}]
    inputs=processor.apply_chat_template(messages,tokenize=True,return_dict=True,return_tensors="pt",add_generation_prompt=True,enable_thinking=False).to(model.device)
    if "pixel_values" not in inputs: raise RuntimeError(f"Gemma 4 processor missing pixel_values; keys={list(inputs.keys())}")
    n=inputs["input_ids"].shape[-1]
    with torch.inference_mode(): output=model.generate(**inputs,max_new_tokens=max_new_tokens,do_sample=False)
    decoded=processor.decode(output[0][n:],skip_special_tokens=False).strip()
    try: final=_parsed_to_text(processor.parse_response(decoded,prefix=inputs["input_ids"]),decoded)
    except Exception: final=processor.decode(output[0][n:],skip_special_tokens=True).strip()
    debug={"input_keys":list(inputs.keys()),"pixel_values":list(inputs["pixel_values"].shape),"visual_token_budget":int(processor.image_processor.max_soft_tokens)}
    return final,debug


@spaces.GPU(duration=90)
def invoice_api(image_data: str) -> dict:
    started=time.time(); image=_decode_image(image_data); raw,vision_debug=_generate(image,INVOICE_PROMPT,850); obj=_extract_json(raw)
    sales=_money(obj.get("sales_amount")); tax=_money(obj.get("tax_amount")); total=_money(obj.get("total_amount")); category=_clean_tax_category(obj.get("tax_category"))
    category_source=str(obj.get("tax_category_source") or "無法辨識").strip(); category_evidence=str(obj.get("tax_category_evidence") or "").strip(); warnings=[]
    if sales is not None and tax is not None and total is not None and sales+tax!=total: warnings.append(f"金額一致性警告：銷售額 {sales} + 稅額 {tax} != 總計 {total}；保留辨識值。")
    if category in {"零稅率","免稅"} and tax is not None and tax>0: warnings.append(f"課稅別警告：Vision 判為 {category}，但稅額 {tax}>0；請人工核對。")
    data={"invoice_type":str(obj.get("invoice_type") or "其他"),"invoice_number":_clean_invoice_no(obj.get("invoice_number")),"invoice_date":str(obj.get("invoice_date") or ""),"seller_tax_id":_clean_tax_id(obj.get("seller_tax_id")),"buyer_tax_id":_clean_tax_id(obj.get("buyer_tax_id")),"seller_name":str(obj.get("seller_name") or ""),"sales_amount":sales,"tax_amount":tax,"total_amount":total,"tax_category":category,"tax_category_source":category_source,"tax_category_evidence":category_evidence}
    try: confidence=max(0.0,min(1.0,float(obj.get("confidence") or 0)))
    except Exception: confidence=0.0
    return {"backend_version":BACKEND_VERSION,"count":1,"results":[{"data":data,"confidence":confidence,"source":"hf-zerogpu-gemma4-e4b-v151","raw_text":raw,"warnings":warnings,"elapsed_ms":int((time.time()-started)*1000),"vision_debug":vision_debug}],"model":MODEL_ID,"checksum_used":False,"tax_category_supported":True,"dedicated_tax_category_api":True}


@spaces.GPU(duration=35)
def tax_category_api(image_data: str) -> dict:
    started=time.time(); image=_decode_image(image_data); raw,vision_debug=_generate(image,TAX_CATEGORY_PROMPT,180); obj=_extract_json(raw)
    category=_clean_tax_category(obj.get("category")); evidence=str(obj.get("evidence") or "").strip()
    try: confidence=max(0.0,min(1.0,float(obj.get("confidence") or 0)))
    except Exception: confidence=0.0
    return {"backend_version":BACKEND_VERSION,"category":category,"evidence":evidence,"confidence":confidence,"source":"Gemma 4 E4B：課稅別專用裁切辨識","raw":raw,"vision_debug":vision_debug,"elapsed_ms":int((time.time()-started)*1000)}


@spaces.GPU(duration=60)
def buyer_ban_api(image_data: str) -> dict:
    started=time.time(); image=_decode_image(image_data); raw,vision_debug=_generate(image,BUYER_BAN_PROMPT,160); obj=_extract_json(raw)
    ban=_clean_tax_id(obj.get("buyer_tax_id")) if obj.get("buyer_tax_id") is not None else ""; digits=obj.get("digits") if isinstance(obj.get("digits"),list) else (list(ban) if ban else [])
    digits=[re.sub(r"\D","",str(x))[:1] for x in digits[:8]]
    if len(digits)!=8 or any(len(x)!=1 for x in digits): digits,ban=[],""
    elif not ban:
        joined="".join(digits); ban=joined if len(joined)==8 else ""
    try: confidence=max(0.0,min(1.0,float(obj.get("confidence") or 0)))
    except Exception: confidence=0.0
    return {"backend_version":BACKEND_VERSION,"buyer_tax_id":ban or None,"digits":digits,"confidence":confidence,"model":MODEL_ID,"checksum_used":False,"raw":raw,"vision_debug":vision_debug,"elapsed_ms":int((time.time()-started)*1000)}


def health_api() -> dict:
    return {"status":"ok","backend":"huggingface-zerogpu","backend_version":BACKEND_VERSION,"model":MODEL_ID,"gpu_mode":"ZeroGPU","visual_token_budget":int(processor.image_processor.max_soft_tokens),"tax_category_supported":True,"dedicated_tax_category_api":True,"tax_category_values":["應稅","零稅率","免稅","待確認"],"checksum_used":False}


def _to_data_url(image: Image.Image, fmt="PNG"):
    buf=io.BytesIO(); image.convert("RGB").save(buf,format=fmt); return f"data:image/{fmt.lower()};base64,"+base64.b64encode(buf.getvalue()).decode()

def ui_invoice(image: Image.Image): return {"error":"請上傳發票"} if image is None else invoice_api(_to_data_url(image))
def ui_tax_category(image: Image.Image): return {"error":"請上傳課稅別裁切"} if image is None else tax_category_api(_to_data_url(image))
def ui_buyer(image: Image.Image): return {"error":"請上傳8格裁切影像"} if image is None else buyer_ban_api(_to_data_url(image))

with gr.Blocks(title="Tax AI ZeroGPU V1.5.1 — Gemma 4 E4B") as demo:
    gr.Markdown("# 🧾 Tax AI ZeroGPU V1.5.1 — Gemma 4 E4B\n電子發票 QR＋課稅別專用裁切辨識。")
    with gr.Tab("整張發票"):
        img1=gr.Image(type="pil",label="發票影像"); out1=gr.JSON(label="辨識結果"); gr.Button("Gemma 4 E4B 辨識").click(ui_invoice,inputs=img1,outputs=out1)
    with gr.Tab("課稅別"):
        img3=gr.Image(type="pil",label="應稅／零稅率／免稅裁切"); out3=gr.JSON(label="課稅別結果"); gr.Button("辨識課稅別").click(ui_tax_category,inputs=img3,outputs=out3)
    with gr.Tab("買受人8格"):
        img2=gr.Image(type="pil",label="8格統編裁切"); out2=gr.JSON(label="辨識結果"); gr.Button("辨識8格").click(ui_buyer,inputs=img2,outputs=out2)
    api_in=gr.Textbox(visible=False); api_out=gr.JSON(visible=False); gr.Button(visible=False).click(invoice_api,inputs=api_in,outputs=api_out,api_name="invoice_api")
    cat_in=gr.Textbox(visible=False); cat_out=gr.JSON(visible=False); gr.Button(visible=False).click(tax_category_api,inputs=cat_in,outputs=cat_out,api_name="tax_category_api")
    ban_in=gr.Textbox(visible=False); ban_out=gr.JSON(visible=False); gr.Button(visible=False).click(buyer_ban_api,inputs=ban_in,outputs=ban_out,api_name="buyer_ban_api")
    h_in=gr.Textbox(value="health",visible=False); h_out=gr.JSON(visible=False); gr.Button(visible=False).click(lambda _x: health_api(),inputs=h_in,outputs=h_out,api_name="health_api")

if __name__=="__main__": demo.queue(default_concurrency_limit=1).launch(ssr_mode=False)
