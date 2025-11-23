# backend/main.py
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import json
import time

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

# Add compression for faster response times
app.add_middleware(GZipMiddleware, minimum_size=1000)


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


@app.websocket("/ws/nails/segment")
async def websocket_segment(websocket: WebSocket):
    """
    WebSocket endpoint for real-time nail segmentation.
    Receives binary image data and sends JSON response.
    Lower latency than HTTP due to persistent connection.
    """
    await websocket.accept()
    print("WebSocket client connected")
    
    try:
        while True:
            # Receive binary image data
            image_bytes = await websocket.receive_bytes()
            start_time = time.time()
            
            # Process image
            img = read_image_from_bytes(image_bytes)
            result = run_inference(img)
            
            # Format response
            nails = [
                {
                    "id": n["id"],
                    "score": n["score"],
                    "polygon": n["polygon"],
                }
                for n in result["nails"]
            ]
            
            response = {
                "width": result["width"],
                "height": result["height"],
                "nails": nails,
            }
            
            inference_time = time.time() - start_time
            print(f"WebSocket inference: {inference_time:.3f}s")
            
            # Send JSON response
            await websocket.send_json(response)
            
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"error": str(e)})
        except:
            pass


# Serve frontend static files (must be after API routes)
frontend_path = Path(__file__).parent.parent / "frontend"
if frontend_path.exists():
    app.mount("/", StaticFiles(directory=str(frontend_path), html=True), name="static")