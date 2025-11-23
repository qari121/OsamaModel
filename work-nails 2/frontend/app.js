// app.js — webcam capture + RF-DETR + LAB recolor + gloss effect

const API_URL = "http://localhost:8000/api/nails/segment";

const startCameraBtn = document.getElementById("startCameraBtn");
const captureBtn     = document.getElementById("captureBtn");
const colorPicker    = document.getElementById("colorPicker");
const intensityEl    = document.getElementById("intensity");

const video  = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx    = canvas.getContext("2d");

// status debug line
const statusDiv = document.createElement("div");
statusDiv.style.marginTop = "8px";
statusDiv.style.color = "#f66";
document.body.insertBefore(statusDiv, document.body.firstChild);

let stream         = null;
let originalPixels = null;   // ImageData of captured frame
let nailPolygons   = [];     // [ [x1,y1,...], ... ]
let maskAlpha      = null;   // Float32Array per-pixel [0..1]

function setStatus(msg) {
  console.log("[STATUS]", msg);
  statusDiv.textContent = msg;
}

// ─────────────────── Event wiring ───────────────────

console.log("app.js loaded successfully");
console.log("startCameraBtn:", startCameraBtn);
console.log("video element:", video);
console.log("canvas element:", canvas);

startCameraBtn.addEventListener("click", () => {
  console.log("Start Camera button clicked!");
  startCamera().catch(err => {
    console.error("startCamera error:", err);
    setStatus("Camera error: " + err.name + " - " + err.message);
  });
});

captureBtn.addEventListener("click", () => {
  captureAndSegment().catch(err => {
    console.error("captureAndSegment error:", err);
    setStatus("Capture error: " + err.name + " - " + err.message);
  });
});

colorPicker.addEventListener("input", () => applyPolish());
intensityEl.addEventListener("input", () => applyPolish());

// ─────────────────── Camera ───────────────────

async function startCamera() {
  setStatus("Requesting camera access...");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("getUserMedia not available (need localhost or https).");
    return;
  }

  if (stream) {
    setStatus("Camera already running.");
    return;
  }

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false
  });

  video.srcObject = stream;
  await video.play();

  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;

  captureBtn.disabled = false;
  setStatus("Camera started. Position your hand and click 'Capture & Segment'.");
}

// ─────────────────── Capture + segmentation ───────────────────

async function captureAndSegment() {
  if (!video.videoWidth || !video.videoHeight) {
    setStatus("Camera not ready yet (videoWidth/videoHeight = 0).");
    return;
  }

  const w = video.videoWidth;
  const h = video.videoHeight;

  canvas.width  = w;
  canvas.height = h;

  // draw current frame
  ctx.drawImage(video, 0, 0, w, h);
  originalPixels = ctx.getImageData(0, 0, w, h);

  nailPolygons = [];
  maskAlpha = null;

  captureBtn.disabled = true;
  captureBtn.textContent = "Processing...";
  setStatus("Sending frame to backend for segmentation...");

  try {
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
    const form = new FormData();
    form.append("file", blob, "frame.jpg");

    const res = await fetch(API_URL, { method: "POST", body: form });
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    console.log("Segment response:", data);

    nailPolygons = data.nails.map(n => n.polygon);

    if (!nailPolygons.length) {
      setStatus("No nails detected. Try moving closer / better lighting.");
      ctx.putImageData(originalPixels, 0, 0);
      return;
    }

    buildMaskAlpha();
    applyPolish();
    setStatus(`Detected ${nailPolygons.length} nails. Adjust color/intensity.`);
  } finally {
    captureBtn.disabled = false;
    captureBtn.textContent = "Capture & Segment";
  }
}

function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), type, quality);
  });
}

// ─────────────────── Mask building (with feathered edges) ───────────────────

function buildMaskAlpha() {
  if (!originalPixels || !nailPolygons.length) {
    maskAlpha = null;
    return;
  }

  const w = canvas.width;
  const h = canvas.height;

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const octx = off.getContext("2d");

  octx.clearRect(0, 0, w, h);
  octx.fillStyle = "white";

  // draw all polygons solid white
  for (const poly of nailPolygons) {
    const path = new Path2D();
    path.moveTo(poly[0], poly[1]);
    for (let i = 2; i < poly.length; i += 2) {
      path.lineTo(poly[i], poly[i + 1]);
    }
    path.closePath();
    octx.fill(path);
  }

  // blur to feather edges
  octx.filter = "blur(3px)";            // stronger blur for softer edge
  const blurred = octx.getImageData(0, 0, w, h);
  const bdata = blurred.data;

  maskAlpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let a = bdata[i * 4 + 3] / 255;     // alpha channel
    // gamma to make edges smoother
    a = Math.pow(a, 1.4);
    maskAlpha[i] = a;
  }
}

// ─────────────────── LAB recolor + gloss ───────────────────

function applyPolish() {
  if (!originalPixels || !maskAlpha) {
    if (originalPixels) {
      ctx.putImageData(originalPixels, 0, 0);
    }
    return;
  }

  const w = canvas.width;
  const h = canvas.height;

  // start from original each time (so repeated edits don't degrade)
  const imgData = ctx.createImageData(w, h);
  imgData.data.set(originalPixels.data);
  const data = imgData.data;

  const hex       = colorPicker.value;
  const strength  = parseInt(intensityEl.value, 10) / 100.0; // 0..1
  const glossGain = 0.35;  // how shiny the polish is (0..1)

  const targetRgb = hexToRgb(hex);
  const targetLab = rgb2lab(targetRgb.r, targetRgb.g, targetRgb.b);

  for (let i = 0; i < w * h; i++) {
    const aMask = maskAlpha[i];
    if (aMask < 0.02) continue;        // outside nail region

    const idx = i * 4;
    const R = data[idx];
    const G = data[idx + 1];
    const B = data[idx + 2];

    // original pixel in LAB
    const origLab = rgb2lab(R, G, B);

    // keep original lightness (preserves highlight/shadow)
    let L = origLab.L;

    // blend a/b towards target color
    const a = lerp(origLab.a, targetLab.a, strength);
    const b = lerp(origLab.b, targetLab.b, strength);

    // simple gloss: brighten already-bright regions slightly
    // L is roughly [0..100]
    const Lnorm = L / 100.0;
    const spec  = smoothstep(0.55, 0.9, Lnorm);   // only in bright zones
    L = L + spec * glossGain * 15.0;             // add up to ~15 lightness
    if (L > 100) L = 100;

    const newRgb = lab2rgb(L, a, b);

    // feathered blend with original based on mask alpha
    const blend = aMask;   // already 0..1 with feathering
    data[idx]     = (1 - blend) * R + blend * newRgb.r;
    data[idx + 1] = (1 - blend) * G + blend * newRgb.g;
    data[idx + 2] = (1 - blend) * B + blend * newRgb.b;
    // alpha (data[idx+3]) stays as-is
  }

  ctx.putImageData(imgData, 0, 0);
}

// ─────────────────── Color + math helpers ───────────────────

function hexToRgb(hex) {
  let s = hex.trim();
  if (s[0] === "#") s = s.slice(1);
  if (s.length === 3) s = s.split("").map(c => c + c).join("");
  const num = parseInt(s, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// sRGB → LAB
function rgb2lab(r, g, b) {
  // normalize
  let R = r / 255;
  let G = g / 255;
  let B = b / 255;

  // sRGB to linear
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;

  // linear RGB to XYZ (D65)
  let X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let Z = R * 0.0193 + G * 0.1192 + B * 0.9505;

  // normalize for D65 white
  X /= 0.95047;
  Y /= 1.00000;
  Z /= 1.08883;

  const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16/116;

  const fx = f(X);
  const fy = f(Y);
  const fz = f(Z);

  const L = (116 * fy) - 16;
  const aLab = 500 * (fx - fy);
  const bLab = 200 * (fy - fz);

  return { L, a: aLab, b: bLab };
}

// LAB → sRGB (clamped 0..255)
function lab2rgb(L, a, b) {
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;

  const fInv = (t) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16/116) / 7.787;
  };

  x = fInv(x);
  y = fInv(y);
  z = fInv(z);

  // D65 white
  x *= 0.95047;
  y *= 1.00000;
  z *= 1.08883;

  // XYZ → linear RGB
  let R = x *  3.2406 + y * -1.5372 + z * -0.4986;
  let G = x * -0.9689 + y *  1.8758 + z *  0.0415;
  let B = x *  0.0557 + y * -0.2040 + z *  1.0570;

  const gamma = (c) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;

  R = gamma(R);
  G = gamma(G);
  B = gamma(B);

  R = Math.min(Math.max(0, R), 1);
  G = Math.min(Math.max(0, G), 1);
  B = Math.min(Math.max(0, B), 1);

  return {
    r: Math.round(R * 255),
    g: Math.round(G * 255),
    b: Math.round(B * 255)
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// smoothstep for gloss
function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}