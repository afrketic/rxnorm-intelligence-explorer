"""
Render entrypoint for RxNorm Intelligence API.

Render runs:
    uvicorn backend.main:app --host 0.0.0.0 --port $PORT

The production FastAPI app lives in:
    backend.rxnorm_intelligence_api_v1
"""

from backend.rxnorm_intelligence_api_v1 import app