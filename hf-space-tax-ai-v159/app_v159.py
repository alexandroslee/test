# Tax AI V1.5.9 — NVIDIA Nemotron Parse 2.0 (non-nested ZeroGPU)
# IMPORTANT: import spaces before torch.
import spaces
import os, re, sys, time
from typing import Any, Dict, List, Tuple
import gradio as gr
import torch
from PIL import Image
from huggingface_hub import snapshot_download
from transformers import AutoModel, AutoProcessor, AutoTokenizer, GenerationConfig

BACKEND_VERSION="1.5.9"
RELEASE_ID="tax-ai-1.5.9-nemotron-parse-20260830-r2"
MODEL_ID="nvidia/NVIDIA-Nemotron-Parse-2.0"
HF_TOKEN=os.getenv("HF_TOKEN") or None
TASK_PROMPT="</s><s><predict_bbox><predict_classes><output_markdown><predict_no_text_in_pic>"

MODEL_DIR=snapshot_download(MODEL_ID,token=HF_TOKEN)
if MODEL_DIR not in sys.path: sys.path.insert(0,MODEL_DIR)
from postprocessing import extract_classes_bboxes,transform_bbox_to_original,postprocess_text  # noqa:E402
processor=AutoProcessor.from_pretrained(MODEL_DIR,trust_remote_code=True,token=HF_TOKEN)
tokenizer=AutoTokenizer.from_pretrained(MODEL_DIR,token=HF_TOKEN)
generation_config=GenerationConfig.from_pretrained(MODEL_DIR,trust_remote_code=True)
model=AutoModel.from_pretrained(MODEL_DIR,trust_remote_code=True,torch_dtype=torch.bfloat16,token=HF_TOKEN)
model.to("cuda"); model.eval()

def _decode(v:Any)->Image.Image:
    if isinstance(v,Image.Image): return v.convert("RGB")
    if isinstance(v,dict):
        p=v.get("path") or v.get("name")
        if p:return Image.open(p).convert("RGB")
    if isinstance(v,str) and os.path.exists(v):return Image.open(v).convert("RGB")
    raise ValueError("無法讀取影像")
def _clean(v):return re.sub(r"\s+"," ",str(v or "")).strip()
def _digits(v):return re.sub(r"\D","",str(v or ""))
def _valid_ban(v):
    b=_digits(v)
    if not re.fullmatch(r"\d{8}",b):return False
    w=[1,2,1,2,1,2,4,1];s=0
    for d,x in zip(b,w):p=int(d)*x;s+=p//10+p%10
    return s%5==0 or (b[6]=="7" and (s+1)%5==0)
def _money(v):
    s=re.sub(r"[^0-9]","",str(v or ""));return int(s) if s else None

def _blocks(image:Image.Image,generated:str)->List[Dict[str,Any]]:
    classes,bboxes,texts=extract_classes_bboxes(generated);out=[]
    for cls,bbox,text in zip(classes,bboxes,texts):
        try:bb=[int(round(float(x))) for x in transform_bbox_to_original(bbox,image.width,image.height)]
        except Exception:continue
        try:txt=postprocess_text(text,cls=cls,table_format="markdown",text_format="plain",blank_text_in_figures=False)
        except Exception:txt=str(text or "")
        x1,y1,x2,y2=bb;cx=(x1+x2)/2;cy=(y1+y2)/2
        out.append({"class":str(cls),"text":_clean(txt),"bbox":bb,"cx":round(cx/max(1,image.width),5),"cy":round(cy/max(1,image.height),5),"w":round(max(0,x2-x1)/max(1,image.width),5),"h":round(max(0,y2-y1)/max(1,image.height),5)})
    return out

def _parse_document(image:Image.Image)->Dict[str,Any]:
    inputs=processor(images=[image],text=TASK_PROMPT,return_tensors="pt",add_special_tokens=False).to("cuda")
    with torch.inference_mode():outputs=model.generate(**inputs,generation_config=generation_config)
    generated=processor.batch_decode(outputs,skip_special_tokens=True)[0]
    return {"blocks":_blocks(image,generated),"raw_text":generated,"width":image.width,"height":image.height}

def _near(blocks,b,r=.22):
    return " ".join(o["text"] for o in blocks if (o["cx"]-b["cx"])**2+(o["cy"]-b["cy"])**2<=r*r)
def _choose_bans(blocks)->Tuple[str,str,dict]:
    items=[]
    for b in blocks:
        for m in re.finditer(r"(?<!\d)(\d{8})(?!\d)",b["text"].replace(" ","")):
            v=m.group(1);ctx=_near(blocks,b);bs=0.;ss=0.
            if b["cy"]<.52:bs+=3
            if b["cx"]<.70:bs+=1
            if re.search(r"買受人|買方|統一編號",ctx):bs+=5
            if b["cy"]>.48:ss+=2
            if b["cx"]>.48:ss+=2
            if re.search(r"統一發票專用章|發票專用章|營業人|銷售人|賣方",ctx):ss+=6
            if _valid_ban(v):bs+=.5;ss+=.5
            items.append((v,b,bs,ss))
    br=sorted(items,key=lambda x:x[2],reverse=True);sr=sorted(items,key=lambda x:x[3],reverse=True)
    buyer=br[0][0] if br and br[0][2]>=3 else "";seller=sr[0][0] if sr and sr[0][3]>=3 else ""
    if buyer and seller and buyer==seller:
        alt=[x for x in br if x[0]!=seller and x[2]>=3];buyer=alt[0][0] if alt else ""
    return buyer,seller,{"buyer_candidates":[{"score":x[2],"value":x[0],"bbox":x[1]["bbox"]} for x in br[:5]],"seller_candidates":[{"score":x[3],"value":x[0],"bbox":x[1]["bbox"]} for x in sr[:5]]}
def _invoice_no(blocks):
    r=[]
    for b in blocks:
        for m in re.finditer(r"(?<![A-Z0-9])([A-Z]{2})[-－]?([0-9]{8})(?!\d)",b["text"].upper().replace(" ","")):r.append((5 if b["cy"]<.35 else 2,f"{m.group(1)}-{m.group(2)}"))
    return sorted(r,reverse=True)[0][1] if r else ""
def _date(blocks):
    for b in sorted(blocks,key=lambda x:x["cy"]):
        t=b["text"];m=re.search(r"(?:民國)?\s*(\d{2,3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",t)
        if m:return f"{int(m.group(1))+1911:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
        m=re.search(r"(?<!\d)(\d{3})[./-](\d{1,2})[./-](\d{1,2})(?!\d)",t)
        if m:return f"{int(m.group(1))+1911:04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return ""
def _labeled(full,aliases):
    lab="|".join(map(re.escape,aliases))
    for p in [rf"(?:{lab})[^0-9]{{0,24}}([0-9][0-9,，]*)",rf"(?:{lab}).{{0,40}}?\|\s*([0-9][0-9,，]*)"]:
        m=re.search(p,full,re.S)
        if m:return _money(m.group(1))
    return None
def _amounts(blocks):
    full="\n".join(b["text"] for b in blocks);sales=_labeled(full,["銷售額","未稅金額","未稅","銷售金額"]);tax=_labeled(full,["營業稅額","營業稅","稅額"]);total=_labeled(full,["總計","總額","含稅總額","合計"])
    coherent=sales is not None and tax is not None and total is not None and sales+tax==total;tax5=coherent and sales>0 and abs(tax-round(sales*.05))<=max(2,round(sales*.002))
    return {"sales_amount":sales,"tax_amount":tax,"total_amount":total,"coherent":coherent,"tax_5pct":tax5}
def _taxcat(blocks,a):
    marks=[];labels=[]
    for b in blocks:
        t=b["text"]
        for cat in ["應稅","零稅率","免稅"]:
            if cat in t:
                labels.append((cat,b))
                if re.search(rf"(?:{cat}).{{0,12}}[Vv✓√✔●]|[Vv✓√✔●].{{0,12}}(?:{cat})",t):return {"category":cat,"confidence":.98,"source":"visible-mark-same-block","evidence":f"{cat} 與選取標記同區塊"}
        if re.fullmatch(r"[Vv✓√✔●○O]",t.strip()):marks.append(b)
    best=None
    for cat,l in labels:
        for m in marks:
            d=((m["cx"]-l["cx"])**2+(m["cy"]-l["cy"])**2)**.5
            if d<=.13 and (best is None or d<best[0]):best=(d,cat)
    if best:return {"category":best[1],"confidence":.95,"source":"visible-mark-spatial","evidence":f"標記與「{best[1]}」空間距離 {best[0]:.3f}"}
    if a["tax_5pct"]:return {"category":"應稅","confidence":.84,"source":"amount-cross-check","evidence":"金額等式與 5% 稅額一致；未宣稱看見勾選"}
    return {"category":"待確認","confidence":0.,"source":"unresolved","evidence":"未找到可靠課稅別標記"}
def _confidence(d,a,t):
    s=.05;s+=.15 if d["invoice_number"] else 0;s+=.10 if d["invoice_date"] else 0;s+=.15 if d["seller_tax_id"] else 0;s+=.15 if d["buyer_tax_id"] else 0;s+=.25 if a["coherent"] else (.08 if any(a[k] is not None for k in ["sales_amount","tax_amount","total_amount"]) else 0);s+=.15*t["confidence"] if t["category"]!="待確認" else 0
    return round(min(.99,s),3)

def _invoice_from_parsed(parsed):
    blocks=parsed["blocks"];buyer,seller,be=_choose_bans(blocks);a=_amounts(blocks);tc=_taxcat(blocks,a)
    d={"invoice_type":"電子發票" if any("電子發票" in b["text"] for b in blocks) else "手開/文件型發票","invoice_number":_invoice_no(blocks),"invoice_date":_date(blocks),"seller_tax_id":seller,"buyer_tax_id":buyer,"sales_amount":a["sales_amount"],"tax_amount":a["tax_amount"],"total_amount":a["total_amount"],"tax_category":tc["category"],"tax_category_source":tc["source"],"tax_category_evidence":tc["evidence"]}
    return d,_confidence(d,a,tc),{"ban":be,"amounts":a,"tax_category":tc}

@spaces.GPU(duration=120)
def parse_api(image_value):
    started=time.time();image=_decode(image_value);p=_parse_document(image)
    return {"backend_version":BACKEND_VERSION,"release_id":RELEASE_ID,"model":MODEL_ID,"prompt":TASK_PROMPT,**p,"block_count":len(p["blocks"]),"elapsed_ms":int((time.time()-started)*1000)}
@spaces.GPU(duration=120)
def invoice_api(image_value):
    started=time.time();image=_decode(image_value);p=_parse_document(image);d,c,e=_invoice_from_parsed(p);warnings=[]
    if d["buyer_tax_id"] and d["buyer_tax_id"]==d["seller_tax_id"]:warnings.append("buyer/seller role conflict")
    if all(e["amounts"][k] is not None for k in ["sales_amount","tax_amount","total_amount"]) and not e["amounts"]["coherent"]:warnings.append("金額不符合：銷售額＋稅額＝總計")
    return {"backend_version":BACKEND_VERSION,"release_id":RELEASE_ID,"model":MODEL_ID,"count":1,"results":[{"data":d,"confidence":c,"source":"nvidia-nemotron-parse-2.0-spatial-v159-r2","warnings":warnings,"evidence":e,"blocks":p["blocks"],"raw_text":p["raw_text"],"elapsed_ms":int((time.time()-started)*1000)}]}
def health_api():return {"status":"ok","backend_version":BACKEND_VERSION,"release_id":RELEASE_ID,"model":MODEL_ID,"architecture":"document-parse -> spatial-rules -> validation","task_prompt":TASK_PROMPT,"gpu_mode":"ZeroGPU","nested_gpu_calls":False}

with gr.Blocks(title="Tax AI V1.5.9 — NVIDIA Nemotron Parse 2.0") as demo:
    gr.Markdown("# 🧾 Tax AI V1.5.9 — NVIDIA Nemotron Parse 2.0\n主模型先解析文字＋版面＋座標，再由 Tax AI 空間規則決定欄位角色。")
    with gr.Tab("發票主辨識"):
        i=gr.Image(type="pil",label="發票影像");o=gr.JSON(label="V1.5.9 辨識結果");gr.Button("Nemotron Parse 2.0 辨識",variant="primary").click(invoice_api,i,o,api_name="invoice_api")
    with gr.Tab("文件 Blocks"):
        pimg=gr.Image(type="pil",label="文件影像");po=gr.JSON(label="Text / Class / Bounding Boxes");gr.Button("解析文件").click(parse_api,pimg,po,api_name="parse_api")
    hi=gr.Textbox(value="health",visible=False);ho=gr.JSON(visible=False);gr.Button("Health",visible=False).click(lambda _x:health_api(),hi,ho,api_name="health_api")
demo.queue(default_concurrency_limit=1).launch()
