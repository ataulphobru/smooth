'use strict';

(() => {
  const figure = document.querySelector('.core-figure');
  const image = figure?.querySelector('.core-image img');
  const canvas = figure?.querySelector('.core-inspection');
  if (!image || !canvas) return;

  const paint = canvas.getContext('2d');
  if (!paint) return;

  const pins = [...figure.querySelectorAll('.core-pin')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const secondsPerStage = 2.7;
  let time = .13;
  let activeStage = -1;
  let frame = 0;
  let lastFrame = 0;
  let visible = false;
  let paused = document.body.classList.contains('filament-motion-paused');

  // Coordenadas normalizadas da foto, sem alterar sua escala nem sua textura.
  const titanium = new Path2D();
  const surface = [
    [0,.655],[.13,.581],[.28,.517],[.44,.464],[.53,.425],[.57,.393],
    [.591,.366],[.594,.349],[.586,.330],[.546,.304],[.61,.32],[.674,.333],
    [.722,.355],[.739,.382],[.731,.418],[.702,.457],[.656,.493],[.594,.534],
    [.531,.561],[.425,.610],[.304,.679],[.165,.748],[0,.825],
  ];
  surface.forEach(([x,y],index) => index ? titanium.lineTo(x,y) : titanium.moveTo(x,y));
  titanium.closePath();

  const violet = route([
    [.50,.589],[.58,.555],[.663,.513],[.731,.473],[.803,.445],[.868,.410],
    [.918,.381],[.944,.367],[.925,.349],[.901,.343],[.858,.338],[.812,.332],
    [.760,.327],[.707,.322],[.646,.317],[.589,.308],
  ]);
  const ember = route([
    [.463,.980],[.531,.931],[.604,.876],[.674,.816],[.736,.750],
    [.792,.705],[.842,.676],[.867,.656],
  ]);

  function route(points) {
    const distance = [0];
    for (let i = 1; i < points.length; i++) {
      const [x0,y0] = points[i - 1];
      const [x1,y1] = points[i];
      distance.push(distance[i - 1] + Math.hypot((x1 - x0) * 1.5, y1 - y0));
    }
    return progress => {
      const target = Math.min(1, Math.max(0, progress)) * distance.at(-1);
      const end = Math.max(1, distance.findIndex(value => value >= target));
      const ratio = (target - distance[end - 1]) / (distance[end] - distance[end - 1]);
      const [x0,y0] = points[end - 1];
      const [x1,y1] = points[end];
      return [(x0 + (x1 - x0) * ratio) * canvas.width, (y0 + (y1 - y0) * ratio) * canvas.height];
    };
  }

  function fit() {
    const box = image.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const scale = Math.min(devicePixelRatio, 1.65, Math.sqrt(950_000 / (box.width * box.height)));
    const width = Math.round(box.width * scale);
    const height = Math.round(box.height * scale);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      draw();
    }
    sync();
  }

  function scan(progress) {
    const {width, height} = canvas;
    const x = width * (.08 + .76 * progress);
    const half = width * .12;
    const light = paint.createLinearGradient(x - half, height * .45, x + half, height * .58);
    light.addColorStop(0, 'transparent');
    light.addColorStop(.27, '#a99ac724');
    light.addColorStop(.47, '#e3ebff76');
    light.addColorStop(.51, '#fff9f3cc');
    light.addColorStop(.55, '#fff8f37c');
    light.addColorStop(.67, '#c6b0e942');
    light.addColorStop(1, 'transparent');

    paint.save();
    paint.scale(width,height);
    paint.clip(titanium);
    paint.resetTransform();
    paint.globalAlpha = Math.min(1, progress * 10, (1 - progress) * 9);
    paint.fillStyle = light;
    paint.fillRect(0,0,width,height);
    paint.restore();
  }

  function signal(getPoint, progress, rgb, white, depth) {
    const {width} = canvas;
    const [r,g,b] = rgb;
    const power = Math.min(1, progress * 12, (1 - progress) * 8);
    const tail = .31;
    paint.save();
    paint.globalCompositeOperation = 'lighter';

    for (let i = 0; i < 30; i++) {
      const fraction = i / 30;
      const position = progress - tail * fraction;
      if (position <= 0) break;
      const [x,y] = getPoint(position);
      const opacity = power * (1 - fraction) ** 1.45;
      const radius = width * depth * (1 - .48 * fraction);
      const glow = paint.createRadialGradient(x,y,0,x,y,radius);
      glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${opacity * .31})`);
      glow.addColorStop(.31, `rgba(${r}, ${g}, ${b}, ${opacity * .13})`);
      glow.addColorStop(1, 'transparent');
      paint.fillStyle = glow;
      paint.fillRect(x-radius,y-radius,radius*2,radius*2);
    }

    paint.lineCap = 'round';
    for (let i = 0; i < 24; i++) {
      const start = progress - tail * (i + 1) / 24;
      if (start < 0) break;
      const end = progress - tail * i / 24;
      const [x0,y0] = getPoint(start);
      const [x1,y1] = getPoint(end);
      const opacity = power * (1 - i / 24) ** 1.5;
      paint.beginPath();
      paint.moveTo(x0,y0);
      paint.lineTo(x1,y1);
      paint.lineWidth = Math.max(1.3, width * .0047);
      paint.strokeStyle = white;
      paint.globalAlpha = opacity * .85;
      paint.stroke();
    }
    paint.restore();
  }

  function draw() {
    const stage = Math.floor(time / secondsPerStage);
    const progress = (time % secondsPerStage) / secondsPerStage;
    if (stage !== activeStage) {
      activeStage = stage;
      figure.dataset.inspection = String(stage);
      pins.forEach((pin,index) => pin.setAttribute('aria-pressed', String(index === stage)));
    }
    paint.clearRect(0,0,canvas.width,canvas.height);
    if (reduced.matches) return;
    if (stage === 0) scan(progress);
    else if (stage === 1) signal(violet,progress,[175,68,255],'#f4d9ff',.043);
    else signal(ember,progress,[255,105,32],'#fff0c5',.057);
  }

  function canMove() {
    return visible && !paused && !reduced.matches && !document.hidden;
  }

  function sync() {
    if (canMove() && !frame) {
      lastFrame = 0;
      frame = requestAnimationFrame(tick);
    } else if (!canMove() && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  function tick(now) {
    frame = 0;
    if (!canMove()) return;
    const delta = now - (lastFrame || now - 28);
    if (delta >= 27) {
      time = (time + Math.min(delta, 70) / 1000) % (pins.length * secondsPerStage);
      lastFrame = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }

  pins.forEach((pin,index) => pin.addEventListener('click', () => {
    time = index * secondsPerStage + (paused ? .42 : .12) * secondsPerStage;
    draw();
  }));
  new ResizeObserver(fit).observe(image);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, {threshold:.08}).observe(image);
  document.addEventListener('magnetita:motion', event => {
    paused = Boolean(event.detail);
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => { draw(); sync(); });
  fit();
  draw();
})();

