"""Shim: keep `uvicorn main:app` working from backend/."""
from app.main import app

__all__ = ["app"]
