// app-webgl.js — Main app logic with WebGL rendering

const API_URL = "http://localhost:8000/api/nails/segment";

const startCameraBtn = document.getElementById("startCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const colorPicker = document.getElementById("colorPicker");
const intensityEl = document.getElementById("intensity");
const glossinessEl = document.getElementById("glossiness");
const metallicEl = document.getElementById("metallic");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusDiv = document.getElementById("statusDiv");

// Display values
const intensityValue = document.getElementById("intensityValue");
const glossValue = document.getElementById("glossValue");
const metallicValue = document.getElementById("metallicValue");

let stream = null;
let nailRenderer = null;
let offscreenCanvas = null;
let offscreenCtx = null;
let currentVideoFrame = null;
let currentMaskCanvas = null;
let animationFrameId = null;

function setStatus(msg, type = 'normal') {
  console.log("[STATUS]", msg);
  statusDiv.textContent = msg;
  statusDiv.className = 'status';
  if (type === 'error') statusDiv.classList.add('error');
  if (type === 'success') statusDiv.classList.add('success');
}

// ─────────────────── Event wiring ───────────────────

console.log("app-webgl.js loaded successfully");

startCameraBtn.addEventListener("click", () => {
  console.log("Start Camera button clicked!");
  startCamera().catch(err => {
    console.error("startCamera error:", err);
    setStatus("Camera error: " + err.name + " - " + err.message, 'error');
  });
});

captureBtn.addEventListener("click", () => {
  console.log("Capture button clicked");
  captureAndSegment().catch(err => {
    console.error("captureAndSegment error:", err);
    setStatus("Capture error: " + err.name + " - " + err.message, 'error');
  });
});

colorPicker.addEventListener("input", () => updateRendering());
intensityEl.addEventListener("input", (e) => {
  intensityValue.textContent = e.target.value;
  updateRendering();
});
glossinessEl.addEventListener("input", (e) => {
  glossValue.textContent = e.target.value;
  updateRendering();
});
metallicEl.addEventListener("input", (e) => {
  metallicValue.textContent = e.target.value;
  updateRendering();
});

// ─────────────────── Camera ───────────────────

async function startCamera() {
  setStatus("Requesting camera access...");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("getUserMedia not available (need localhost or https).", 'error');
    return;
  }

  if (stream) {
    setStatus("Camera already running.");
    return;
  }

  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  // Wait for video metadata
  await new Promise(resolve => {
    video.onloadedmetadata = resolve;
  });

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Initialize WebGL renderer
  try {
    nailRenderer = new NailRenderer(canvas);
    setStatus("Camera started with WebGL acceleration! Click 'Capture & Segment'.", 'success');
  } catch (err) {
    console.error("WebGL initialization error:", err);
    setStatus("WebGL error: " + err.message + " (falling back to 2D canvas)", 'error');
  }

  // Create offscreen canvas for mask processing
  offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = canvas.width;
  offscreenCanvas.height = canvas.height;
  offscreenCtx = offscreenCanvas.getContext('2d');

  captureBtn.disabled = false;

  // Start live preview (just show video until segmentation)
  startLivePreview();
}

function startLivePreview() {
  function render() {
    if (!video.paused && !video.ended && video.readyState >= 2) {
      if (!currentMaskCanvas) {
        // No segmentation yet - just show video
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } else {
        // We have segmentation - render with WebGL
        updateRendering();
      }
    }
    animationFrameId = requestAnimationFrame(render);
  }
  render();
}

// ─────────────────── Capture + segmentation ───────────────────

async function captureAndSegment() {
  if (!video.videoWidth || !video.videoHeight) {
    setStatus("Camera not ready yet (videoWidth/videoHeight = 0).", 'error');
    return;
  }

  captureBtn.disabled = true;
  captureBtn.textContent = "Processing...";
  setStatus("Sending frame to backend for segmentation...");

  try {
    // Capture current video frame
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);

    const blob = await canvasToBlob(tempCanvas, "image/jpeg", 0.85);
    const form = new FormData();
    form.append("file", blob, "frame.jpg");

    const res = await fetch(API_URL, { method: "POST", body: form });
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    console.log("Segment response:", data);

    if (!data.nails || data.nails.length === 0) {
      setStatus("No nails detected. Try moving closer / better lighting.", 'error');
      return;
    }

    // Build mask from polygons
    buildMask(data.nails);

    setStatus(`Detected ${data.nails.length} nails. Adjust controls for realistic polish effect!`, 'success');
  } catch (err) {
    console.error("Segmentation error:", err);
    setStatus("Segmentation failed: " + err.message, 'error');
  } finally {
    captureBtn.disabled = false;
    captureBtn.textContent = "📸 Capture & Segment";
  }
}

function buildMask(nails) {
  const w = offscreenCanvas.width;
  const h = offscreenCanvas.height;

  offscreenCtx.clearRect(0, 0, w, h);
  offscreenCtx.fillStyle = "white";

  // Draw all nail polygons
  for (const nail of nails) {
    const poly = nail.polygon;
    if (!poly || poly.length < 6) continue;

    offscreenCtx.beginPath();
    offscreenCtx.moveTo(poly[0], poly[1]);
    for (let i = 2; i < poly.length; i += 2) {
      offscreenCtx.lineTo(poly[i], poly[i + 1]);
    }
    offscreenCtx.closePath();
    offscreenCtx.fill();
  }

  // Apply blur for smooth edges
  offscreenCtx.filter = "blur(3px)";
  offscreenCtx.drawImage(offscreenCanvas, 0, 0);
  offscreenCtx.filter = "none";

  currentMaskCanvas = offscreenCanvas;

  // Initial render
  updateRendering();
}

function updateRendering() {
  if (!nailRenderer || !currentMaskCanvas) return;

  // Capture current video frame
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(video, 0, 0);
  const videoImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

  // Update WebGL textures
  nailRenderer.updateVideoTexture(videoImageData);
  nailRenderer.updateMaskTexture(currentMaskCanvas);

  // Get polish parameters
  const hex = colorPicker.value;
  const polishColor = hexToRgbNormalized(hex);
  const intensity = parseInt(intensityEl.value, 10) / 100.0;
  const glossiness = parseInt(glossinessEl.value, 10) / 100.0;
  const metallic = parseInt(metallicEl.value, 10) / 100.0;

  // Render with WebGL
  nailRenderer.render(polishColor, intensity, glossiness, metallic);
}

function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), type, quality);
  });
}

// ─────────────────── Helpers ───────────────────

function hexToRgbNormalized(hex) {
  let s = hex.trim();
  if (s[0] === "#") s = s.slice(1);
  if (s.length === 3) s = s.split("").map(c => c + c).join("");
  const num = parseInt(s, 16);
  return [
    ((num >> 16) & 255) / 255.0,
    ((num >> 8) & 255) / 255.0,
    (num & 255) / 255.0
  ];
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  if (nailRenderer) {
    nailRenderer.destroy();
  }
});
