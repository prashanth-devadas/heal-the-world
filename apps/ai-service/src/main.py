from fastapi import FastAPI
from .config import settings

app = FastAPI(title="CrisisVault AI Service")


@app.get("/health")
def health():
    return {"status": "ok", "threshold": settings.prediction_confidence_threshold}
