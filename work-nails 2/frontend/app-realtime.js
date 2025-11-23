// app-realtime.js — Real-time nail AR with performance monitoring

const API_URL = "/api/nails/segment";
const WS_URL = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/ws/nails/segment';

// WebSocket connection management
function connectWebSocket() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        resolve();
      };
      
      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        reject(error);
      };
      
      ws.onclose = () => {
        console.log("🔌 WebSocket closed");
        ws = null;
        // Reject all pending requests
        wsPendingQueue.forEach(({ reject: rejectRequest }) => {
          rejectRequest(new Error("WebSocket closed"));
        });
        wsPendingQueue = [];
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Process first pending request (FIFO)
          if (wsPendingQueue.length > 0) {
            const { resolve: resolveRequest, startTime } = wsPendingQueue.shift();
            const latency = Math.round(performance.now() - startTime);
            resolveRequest({ data, latency });
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
          // Reject first pending request on error
          if (wsPendingQueue.length > 0) {
            const { reject: rejectRequest } = wsPendingQueue.shift();
            rejectRequest(err);
          }
        }
      };
    } catch (err) {
      reject(err);
    }
  });
}

// UI Elements
const startBtn = document.getElementById("startBtn");
const segmentBtn = document.getElementById("segmentBtn");
const toggleProcessing = document.getElementById("toggleProcessing");
const colorPicker = document.getElementById("colorPicker");
const intensityEl = document.getElementById("intensity");
const glossinessEl = document.getElementById("glossiness");
const metallicEl = document.getElementById("metallic");
const processingIntervalEl = document.getElementById("processingInterval");

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const statusDiv = document.getElementById("statusDiv");
const liveIndicator = document.getElementById("liveIndicator");

// Stats UI
const fpsValue = document.getElementById("fpsValue");
const renderTime = document.getElementById("renderTime");
const apiLatency = document.getElementById("apiLatency");
const nailCount = document.getElementById("nailCount");
const frameSize = document.getElementById("frameSize");

// Value displays
const intensityValue = document.getElementById("intensityValue");
const glossValue = document.getElementById("glossValue");
const metallicValue = document.getElementById("metallicValue");
const intervalValue = document.getElementById("intervalValue");

// State
let stream = null;
let nailRenderer = null;
let offscreenCanvas = null;
let offscreenCtx = null;
let currentMaskCanvas = null;
let isProcessing = false;
let processingInterval = null;
let ws = null;
let wsPendingQueue = []; // Queue of pending requests (FIFO)
let useWebSocket = true; // Toggle between WebSocket and HTTP

// Performance tracking
let frameCount = 0;
let lastFpsUpdate = performance.now();
let lastFrameTime = performance.now();
let renderTimes = [];

console.log("✓ Real-time app loaded");

// ─────────────────── Event Listeners ───────────────────

startBtn.addEventListener("click", startCamera);
segmentBtn.addEventListener("click", segmentOnce);
toggleProcessing.addEventListener("click", toggleRealtimeProcessing);

colorPicker.addEventListener("input", renderFrame);
intensityEl.addEventListener("input", (e) => {
  intensityValue.textContent = e.target.value + "%";
  renderFrame();
});
glossinessEl.addEventListener("input", (e) => {
  glossValue.textContent = e.target.value + "%";
  renderFrame();
});
metallicEl.addEventListener("input", (e) => {
  metallicValue.textContent = e.target.value + "%";
  renderFrame();
});
processingIntervalEl.addEventListener("input", (e) => {
  intervalValue.textContent = e.target.value + "ms";
  if (isProcessing) {
    stopRealtimeProcessing();
    startRealtimeProcessing();
  }
});

// ─────────────────── Camera ───────────────────

async function startCamera() {
  console.log("🎥 Starting camera...");
  setStatus("Requesting camera access...");

  if (!navigator.mediaDevices?.getUserMedia) {
    console.error("❌ getUserMedia not available");
    setStatus("Camera not available. Use localhost or https.", "error");
    return;
  }

  if (stream) {
    console.log("⚠️ Camera already running");
    setStatus("Camera already running.", "success");
    return;
  }

  try {
    console.log("📹 Requesting camera stream...");
    // Lower resolution for better performance
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },  // Reduced from 1280
        height: { ideal: 480 }  // Reduced from 720
      },
      audio: false
    });

    console.log("✅ Got camera stream:", stream);
    console.log("Video tracks:", stream.getVideoTracks());

    video.srcObject = stream;
    console.log("📺 Set video.srcObject");

    // Wait for metadata
    console.log("⏳ Waiting for video metadata...");

    // Check if metadata is already loaded (sometimes it loads instantly)
    if (video.videoWidth > 0) {
      console.log("📊 Metadata already loaded! (fast path)");
    } else {
      // Wait for loadedmetadata event
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout waiting for video metadata (5s)"));
        }, 5000);

        video.addEventListener("loadedmetadata", () => {
          clearTimeout(timeout);
          console.log("📊 Metadata loaded via event!");
          resolve();
        }, { once: true });
      });
    }

    console.log("▶️ Ensuring video is playing...");
    try {
      await video.play();
      console.log("✅ Video.play() succeeded!");
    } catch (playErr) {
      console.warn("⚠️ Video.play() failed, but might auto-play:", playErr);
      // Don't throw - autoplay might handle it
    }

    console.log(`📐 Video dimensions: ${video.videoWidth}×${video.videoHeight}`);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    frameSize.textContent = `${video.videoWidth}×${video.videoHeight}`;

    // Initialize WebGL
    console.log("🎮 Initializing WebGL renderer...");
    nailRenderer = new NailRenderer(canvas);
    console.log("✅ WebGL renderer created");

    // Create offscreen canvas for mask
    offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    offscreenCtx = offscreenCanvas.getContext("2d");
    console.log("✅ Offscreen canvas created");

    startBtn.disabled = true;
    startBtn.textContent = "✓ Camera Running";
    segmentBtn.disabled = false;
    toggleProcessing.disabled = false;
    liveIndicator.style.display = "flex";

    setStatus("Camera started! Click 'Segment Nails' or start real-time processing.", "success");
    console.log("✅ Camera setup complete!");

    // Start render loop
    console.log("🔄 Starting render loop...");
    startRenderLoop();

  } catch (err) {
    console.error("❌ Camera error:", err);
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    setStatus(`Camera error: ${err.message}`, "error");
  }
}

// ─────────────────── Render Loop (FPS Tracking) ───────────────────

function startRenderLoop() {
  function loop() {
    const now = performance.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;

    // Update FPS counter
    frameCount++;
    if (now - lastFpsUpdate >= 1000) {
      const fps = Math.round(frameCount * 1000 / (now - lastFpsUpdate));
      fpsValue.textContent = fps;
      frameCount = 0;
      lastFpsUpdate = now;
    }

    // Render frame
    const renderStart = performance.now();
    renderFrame();
    const renderDuration = performance.now() - renderStart;

    // Track render time (moving average)
    renderTimes.push(renderDuration);
    if (renderTimes.length > 30) renderTimes.shift();
    const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    renderTime.textContent = avgRenderTime.toFixed(1) + "ms";

    requestAnimationFrame(loop);
  }
  loop();
}

// ─────────────────── Rendering ───────────────────

function renderFrame() {
  if (!nailRenderer || !video.readyState || video.paused) return;

  // Capture video frame
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(video, 0, 0);
  const videoImageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

  // Update video texture
  nailRenderer.updateVideoTexture(videoImageData);

  // Update mask texture (if we have one)
  if (currentMaskCanvas) {
    nailRenderer.updateMaskTexture(currentMaskCanvas);
  } else {
    // No mask yet - create empty mask
    offscreenCtx.clearRect(0, 0, canvas.width, canvas.height);
    nailRenderer.updateMaskTexture(offscreenCanvas);
  }

  // Get parameters
  const polishColor = hexToRgbNormalized(colorPicker.value);
  const intensity = parseInt(intensityEl.value) / 100.0;
  const glossiness = parseInt(glossinessEl.value) / 100.0;
  const metallic = parseInt(metallicEl.value) / 100.0;

  // Render with WebGL
  nailRenderer.render(polishColor, intensity, glossiness, metallic);
}

// ─────────────────── Segmentation ───────────────────

async function segmentOnce() {
  if (!video.videoWidth) {
    setStatus("Camera not ready", "error");
    return;
  }

  segmentBtn.disabled = true;
  segmentBtn.textContent = "⏳ Processing...";

  await performSegmentation();

  segmentBtn.disabled = false;
  segmentBtn.textContent = "🔍 Segment Nails";
}

async function performSegmentation() {
  const apiStart = performance.now();

  try {
    console.log("📸 Capturing frame for segmentation...");

    // Capture frame
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(video, 0, 0);

    console.log(`Frame size: ${tempCanvas.width}×${tempCanvas.height}`);

    // Convert to blob
    const blob = await canvasToBlob(tempCanvas, "image/jpeg", 0.6);
    console.log(`Blob size: ${(blob.size / 1024).toFixed(1)}KB`);

    let data, latency;

    // Try WebSocket first (faster), fallback to HTTP
    if (useWebSocket) {
      try {
        await connectWebSocket();
        
        const startTime = performance.now();
        
        // Wait for response (FIFO queue ensures order)
        const result = await new Promise((resolve, reject) => {
          wsPendingQueue.push({ resolve, reject, startTime });
          
          // Send binary image data
          ws.send(blob);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            const index = wsPendingQueue.findIndex(item => item.startTime === startTime);
            if (index !== -1) {
              wsPendingQueue.splice(index, 1);
              reject(new Error("WebSocket request timeout"));
            }
          }, 5000);
        });
        
        data = result.data;
        latency = result.latency;
        console.log(`📡 WebSocket response (${latency}ms)`);
        
      } catch (wsError) {
        console.warn("WebSocket failed, falling back to HTTP:", wsError);
        useWebSocket = false; // Disable WebSocket for this session
        // Fall through to HTTP
      }
    }

    // Fallback to HTTP if WebSocket failed or disabled
    if (!data) {
      const formData = new FormData();
      formData.append("file", blob, "frame.jpg");

      console.log(`🌐 Sending to API (HTTP): ${API_URL}`);

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData
      });

      const apiEnd = performance.now();
      latency = Math.round(apiEnd - apiStart);

      console.log(`📡 HTTP Response status: ${response.status} (${latency}ms)`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(`API error ${response.status}: ${errorText.substring(0, 100)}`);
      }

      data = await response.json();
    }

    apiLatency.textContent = latency + "ms";
    console.log("✅ Segmentation result:", data);

    if (!data.nails || data.nails.length === 0) {
      setStatus("No nails detected. Try better lighting or move closer.", "error");
      nailCount.textContent = "0";
      currentMaskCanvas = null;
      return;
    }

    // Build mask
    buildMask(data.nails);
    nailCount.textContent = data.nails.length.toString();

    setStatus(`✓ Detected ${data.nails.length} nails (${latency}ms latency)`, "success");

  } catch (err) {
    console.error("❌ Segmentation error:", err);
    console.error("Error stack:", err.stack);
    setStatus(`Segmentation failed: ${err.message}`, "error");
    apiLatency.textContent = "Error";
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
}

// ─────────────────── Real-Time Processing ───────────────────

function toggleRealtimeProcessing() {
  if (isProcessing) {
    stopRealtimeProcessing();
  } else {
    startRealtimeProcessing();
  }
}

function startRealtimeProcessing() {
  if (isProcessing) return;

  const interval = parseInt(processingIntervalEl.value);

  isProcessing = true;
  toggleProcessing.textContent = "⏸ Stop Real-Time";
  toggleProcessing.classList.remove("secondary");
  toggleProcessing.classList.add("primary");
  setStatus(`Real-time processing active (every ${interval}ms)`, "success");

  let isSegmenting = false;

  // Run segmentation at intervals - but skip if previous one is still running
  processingInterval = setInterval(async () => {
    if (!isSegmenting && !segmentBtn.disabled) {
      isSegmenting = true;
      try {
        await performSegmentation();
      } finally {
        isSegmenting = false;
      }
    } else {
      console.log("⏭️ Skipping segmentation (previous still running)");
    }
  }, interval);

  // Do first segmentation immediately
  performSegmentation();
}

function stopRealtimeProcessing() {
  if (!isProcessing) return;

  isProcessing = false;
  clearInterval(processingInterval);
  processingInterval = null;

  toggleProcessing.textContent = "▶ Start Real-Time Processing";
  toggleProcessing.classList.remove("primary");
  toggleProcessing.classList.add("secondary");
  setStatus("Real-time processing stopped", "success");
}

// ─────────────────── Helpers ───────────────────

function setStatus(msg, type = "normal") {
  console.log("[STATUS]", msg);
  statusDiv.textContent = msg;
  statusDiv.className = "status";
  if (type === "error") statusDiv.classList.add("error");
  if (type === "success") statusDiv.classList.add("success");
}

function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), type, quality);
  });
}

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

// ─────────────────── Cleanup ───────────────────

window.addEventListener("beforeunload", () => {
  stopRealtimeProcessing();
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  if (nailRenderer) {
    nailRenderer.destroy();
  }
});
