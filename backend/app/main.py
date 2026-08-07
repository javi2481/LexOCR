"""Aplicación FastAPI de LexOCR."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

# Debe configurarse antes de importar módulos que puedan cargar Paddle/PaddleX.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_PADDLEX = _BACKEND_ROOT / ".paddlex"
_PADDLEX.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("PADDLE_PDX_CACHE_HOME", str(_PADDLEX))
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .ocr import _warmup_default_engine
from .routes import register_routes


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        _warmup_default_engine()
    except Exception as exc:
        # No bloquear el arranque si el warmup falla (modelos aún no descargados, etc.)
        print(f"[warmup] skipped: {exc}")
    yield


app = FastAPI(title="LexOCR", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
register_routes(app)
