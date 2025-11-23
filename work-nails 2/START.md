# 🚀 Quick Start Guide - Real-Time Nail AR



 I am attaching a enviroment.yml file which you can use to create the python environment its working in on my pc i am using miniconda if you are using something else you can use that too it will also with anaconda 




 

## Step 1: Start the Backend

Open a terminal and run:

```bash
cd /home/usama-naveed/nail-project/backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
RF-DETR model loaded and optimized for inference.
```

**Keep this terminal open!**

---

## Step 2: Start the Frontend

Open a **NEW terminal** and run:

```bash
cd /home/usama-naveed/nail-project/frontend
python3 -m http.server 3000
```

You should see:
```
Serving HTTP on 0.0.0.0 port 3000 (http://0.0.0.0:3000/) ...
```

**Keep this terminal open too!**

---

## Step 3: Open the App

### 🏠 Main Landing Page (Choose Version)

```
http://localhost:3000/
```

**This page shows all versions with live system status and lets you pick!**

**IMPORTANT:** Must use `localhost`, NOT `0.0.0.0`

---

### Or Go Directly To:

**⭐ Optimized Version (Recommended):**
```
http://localhost:3000/app-realtime-optimized.html
```
- Has performance presets (Low/Medium/High)
- Best for most devices

**Standard Real-Time:**
```
http://localhost:3000/app-realtime.html
```
- Full manual control

**Basic Version:**
```
http://localhost:3000/index-basic.html
```
- 2D Canvas fallback

---

## Step 4: Use the App

1. **Click "🎥 Start Camera"**
   - Allow camera permissions
   - Wait for "Camera started" message

2. **Click "🔍 Segment Nails"**
   - Position your hand in view
   - Wait for segmentation (check API latency in stats panel)

3. **OR Click "▶ Start Real-Time Processing"**
   - Automatically re-segments every 500ms (adjustable)
   - Watch the FPS, latency, and render time!

4. **Adjust Controls:**
   - **Polish Color** - Pick any color
   - **Intensity** - How strong the color is
   - **Glossiness** - How shiny/reflective
   - **Metallic** - Chrome/metallic effect
   - **Processing Interval** - How often to re-segment (100-2000ms)

5. **Watch the Stats Panel (top-right):**
   - **FPS** - Should be 60 (rendering speed)
   - **Render Time** - Should be <20ms (GPU performance)
   - **API Latency** - Time for backend to segment (varies)
   - **Nails Detected** - How many nails found
   - **Frame Size** - Camera resolution

---

## ✅ What You Should See

### Stats Panel Should Show:
- **FPS:** 60
- **Render Time:** 5-15ms (depends on GPU)
- **API Latency:** 200-800ms (depends on backend)
- **Nails Detected:** 10 (if all fingers visible)
- **Frame Size:** 1280×720 or similar

### If Something's Wrong:

**Camera not working?**
- Using `localhost`? (NOT 0.0.0.0)
- Allowed camera permissions?
- Try: `http://localhost:3000/debug.html`

**Low FPS (<60)?**
- Check render time
- If >20ms, reduce metallic to 0
- Lower camera resolution

**High API latency (>1000ms)?**
- Backend may be using CPU instead of GPU
- Check backend terminal for errors
- Increase processing interval to 1000ms+

**No nails detected?**
- Better lighting
- Move hand closer
- Show palm to camera
- Make sure backend is running

---

## 🎮 Tips for Best Results

1. **Good lighting is key** - Natural light or bright room
2. **Show your palm** - Camera needs to see nails
3. **Keep hand steady** - Reduces blur
4. **Start with one hand** - Easier to detect
5. **Watch the stats** - Optimize based on performance

---

## 🎨 Try These Settings

### Natural Look
- Intensity: 60%
- Glossiness: 40%
- Metallic: 0%

### High Gloss
- Intensity: 90%
- Glossiness: 80%
- Metallic: 10%

### Metallic/Chrome
- Intensity: 70%
- Glossiness: 90%
- Metallic: 50%

---

## 🔗 Other Versions

### Basic Version (2D Canvas)
```
http://localhost:3000/
```
- Simpler, no WebGL required
- Lower quality but more compatible

### WebGL (No Real-Time Stats)
```
http://localhost:3000/app-webgl.html
```
- WebGL rendering but manual segmentation only

---

## 🛑 To Stop

1. Press `Ctrl+C` in the backend terminal
2. Press `Ctrl+C` in the frontend terminal
3. Close browser tab

---

## 📊 Expected Performance

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| FPS | 60 | 45-59 | <45 |
| Render Time | <15ms | 15-30ms | >30ms |
| API Latency | <500ms | 500-1000ms | >1000ms |

---

## 🎯 Quick Checklist

- [ ] Backend running on port 8000
- [ ] Frontend running on port 3000
- [ ] Opened `http://localhost:3000/app-realtime.html`
- [ ] Camera started successfully
- [ ] Nails segmented (or real-time enabled)
- [ ] FPS showing 60
- [ ] Render time <20ms
- [ ] Polish color changing works

---

**Enjoy your Real-Time Nail AR with GPU Acceleration! 💅✨**
