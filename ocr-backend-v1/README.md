# V1.0 OCR Backend — api-ocr-2025 Adapter

本目錄把 `adi-gov-tw/api-ocr-2025` 納入「AI 超簡易營業稅申報 V1.0」作為 OCR Backend。

## 上游版本
- Repository: `adi-gov-tw/api-ocr-2025`
- Pinned commit: `5ef5794c1b0c3fc640d6ac8c8d26562b6c035202`
- License: MIT（上游 Copyright (c) 2025 Neova Technology Co., Ltd.）

Docker build 時 clone 上游並固定到上述 commit；本專案只增加 `cors_main.py`，讓 VCP GitHub Pages 可跨網域呼叫 `/health` 與 `/v1/invoice`。

## API Mapping
V1.0 前端呼叫：
- `GET /health`
- `POST /v1/invoice`
  - multipart `file`
  - `engine=auto|local|text|vlm`
  - `slim=false`
  - `include_image=false`

主要欄位 Mapping：
- `data.invoice_number` → 發票字軌＋號碼
- `data.invoice_date` → 日期
- `data.seller_tax_id` → 賣方統編
- `data.buyer_tax_id` → 買方統編
- `data.sales_amount` → 未稅金額
- `data.tax_amount` → 營業稅額
- `data.total_amount` → 含稅總額
- `data.seller_name` → 賣方名稱

## 啟動
```bash
cp .env.example .env
# 填好 VLM endpoint / key，或改用 local VLM
docker compose up -d --build
curl http://127.0.0.1:8080/health
```

## GitHub Pages 注意
GitHub Pages 是 HTTPS 靜態站，正式測試應提供一個 HTTPS OCR Backend URL。`cors_main.py` 預設只允許：

`https://alexandroslee.github.io`

可用 `VCP_CORS_ORIGINS` 加入其他允許來源，逗號分隔。

## 安全
- 正式環境應設定 `APIOCR_API_KEY`。
- V1.0 前端不會把 API Key 寫入 LocalStorage。
- `.env` 不可提交 Git。
- 發票影像含商業與個人資訊；若採 cloud VLM，影像會送到所設定的雲端 VLM。若要求影像不外傳，使用 upstream 的 local VLM 部署。
