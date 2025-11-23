# backend/main.py
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware

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
    raw = await file.read()
    img = read_image_from_bytes(raw)

    result = run_inference(img)
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