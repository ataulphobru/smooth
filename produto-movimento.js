'use strict';

(() => {
  const canvas = document.querySelector('.product-signal');
  const context = canvas?.getContext('2d');
  if (!context) return;

  const sourceWidth = 1536;
  const sourceHeight = 1024;
  // Os pontos acompanham os centros das duas trilhas na foto original.
  const routes = [
    {
      color: '255, 123, 41', tip: '255, 233, 181', launch: .57, travel: 3.06,
      points: [[465, 543], [478, 542], [596, 542], [608, 541], [625, 535],
        [680, 508], [694, 503], [726, 503], [739, 501], [748, 496],
        [842, 444], [854, 441], [1096, 439.5], [1106, 440], [1117, 443],
        [1252, 508], [1267, 512], [1298, 514]]
    },
    {
      color: '179, 100, 255', tip: '237, 204, 255', launch: .94, travel: 3.27,
      points: [[465, 543], [487, 554], [583, 612], [601, 621], [634, 622],
        [648, 629], [664, 632], [678, 630], [713, 621], [908, 620.5],
        [921, 619], [931, 615], [992, 589], [1004, 587.5], [1122, 588],
        [1133, 585], [1142, 581], [1250, 523], [1267, 517], [1298, 515]]
    },
    {
      color: '146, 191, 220', tip: '223, 244, 255', launch: 1.06, travel: 2.42, spill: .14,
      points: [[465, 543], [1298, 515]]
    }
  ];

  for (const route of routes) {
    route.distances = [0];
    for (let index = 1; index < route.points.length; index++) {
      const [x, y] = route.points[index];
      const [previousX, previousY] = route.points[index - 1];
      route.distances.push(route.distances[index - 1] + Math.hypot(x - previousX, y - previousY));
    }
    route.length = route.distances.at(-1);
  }

  function pointAt(route, distance) {
    const index = Math.max(1, route.distances.findIndex(mark => mark >= distance));
    const [startX, startY] = route.points[index - 1];
    const [endX, endY] = route.points[index];
    const portion = (distance - route.distances[index - 1]) /
      (route.distances[index] - route.distances[index - 1]);
    return [startX + (endX - startX) * portion, startY + (endY - startY) * portion];
  }

  function stroke(route, start, end) {
    const [startX, startY] = pointAt(route, start);
    context.beginPath();
    context.moveTo(startX, startY);
    for (let index = 1; index < route.points.length; index++) {
      const distance = route.distances[index];
      if (distance > start && distance < end) context.lineTo(...route.points[index]);
    }
    context.lineTo(...pointAt(route, end));
    context.stroke();
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let visible = false;
  let frame = 0;
  let previousFrame;
  let elapsed = 1.23;
  let scale = 1;

  const glass = new Path2D();
  glass.moveTo(365, 648);
  glass.lineTo(482, 516);
  glass.lineTo(625, 427);
  glass.lineTo(1381, 353);
  glass.lineTo(1404, 382);
  glass.lineTo(1219, 646);
  glass.closePath();

  function envelope(time, start, peak, end) {
    const rise = (time - start) / (peak - start);
    const fall = (end - time) / (end - peak);
    const amount = Math.max(0, Math.min(rise, fall, 1));
    return amount * amount * (3 - 2 * amount);
  }

  function glow(x, y, radius, color, strength) {
    if (strength <= 0) return;
    const fill = context.createRadialGradient(x, y, 0, x, y, radius);
    fill.addColorStop(0, 'rgba(' + color + ', ' + strength + ')');
    fill.addColorStop(.32, 'rgba(' + color + ', ' + strength * .51 + ')');
    fill.addColorStop(1, 'rgba(' + color + ', 0)');
    context.fillStyle = fill;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function drawPulse(route, head, tail, core) {
    for (let segment = 0; segment < 14; segment++) {
      const fraction = (segment + 1) / 14;
      const start = Math.max(0, head - tail + tail * segment / 14);
      const end = Math.min(route.length, head - tail + tail * fraction);
      if (start >= end) continue;

      const strength = fraction ** 1.6;
      context.lineWidth = core * 4.3;
      context.strokeStyle = 'rgba(' + route.color + ', ' + strength * .21 + ')';
      stroke(route, start, end);
      context.lineWidth = core * 2.15;
      context.strokeStyle = 'rgba(' + route.color + ', ' + strength * .45 + ')';
      stroke(route, start, end);
      context.lineWidth = core;
      context.strokeStyle = 'rgba(' + (segment > 7 ? route.tip : route.color) + ', ' + strength * .94 + ')';
      stroke(route, start, end);
    }
  }

  function render() {
    context.clearRect(310, 330, 1140, 435);
    const tail = 242;
    const core = Math.max(4.4, 1.2 / scale);
    const time = elapsed % 5.85;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.save();
    context.clip(glass);
    for (const route of routes) {
      const head = (time - route.launch) * route.length / route.travel;
      if (head >= 0 && head <= route.length) {
        const [x, y] = pointAt(route, head);
        glow(x, y, Math.max(90, 17 / scale), route.color, route.spill ?? .34);
      }
      const reflection = envelope(time, route.launch - .48, route.launch + .11, route.launch + .71);
      glow(489, 554, 88, route.color, reflection * .4);
      const arrival = route.launch + route.travel;
      glow(1280, 518, 89, route.color, envelope(time, arrival - .22, arrival + .13, arrival + .76) * .43);
    }
    context.restore();

    for (const route of routes) {
      const head = (time - route.launch) * route.length / route.travel;
      if (head >= 0 && head <= route.length + tail) drawPulse(route, head, tail, core);
      if (head >= 0 && head <= route.length) {
        const [x, y] = pointAt(route, head);
        glow(x, y, Math.max(25, 5.2 / scale), route.color, .58);
        glow(x, y, Math.max(10, 2.4 / scale), route.tip, .92);
      }
    }

    const charge = envelope(time, 0, .68, 1.53);
    glow(465, 543, Math.max(36, 8 / scale), routes[0].color, charge * .64);
    glow(465, 543, Math.max(13, 3 / scale), routes[0].tip, charge * .87);

    const arrival = envelope(time, 3.3, 3.71, 4.21);
    const convergence = envelope(time, 3.84, 4.29, 5.03);
    glow(1298, 515, Math.max(33, 7 / scale), routes[0].color, arrival * .60);
    glow(1298, 515, Math.max(38, 8 / scale), routes[1].color, convergence * .68);
    glow(1298, 515, Math.max(13, 3 / scale), '255, 231, 232', Math.max(arrival, convergence) * .82);
  }

  function resize() {
    const width = canvas.getBoundingClientRect().width;
    if (!width) return;
    scale = width / sourceWidth;
    const density = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * density);
    canvas.height = Math.round(canvas.width * sourceHeight / sourceWidth);
    context.setTransform(canvas.width / sourceWidth, 0, 0, canvas.height / sourceHeight, 0, 0);
    if (visible && !reduced.matches) render();
  }

  function tick(time) {
    if (previousFrame !== undefined) elapsed += Math.min(50, time - previousFrame) / 1000;
    previousFrame = time;
    render();
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    if (visible && !paused && !reduced.matches && !document.hidden) {
      if (!frame) frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
      frame = 0;
      previousFrame = undefined;
    }
  }

  const viewport = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  viewport.observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  reduced.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('magnetita:motion', event => {
    paused = event.detail;
    sync();
  });
  resize();
})();
