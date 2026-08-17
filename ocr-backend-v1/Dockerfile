FROM python:3.12-slim
ARG UPSTREAM_COMMIT=5ef5794c1b0c3fc640d6ac8c8d26562b6c035202
RUN apt-get update && apt-get install -y --no-install-recommends git libgl1 libglib2.0-0 libgomp1 && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
RUN git clone https://github.com/adi-gov-tw/api-ocr-2025.git upstream \
 && cd upstream \
 && git checkout ${UPSTREAM_COMMIT}
WORKDIR /srv/upstream
RUN pip install --no-cache-dir -r requirements.txt
COPY cors_main.py /srv/upstream/cors_main.py
EXPOSE 8080
CMD ["uvicorn","cors_main:app","--host","0.0.0.0","--port","8080","--workers","1"]
