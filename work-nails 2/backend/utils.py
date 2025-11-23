# backend/utils.py
from io import BytesIO
from PIL import Image


def read_image_from_bytes(data: bytes) -> Image.Image:
    return Image.open(BytesIO(data)).convert("RGB")