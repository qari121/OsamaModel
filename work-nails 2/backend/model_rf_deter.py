from typing import Any, Dict, List
from rfdetr import RFDETRSegPreview
from rfdetr.util.coco_classes import COCO_CLASSES
import supervision as sv
from PIL import Image
import numpy as np
import torch

# Check GPU availability
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"CUDA Version: {torch.version.cuda}")

# Load the RF-DETR model
model = RFDETRSegPreview(pretrain_weights="checkpoint_best_total.pth")
model.optimize_for_inference()

# Ensure model is on GPU if available
if torch.cuda.is_available():
    # Try to move model to GPU (RF-DETR might handle this internally, but we'll try)
    if hasattr(model, 'model') and hasattr(model.model, 'cuda'):
        model.model = model.model.cuda()
        print("Model moved to GPU")
    elif hasattr(model, 'to'):
        model = model.to('cuda')
        print("Model moved to GPU via .to()")
    print(f"GPU Memory Allocated: {torch.cuda.memory_allocated(0) / 1024**3:.2f} GB")

print("RF-DETR model loaded and optimized for inference.")

def run_inference(image: Image.Image) -> Dict[str, Any]:
    """
    Run RF-DETR inference on the input PIL image.

    Returns:
        Dictionary with:
            - width: int
            - height: int
            - nails: List[Dict] with keys 'id', 'score', 'polygon'
    """
    width, height = image.size

    # Run detection with threshold
    detections = model.predict(image, threshold=0.5)

    nails: List[Dict[str, Any]] = []

    # Convert detections to the expected format
    if detections.mask is not None:
        for idx in range(len(detections)):
            # Get the mask for this detection
            mask = detections.mask[idx]  # Binary mask
            confidence = detections.confidence[idx]

            # Convert mask to polygon
            polygon = mask_to_polygon(mask)

            if polygon:  # Only add if polygon extraction succeeded
                nails.append({
                    "id": idx,
                    "score": float(confidence),
                    "polygon": polygon,
                })

    return {
        "width": width,
        "height": height,
        "nails": nails,
    }


def mask_to_polygon(mask: np.ndarray, min_area: float = 50.0) -> List[float]:
    """
    Convert a binary mask to a flattened polygon [x1, y1, x2, y2, ...].
    Uses the largest external contour.

    Args:
        mask: Binary mask (H, W) with values 0 or 1 (or 0-255)
        min_area: Minimum contour area to consider

    Returns:
        Flattened list of polygon coordinates
    """
    import cv2

    # Ensure uint8 0/255
    m = (mask > 0).astype(np.uint8) * 255

    contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []

    # Pick largest contour
    cnt = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(cnt)
    if area < min_area:
        return []

    # Simplify contour
    epsilon = 0.01 * cv2.arcLength(cnt, True)
    approx = cv2.approxPolyDP(cnt, epsilon, True)  # (N, 1, 2)

    poly = approx.reshape(-1, 2).astype(float).tolist()
    flat = [coord for pt in poly for coord in pt]
    return flat


def annotate(image: Image.Image, detections: sv.Detections, classes: dict[int, str]) -> Image.Image:
    """
    Annotate image with detections for visualization.
    """
    color = sv.ColorPalette.from_hex([
        "#ffff00", "#ff9b00", "#ff8080", "#ff66b2", "#ff66ff", "#b266ff",
        "#14145d", "#3399ff", "#66ffff", "#33ff99", "#66ff66", "#99ff00"
    ])
    text_scale = sv.calculate_optimal_text_scale(resolution_wh=image.size)

    mask_annotator = sv.MaskAnnotator(color=color)
    polygon_annotator = sv.PolygonAnnotator(color=sv.Color.WHITE)
    label_annotator = sv.LabelAnnotator(
        color=color,
        text_color=sv.Color.BLACK,
        text_scale=text_scale,
        text_position=sv.Position.CENTER_OF_MASS
    )

    labels = [
        f"{classes.get(class_id, 'unknown')} {confidence:.2f}"
        for class_id, confidence in zip(detections.class_id, detections.confidence)
    ]

    out = image.copy()
    out = mask_annotator.annotate(out, detections)
    out = polygon_annotator.annotate(out, detections)
    out = label_annotator.annotate(out, detections, labels)
    out.thumbnail((1000, 1000))
    return out
