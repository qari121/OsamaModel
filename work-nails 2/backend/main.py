# backend/main.py
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from model_rf_deter import run_inference
from schemas import NailResponse, NailInstance
from utils import read_image_from_bytes

app = FastAPI(title="Virtual Nails RF-DETR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/nails/segment", response_model=NailResponse)
async def segment_nails(file: UploadFile = File(...)):
    import time
    start_time = time.time()
    
    raw = await file.read()
    read_time = time.time()
    
    img = read_image_from_bytes(raw)
    decode_time = time.time()

    result = run_inference(img)
    inference_time = time.time()
    
    total_time = time.time() - start_time
    print(f"Timing - Read: {read_time-start_time:.3f}s, Decode: {decode_time-read_time:.3f}s, Inference: {inference_time-decode_time:.3f}s, Total: {total_time:.3f}s")
    nails = [
        NailInstance(
            id=n["id"],
            score=n["score"],
            polygon=n["polygon"],
        )
        for n in result["nails"]
    ]

    return NailResponse(
        width=result["width"],
        height=result["height"],
        nails=nails,
    )


# Serve frontend static files (must be after API routes)
frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="static")