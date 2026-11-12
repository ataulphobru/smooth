'use strict';

(() => {
  const image = document.querySelector('[data-filaments]');
  if (!image) return;

  const method = image.dataset.filaments === 'metodo';
  const duration = method ? 6_800 : 24_000;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = true;
  let elapsed = method ? 2_350 : Date.now() % duration;
  let started = performance.now();
  let effect;
  let initializing = false;

  function syncMotion() {
    effect?.sync();

    if (!preference.matches && !effect && !initializing) {
      initializing = true;
      image.decode().then(() => {
        if (!preference.matches) effect = createEffect();
      }).catch(() => {}).finally(() => { initializing = false; });
    }
  }

  document.addEventListener('magnetita:motion', ({ detail: shouldPause }) => {
    const now = performance.now();
    if (!paused) elapsed = (elapsed + now - started) % duration;
    started = now;
    paused = shouldPause;
    syncMotion();
  });

  // Pontos da arte em coordenadas normalizadas. As máscaras seguem os filamentos,
  // deixando as faces usinadas e a assinatura ancoradas na imagem original.
  const paths = {
    inicio: [
      [[.08,.76],[.20,.736],[.30,.669],[.42,.558],[.454,.432],[.469,.343],[.54,.255],[.65,.194],[.76,.135],[.89,.095],[.95,.092]],
      [[.951,.143],[.925,.246],[.868,.351],[.829,.455],[.851,.566],[.888,.667],[.873,.748],[.831,.812],[.786,.852],[.891,.877],[.955,.858]],
    ],
    nucleo: [
      [[.536,.538],[.648,.488],[.739,.408],[.765,.361],[.710,.327],[.677,.316]],
      [[.72,.324],[.812,.324],[.916,.345],[.947,.268],[.969,.193],[.989,.144]],
      [[.980,.385],[.971,.492],[.943,.622],[.895,.731],[.853,.830],[.755,.934],[.680,.982]],
    ],
    compatibilidade: [
      [[.752,.267],[.800,.253],[.856,.251],[.903,.273],[.948,.299],[.977,.326]],
      [[.973,.341],[.972,.421],[.963,.507],[.952,.592],[.923,.636]],
    ],
  };

  // Contorno medido em pixels na foto do Método (1672 × 941).
  // O limite acompanha o lado dos filamentos, acima do chanfro.
  const methodEdge = [
    [268, 694], [300, 686], [340, 676], [380, 664], [420, 648],
    [460, 629], [480, 616], [500, 599], [520, 582], [540, 560],
    [560, 529], [580, 488], [600, 448], [620, 418], [640, 394],
    [660, 374], [680, 357], [700, 342], [720, 328], [740, 315],
    [760, 303], [800, 281], [840, 263], [880, 246], [920, 230],
    [960, 216], [1000, 203], [1040, 191], [1080, 180], [1120, 170],
    [1160, 160], [1200, 152], [1240, 144], [1280, 138], [1320, 132],
    [1360, 128], [1400, 124], [1460, 121], [1500, 122], [1550, 126],
  ];

  function paintMethodField(pen, field) {
    const scale = field.width / 1672;
    pen.filter = 'blur(.85px)';
    pen.fillStyle = '#fff';
    pen.beginPath();
    pen.moveTo(methodEdge[0][0] * scale, 0);
    for (const [x, y] of methodEdge) pen.lineTo(x * scale, y * scale);
    pen.lineTo(methodEdge.at(-1)[0] * scale, 0);
    pen.closePath();
    pen.fill();
    return field;
  }
  function makeField() {
    const field = document.createElement('canvas');
    field.width = method ? 1120 : 560;
    field.height = Math.round(field.width * image.naturalHeight / image.naturalWidth);
    const pen = field.getContext('2d');
    pen.fillRect(0, 0, field.width, field.height);
    if (method) return paintMethodField(pen, field);
    pen.filter = 'blur(9px)';
    pen.lineWidth = field.width * .056;
    pen.lineCap = 'round';
    pen.lineJoin = 'round';
    pen.strokeStyle = '#fff';
    for (const points of paths[image.dataset.filaments]) {
      pen.beginPath();
      pen.moveTo(points[0][0] * field.width, points[0][1] * field.height);
      for (const [x, y] of points.slice(1)) pen.lineTo(x * field.width, y * field.height);
      pen.stroke();
    }
    return field;
  }

  const vertexSource = `
    attribute vec2 aPosition;
    varying vec2 vScreen;
    void main() {
      vScreen = vec2(aPosition.x + 1.0, 1.0 - aPosition.y) * .5;
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision mediump float;
    uniform sampler2D uImage;
    uniform sampler2D uField;
    uniform vec4 uFrame;
    uniform float uPhase;
    uniform float uMethod;
    varying vec2 vScreen;

    float violet(vec3 color) {
      return smoothstep(.018, .15, min(color.r, color.b) - color.g)
        * smoothstep(.045, .20, color.b);
    }

    vec4 methodFilaments(vec2 uv, vec3 base, float field) {
      float progress = uPhase / 6.2831853;
      float front = fract(progress) * 1.23 - .12;
      float echo = fract(progress + .48) * 1.23 - .12;
      float frontDistance = (uv.x - front) / .102;
      float echoDistance = (uv.x - echo) / .125;
      float pulse = exp(-frontDistance * frontDistance);
      float afterglow = exp(-echoDistance * echoDistance);

      float wave = uv.x * 39.0 - uv.y * 13.0 - 2.0 * uPhase;
      float crossWave = uv.x * 22.0 - uv.y * 7.2 + uPhase;
      float flutter = .55 + .45 * sin(wave - .4);
      vec2 shift = vec2(
        sin(wave) + .27 * sin(crossWave),
        cos(wave + .8) + .24 * cos(crossWave + .8)
      ) * vec2(.0052, .009) * (.66 + .34 * max(pulse, afterglow));
      vec2 sampleUv = uv + shift;
      vec3 carried = texture2D(uImage, sampleUv).rgb;
      float sampleField = smoothstep(.15, .86, texture2D(uField, sampleUv).r);
      float fiber = violet(carried) * sampleField;
      float emission = (.12 + pulse * .78 + afterglow * .5 + flutter * .11) * fiber;
      float anchor = violet(base) * (.05 + pulse * .29 + afterglow * .1);
      vec3 violetCore = mix(vec3(.47, .13, .93), vec3(.84, .42, 1.0), pulse);
      vec3 light = mix(carried, violetCore, .68);
      return vec4(light, smoothstep(.12, .82, field) * clamp(emission + anchor, 0.0, .93));
    }
    void main() {
      vec2 uv = vScreen * uFrame.xy + uFrame.zw;
      if (min(uv.x, uv.y) < 0.0 || max(uv.x, uv.y) > 1.0) discard;
      float field = texture2D(uField, uv).r;
      if (field < .018) discard;

      vec3 base = texture2D(uImage, uv).rgb;
      if (uMethod > .5) {
        gl_FragColor = methodFilaments(uv, base, field);
        return;
      }
      float light = max(base.r, max(base.g, base.b));
      float chroma = light - min(base.r, min(base.g, base.b));
      float solid = smoothstep(.42, .82, light) * (1.0 - smoothstep(.035, .14, chroma));
      float flow = field * (1.0 - .78 * solid);
      float wave = uv.x * 19.0 + uv.y * 28.0 - uPhase;
      vec2 shift = vec2(
        sin(wave) * .009 + sin(uv.y * 52.0 + uPhase * 2.0) * .003,
        cos(wave + .55) * .006 + sin(uv.x * 38.0 + uPhase) * .003
      ) * flow;
      vec3 carried = texture2D(uImage, uv + shift).rgb;
      float highlight = smoothstep(.07, .64, light) * smoothstep(.018, .21, chroma);
      carried *= 1.0 + .14 * highlight * sin(wave - .3);
      gl_FragColor = vec4(carried, smoothstep(.018, .73, flow));
    }
  `;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('Shader indisponível');
    return shader;
  }

  function texture(gl, unit, source) {
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return tex;
  }

  function offset(position, freeSpace) {
    if (position.endsWith('%')) return freeSpace * parseFloat(position) / 100;
    if (position.endsWith('px')) return parseFloat(position);
    return freeSpace / 2;
  }

  function createEffect() {
    const canvas = document.createElement('canvas');
    canvas.className = 'filament-canvas';
    if (method) canvas.classList.add('method-filament-canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', {
      alpha: true, antialias: false, depth: false, premultipliedAlpha: false,
    });
    if (!gl) return;

    let imageTexture, fieldTexture, phase, frame;
    try {
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
      gl.useProgram(program);
      const corners = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, corners);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      imageTexture = texture(gl, 0, image);
      fieldTexture = texture(gl, 1, makeField());
      gl.uniform1i(gl.getUniformLocation(program, 'uImage'), 0);
      gl.uniform1i(gl.getUniformLocation(program, 'uField'), 1);
      gl.uniform1f(gl.getUniformLocation(program, 'uMethod'), Number(method));
      phase = gl.getUniformLocation(program, 'uPhase');
      frame = gl.getUniformLocation(program, 'uFrame');
    } catch {
      return;
    }

    let raf = 0;
    let lastFrame = 0;
    let visible = true;
    let lost = false;
    image.after(canvas);

    function draw(now) {
      if (lost || preference.matches) return;
      const time = elapsed + (paused ? 0 : now - started);
      gl.uniform1f(phase, (time % duration) / duration * Math.PI * 2);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      canvas.dataset.ready = '';
    }

    function tick(now) {
      raf = 0;
      if (!canRun()) return;
      if (now - lastFrame >= 31) {
        lastFrame = now;
        draw(now);
      }
      raf = requestAnimationFrame(tick);
    }

    function canRun() {
      return !lost && !paused && !preference.matches && visible && !document.hidden;
    }

    function sync() {
      canvas.hidden = lost || preference.matches;
      if (canRun()) {
        if (!raf) raf = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    function fit() {
      if (lost || !image.naturalWidth) return;
      const box = image.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const parent = image.parentElement;
      const origin = parent.getBoundingClientRect();
      const style = getComputedStyle(image);
      const ratio = Math.min(devicePixelRatio, 1.3, Math.sqrt(900_000 / (box.width * box.height)));
      canvas.style.left = (box.left - origin.left - parent.clientLeft) + 'px';
      canvas.style.top = (box.top - origin.top - parent.clientTop) + 'px';
      canvas.style.width = box.width + 'px';
      canvas.style.height = box.height + 'px';
      canvas.style.maskImage = style.maskImage;
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);

      const sx = box.width / image.naturalWidth;
      const sy = box.height / image.naturalHeight;
      const scale = style.objectFit === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
      const stretched = style.objectFit === 'fill';
      const width = stretched ? box.width : image.naturalWidth * scale;
      const height = stretched ? box.height : image.naturalHeight * scale;
      const [x = '50%', y = '50%'] = style.objectPosition.split(' ');
      gl.uniform4f(frame, box.width / width, box.height / height,
        -offset(x, box.width - width) / width, -offset(y, box.height - height) / height);
      draw(performance.now());
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(image);
    const resize = new ResizeObserver(fit);
    resize.observe(image);
    document.addEventListener('visibilitychange', sync);
    image.addEventListener('load', () => {
      if (lost) return;
      for (const [unit, tex, source] of [[0, imageTexture, image], [1, fieldTexture, makeField()]]) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      }
      fit();
    });
    canvas.addEventListener('webglcontextlost', () => {
      lost = true;
      resize.disconnect();
      observer.disconnect();
      sync();
    });
    fit();
    sync();
    return { sync };
  }

})();
