# Nail AR Frontend - All Versions

## 📁 Available Versions

### 1. **Original Version (2D Canvas)**
- **Files:** `index.html` + `app.js`
- **URL:** `http://localhost:3000/`
- **Features:**
  - LAB color space recoloring
  - CPU-based rendering
  - Manual capture and segment
  - Gloss effect simulation
- **Performance:** ~30 FPS
- **Best for:** Older browsers, compatibility

### 2. **WebGL Enhanced**
- **Files:** `app-webgl.html` + `app-webgl.js` + `webgl-nails.js`
- **URL:** `http://localhost:3000/app-webgl.html`
- **Features:**
  - GPU-accelerated rendering
  - Physically-based lighting
  - Real specular highlights
  - Metallic/chrome effects
  - Adjustable glossiness
- **Performance:** 60 FPS
- **Best for:** Modern browsers, best quality

### 3. **Real-Time Version** ⭐ RECOMMENDED
- **Files:** `app-realtime.html` + `app-realtime.js` + `webgl-nails.js`
- **URL:** `http://localhost:3000/app-realtime.html`
- **Features:**
  - Everything from WebGL version PLUS:
  - **Live FPS counter**
  - **Render time monitoring**
  - **API latency tracking**
  - **Frame size display**
  - **Nail count display**
  - **Automatic re-segmentation** (configurable interval)
  - **Modern UI with stats panel**
  - Real-time performance metrics
- **Performance:** 60 FPS with live monitoring
- **Best for:** Production use, demo, development

## 🚀 Quick Start

### Start Backend (Required)
```bash
cd backend
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Start Frontend
```bash
cd frontend
python3 -m http.server 3000
```

### Choose Your Version

**For best experience (Real-Time):**
```
http://localhost:3000/app-realtime.html
```

**For WebGL without real-time:**
```
http://localhost:3000/app-webgl.html
```

**For basic version:**
```
http://localhost:3000/
```

## 📊 Feature Comparison

| Feature | Original | WebGL | Real-Time |
|---------|----------|-------|-----------|
| Color Processing | LAB (CPU) | Linear RGB (GPU) | Linear RGB (GPU) |
| Rendering | Canvas 2D | WebGL 2.0 | WebGL 2.0 |
| FPS Display | ❌ | ❌ | ✅ |
| Latency Tracking | ❌ | ❌ | ✅ |
| Render Time | ❌ | ❌ | ✅ |
| Auto Re-segment | ❌ | ❌ | ✅ (configurable) |
| Glossiness Control | Simulated | Real specular | Real specular |
| Metallic Effect | ❌ | ✅ | ✅ |
| Performance | 30 FPS | 60 FPS | 60 FPS |
| Stats Panel | ❌ | ❌ | ✅ |
| Modern UI | Basic | Enhanced | Premium |

## 🎮 Real-Time Version Controls

### Performance Metrics (Top-Right Panel)
- **FPS:** Frames per second (rendering speed)
- **Render Time:** GPU render time per frame (ms)
- **API Latency:** Time to segment frame via backend (ms)
- **Nails Detected:** Number of nails found
- **Frame Size:** Camera resolution

### Main Controls
1. **🎥 Start Camera** - Initialize webcam
2. **🔍 Segment Nails** - Process single frame
3. **▶ Start Real-Time Processing** - Auto re-segment at intervals

### Polish Controls
- **Polish Color** - Any hex color
- **Intensity** - 0-100% color strength
- **Glossiness** - 0-100% specular shine
- **Metallic** - 0-100% chrome effect
- **Processing Interval** - 100-2000ms (how often to re-segment)

## 🔧 Customization

### Adjust Re-segmentation Speed
Edit the interval slider (100ms to 2000ms):
- **100ms** = Very fast (10 FPS segmentation) - High CPU/GPU usage
- **500ms** = Balanced (2 FPS segmentation) - Recommended
- **1000ms** = Slower (1 FPS segmentation) - Lower usage
- **2000ms** = Very slow (0.5 FPS segmentation) - Minimal usage

### Optimize Performance

**For slower devices:**
1. Increase processing interval to 1000ms+
2. Lower camera resolution (edit `app-realtime.js` line ~40)
3. Reduce metallic to 0%

**For best quality:**
1. Use 1280×720 camera resolution
2. Processing interval: 500ms
3. Glossiness: 70-80%
4. Metallic: 20-30%

## 🐛 Troubleshooting

### Camera Won't Start
- Must use `http://localhost:3000` (not IP address or 0.0.0.0)
- Check browser permissions
- Try debug page: `http://localhost:3000/debug.html`

### Low FPS
- Check render time (should be <20ms)
- If >20ms, your GPU may be slow
- Try reducing canvas size
- Disable metallic effect

### High API Latency
- Backend may be slow (check if GPU is being used)
- Network issue (should be <100ms on localhost)
- Try increasing processing interval

### "WebGL 2 not supported"
- Update browser to latest version
- Try Chrome/Firefox/Edge
- Enable hardware acceleration in browser settings

## 📱 Browser Compatibility

| Browser | Original | WebGL | Real-Time |
|---------|----------|-------|-----------|
| Chrome 90+ | ✅ | ✅ | ✅ |
| Firefox 88+ | ✅ | ✅ | ✅ |
| Safari 15+ | ✅ | ✅ | ✅ |
| Edge 90+ | ✅ | ✅ | ✅ |
| Mobile Chrome | ✅ | ⚠️ | ⚠️ |
| Mobile Safari | ✅ | ⚠️ | ⚠️ |

⚠️ = May have reduced performance

## 🎯 Recommended Settings

### Demo/Presentation
- Version: **Real-Time**
- Processing Interval: **500ms**
- Glossiness: **70%**
- Metallic: **20%**
- Show stats panel for "wow factor"

### Development/Testing
- Version: **Real-Time**
- Processing Interval: **1000ms**
- Monitor latency and FPS
- Adjust based on performance

### Production
- Version: **WebGL** or **Real-Time**
- Processing Interval: **500-1000ms**
- Consider adding error handling
- Add loading states

## 📈 Performance Tips

1. **Monitor the stats panel** - Keep FPS at 60, render time <20ms
2. **Adjust processing interval** - Balance quality vs performance
3. **Use proper lighting** - Better detection = less re-segmentation needed
4. **Keep hand steady** - Reduces need for frequent re-segmentation
5. **Close other tabs** - Free up GPU/CPU resources

## 🎨 Future Enhancements

Possible additions:
- [ ] Nail art patterns/textures
- [ ] French manicure mode
- [ ] Glitter/sparkle effects
- [ ] Recording/screenshot capability
- [ ] Multiple color zones per nail
- [ ] Hand tracking (no segmentation needed)
- [ ] Mobile app wrapper
- [ ] AR glasses support

## 📝 Notes

- All versions work with the same backend API
- Real-time version is recommended for best experience
- WebGL versions require WebGL 2.0 support
- Original version is the fallback for old browsers
