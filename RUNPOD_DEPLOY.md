# RunPod Deployment Guide

This guide explains how to deploy the Nail AR application to RunPod.

## Prerequisites

1. A RunPod account
2. Docker installed locally (for testing)
3. The model checkpoint file: `checkpoint_best_total.pth` (should be in `work-nails 2/backend/`)

## Changes Made for RunPod

1. **Dockerfile**: Created a Dockerfile with CUDA support for GPU acceleration
2. **FastAPI Static Files**: Updated `main.py` to serve the frontend from FastAPI
3. **Relative URLs**: Changed all frontend API calls from `localhost:8000` to relative paths
4. **Port Configuration**: Backend runs on port 8000 (exposed in Dockerfile)

## Deploying to RunPod (Easiest Method)

**No manual cloning needed!** RunPod can automatically pull from GitHub and build your Docker image.

### Step-by-Step:

1. **Push your code to GitHub** (if not already there):
   ```bash
   git add .
   git commit -m "Add RunPod deployment files"
   git push origin main
   ```

2. **Go to RunPod Dashboard** → Create a new Pod

3. **Select "Docker" as your template**

4. **Configure the Pod**:
   - **Container Image**: Leave empty (we'll build from GitHub)
   - **OR use "Build from GitHub" option**:
     - **GitHub Repository**: `your-username/OsamaModel` (or your repo name)
     - **Dockerfile Path**: `Dockerfile` (in root directory)
     - **Branch**: `main` (or your default branch)
   
5. **Pod Settings**:
   - **GPU Type**: Select a GPU (e.g., RTX 3090, A100) - recommended for model inference
   - **Container Disk**: At least 20GB (for model and dependencies)
   - **Port**: Expose port `8000`

6. **Startup Command** (usually auto-filled from Dockerfile):
   ```
   uvicorn main:app --host 0.0.0.0 --port 8000
   ```
   (Already set in Dockerfile CMD, so you can leave this empty)

7. **Access the Application**:
   - Once the pod is running, RunPod will provide a public URL
   - Access the app at: `https://your-pod-id.runpod.net`
   - The frontend will be served at the root URL
   - API docs available at: `https://your-pod-id.runpod.net/docs`

## Testing Locally

Before deploying to RunPod, test the Docker image locally:

```bash
# Build
docker build -t nail-ar:test .

# Run (with GPU support if available)
docker run --gpus all -p 8000:8000 nail-ar:test

# Or without GPU (will be slower)
docker run -p 8000:8000 nail-ar:test
```

Then access at `http://localhost:8000`

## Alternative: Build Locally and Push to Docker Hub

If RunPod's GitHub integration doesn't work for you:

```bash
# Build the image
docker build -t your-dockerhub-username/nail-ar:latest .

# Push to Docker Hub
docker push your-dockerhub-username/nail-ar:latest
```

Then in RunPod, just use: `your-dockerhub-username/nail-ar:latest` as the container image.

## Important Notes

1. **Model Checkpoint**: Make sure `checkpoint_best_total.pth` is included in the backend directory. It will be copied into the Docker image.

2. **GPU Requirements**: The model uses PyTorch with CUDA. For best performance, use a GPU-enabled RunPod instance.

3. **Memory**: The model may require significant GPU memory. Monitor usage in RunPod dashboard.

4. **CORS**: Currently set to allow all origins (`*`). For production, consider restricting this.

5. **HTTPS**: RunPod provides HTTPS by default, which is required for camera access in browsers.

## Troubleshooting

- **Model not loading**: Check that `checkpoint_best_total.pth` is in the correct location
- **Port issues**: Ensure port 8000 is exposed in RunPod pod settings
- **GPU errors**: Verify CUDA is available: `nvidia-smi` should work in the pod
- **Frontend not loading**: Check that static files are being served correctly

## Cost Optimization

- Use spot instances for lower costs
- Stop the pod when not in use
- Monitor GPU usage to right-size your instance

