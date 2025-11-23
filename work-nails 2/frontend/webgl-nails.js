// webgl-nails.js — WebGL-based nail rendering with realistic polish effects

class NailRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', {
      premultipliedAlpha: false,
      alpha: true
    });

    if (!this.gl) {
      throw new Error('WebGL 2 not supported');
    }

    this.initShaders();
    this.initBuffers();
    this.setupTextures();
  }

  initShaders() {
    const gl = this.gl;

    // Vertex shader - simple passthrough
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Fragment shader - realistic nail polish rendering
    const fragmentShaderSource = `#version 300 es
      precision highp float;

      in vec2 v_texCoord;
      out vec4 fragColor;

      uniform sampler2D u_videoTexture;
      uniform sampler2D u_maskTexture;
      uniform vec3 u_polishColor;
      uniform float u_intensity;
      uniform float u_glossiness;
      uniform float u_metallic;

      // Convert sRGB to linear
      vec3 srgbToLinear(vec3 srgb) {
        return pow(srgb, vec3(2.2));
      }

      // Convert linear to sRGB
      vec3 linearToSrgb(vec3 linear) {
        return pow(linear, vec3(1.0 / 2.2));
      }

      // Simple specular highlight calculation
      vec3 calculateSpecular(vec3 normal, vec3 lightDir, vec3 viewDir, float shininess) {
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfDir), 0.0), shininess);
        return vec3(spec);
      }

      // Approximate normal from luminance gradient
      vec3 estimateNormal(sampler2D tex, vec2 uv, float strength) {
        vec2 texelSize = 1.0 / vec2(textureSize(tex, 0));

        float l = texture(tex, uv + vec2(-texelSize.x, 0.0)).r;
        float r = texture(tex, uv + vec2(texelSize.x, 0.0)).r;
        float t = texture(tex, uv + vec2(0.0, texelSize.y)).r;
        float b = texture(tex, uv + vec2(0.0, -texelSize.y)).r;

        float dx = (r - l) * strength;
        float dy = (t - b) * strength;

        return normalize(vec3(dx, dy, 1.0));
      }

      void main() {
        // Sample original video frame
        vec4 videoColor = texture(u_videoTexture, v_texCoord);

        // Sample mask (alpha channel)
        float mask = texture(u_maskTexture, v_texCoord).a;

        if (mask < 0.01) {
          // Outside nail region - show original
          fragColor = videoColor;
          return;
        }

        // Convert to linear color space for correct lighting
        vec3 originalLinear = srgbToLinear(videoColor.rgb);
        vec3 polishLinear = srgbToLinear(u_polishColor);

        // Estimate surface normal from video texture
        vec3 normal = estimateNormal(u_videoTexture, v_texCoord, 2.0);

        // Simple lighting setup
        vec3 lightDir = normalize(vec3(0.3, -0.5, 1.0));  // Top-right light
        vec3 viewDir = vec3(0.0, 0.0, 1.0);               // Camera looking straight

        // Diffuse lighting
        float diffuse = max(dot(normal, lightDir), 0.0);
        diffuse = diffuse * 0.5 + 0.5; // Soften the lighting

        // Specular highlight (glossy polish effect)
        float shininess = mix(5.0, 128.0, u_glossiness);
        vec3 specular = calculateSpecular(normal, lightDir, viewDir, shininess);
        specular *= u_glossiness * 0.8;

        // Base color: blend original luminance with polish color
        float lum = dot(originalLinear, vec3(0.299, 0.587, 0.114));
        vec3 baseColor = mix(originalLinear, polishLinear, u_intensity);

        // Preserve some original brightness variation (for natural look)
        baseColor *= (0.7 + 0.3 * lum / max(lum, 0.001));

        // Apply diffuse lighting
        vec3 litColor = baseColor * diffuse;

        // Add specular highlights
        litColor += specular * vec3(1.0);

        // Metallic effect (optional)
        if (u_metallic > 0.01) {
          vec3 reflectDir = reflect(-viewDir, normal);
          // Simple environment reflection approximation
          float envReflection = max(reflectDir.z, 0.0);
          litColor = mix(litColor, litColor * envReflection * 2.0, u_metallic * 0.3);
        }

        // Convert back to sRGB
        vec3 finalColor = linearToSrgb(litColor);

        // Blend with original based on mask
        fragColor = vec4(mix(videoColor.rgb, finalColor, mask), 1.0);
      }
    `;

    // Compile shaders
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    // Link program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Shader program link error:', gl.getProgramInfoLog(this.program));
      throw new Error('Failed to link shader program');
    }

    // Get attribute and uniform locations
    this.locations = {
      position: gl.getAttribLocation(this.program, 'a_position'),
      texCoord: gl.getAttribLocation(this.program, 'a_texCoord'),
      videoTexture: gl.getUniformLocation(this.program, 'u_videoTexture'),
      maskTexture: gl.getUniformLocation(this.program, 'u_maskTexture'),
      polishColor: gl.getUniformLocation(this.program, 'u_polishColor'),
      intensity: gl.getUniformLocation(this.program, 'u_intensity'),
      glossiness: gl.getUniformLocation(this.program, 'u_glossiness'),
      metallic: gl.getUniformLocation(this.program, 'u_metallic')
    };
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      throw new Error('Failed to compile shader');
    }

    return shader;
  }

  initBuffers() {
    const gl = this.gl;

    // Full-screen quad
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);

    const texCoords = new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      1, 0
    ]);

    // Position buffer
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Texture coordinate buffer
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  }

  setupTextures() {
    const gl = this.gl;

    // Video texture
    this.videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Mask texture
    this.maskTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  updateVideoTexture(imageData) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
  }

  updateMaskTexture(maskCanvas) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCanvas);
  }

  render(polishColor, intensity = 0.9, glossiness = 0.7, metallic = 0.2) {
    const gl = this.gl;

    // Use shader program
    gl.useProgram(this.program);

    // Set up position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 2, gl.FLOAT, false, 0, 0);

    // Set up texture coordinate attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.locations.texCoord);
    gl.vertexAttribPointer(this.locations.texCoord, 2, gl.FLOAT, false, 0, 0);

    // Bind textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.uniform1i(this.locations.videoTexture, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.uniform1i(this.locations.maskTexture, 1);

    // Set uniforms
    gl.uniform3fv(this.locations.polishColor, polishColor);
    gl.uniform1f(this.locations.intensity, intensity);
    gl.uniform1f(this.locations.glossiness, glossiness);
    gl.uniform1f(this.locations.metallic, metallic);

    // Clear and draw
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    const gl = this.gl;
    gl.deleteTexture(this.videoTexture);
    gl.deleteTexture(this.maskTexture);
    gl.deleteBuffer(this.positionBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.deleteProgram(this.program);
  }
}

// Export for use in main app
window.NailRenderer = NailRenderer;
