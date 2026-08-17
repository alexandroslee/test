"""VCP wrapper for adi-gov-tw/api-ocr-2025.
Adds browser CORS policy for the GitHub Pages front-end without changing upstream API routes.
"""
import os
from fastapi.middleware.cors import CORSMiddleware
from app.main import app

origins=[x.strip() for x in os.getenv('VCP_CORS_ORIGINS','https://alexandroslee.github.io').split(',') if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=['GET','POST','OPTIONS'],
    allow_headers=['Content-Type','X-API-Key'],
    expose_headers=[],
    max_age=3600,
)
