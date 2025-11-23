#!/bin/bash
# Start the nail AR backend server

cd "$(dirname "$0")"

echo "Starting RF-DETR Nail Segmentation Backend..."
echo "================================================"
echo ""
echo "Loading RF-DETR model..."
echo ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000
