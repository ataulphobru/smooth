'use strict';

(() => {
  const canvas = document.querySelector('.method-rail-canvas');
  const art = canvas?.closest('.method-art');
  const context = canvas?.getContext('2d');
  if (!art || !context) return;

  const width = 1672;
  const height = 941;
  const meet = { x: 1586, y: 143 };
  const travel = 3600;
  const cycle = 5050;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // Os trilhos foram medidos na foto original. Só a luz usa estas curvas.
  const tracks = [
    createTrack('186, 112, 255', [
      [275, 694], [320, 681], [380, 658], [440, 632], [480, 610],
      [520, 577], [540, 552], [560, 522], [580, 482], [600, 440],
      [620, 411], [640, 386], [660, 367], [680, 350], [700, 335],
      [720, 321], [760, 295], [800, 274], [840, 255], [880, 239],
      [920, 222], [960, 208], [1000, 194], [1040, 181], [1080, 170],
      [1120, 160], [1160, 151], [1200, 142], [1240, 134], [1280, 129],
      [1320, 123], [1360, 119], [1400, 117], [1460, 116], [1500, 121],
      [1540, 126], [1568, 133], [meet.x, meet.y],
    ]),
    createTrack('255, 128, 49', [
      [640, 734], [680, 711], [720, 688], [770, 659], [820, 629],
      [880, 588], [940, 554], [1000, 519], [1060, 484], [1120, 448],
      [1180, 413], [1240, 380], [1300, 348], [1360, 310], [1420, 273],
      [1480, 231], [1510, 209], [1540, 188], [1570, 163], [meet.x, meet.y],
    ]),
  ];

  function createTrack(color, coordinates) {
    let length = 0;
    const points = coordinates.map(([x, y], index) => {
      if (index) {
        const [previousX, previousY] = coordinates[index - 1];
        length += Math.hypot(x - previousX, y - previousY);
      }
      return { x, y, distance: length };
    });
    return { color, points, length };
  }

  function pointAt(track, distance) {
    const endIndex = track.points.findIndex(point => point.distance >= distance);
    if (endIndex === 0) return track.points[0];
    if (endIndex < 0) return meet;

    const before = track.points[endIndex - 1];
    const after = track.points[endIndex];
    const ratio = (distance - before.distance) / (after.distance - before.distance);
    return {
      x: before.x + (after.x - before.x) * ratio,
      y: before.y + (after.y - before.y) * ratio,
    };
  }

  function glow(point, radius, color, strength) {
    const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
    gradient.addColorStop(0, 'rgba(255, 248, 237, ' + strength + ')');
    gradient.addColorStop(.24, 'rgba(' + color + ', ' + (strength * .58) + ')');
    gradient.addColorStop(1, 'rgba(' + color + ', 0)');
    context.fillStyle = gradient;
    context.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2);
  }

  function drawTrain(track, distance, strength, tailLength) {
    if (distance <= 0 || strength <= 0) return;
    const start = Math.max(0, distance - tailLength);
    const from = pointAt(track, start);
    const head = pointAt(track, distance);
    if (from.x === head.x && from.y === head.y) return;
    context.beginPath();
    context.moveTo(from.x, from.y);
    for (const point of track.points) {
      if (point.distance > start && point.distance < distance) context.lineTo(point.x, point.y);
    }
    context.lineTo(head.x, head.y);

    const trail = context.createLinearGradient(from.x, from.y, head.x, head.y);
    trail.addColorStop(0, 'rgba(' + track.color + ', 0)');
    trail.addColorStop(.38, 'rgba(' + track.color + ', ' + (strength * .25) + ')');
    trail.addColorStop(1, 'rgba(' + track.color + ', ' + (strength * .85) + ')');
    context.strokeStyle = trail;
    context.lineWidth = 11;
    context.stroke();
    context.lineWidth = 22;
    context.globalAlpha = .22;
    context.stroke();
    context.globalAlpha = 1;

    const core = context.createLinearGradient(from.x, from.y, head.x, head.y);
    core.addColorStop(0, 'rgba(' + track.color + ', 0)');
    core.addColorStop(.44, 'rgba(' + track.color + ', ' + (strength * .77) + ')');
    core.addColorStop(1, 'rgba(255, 248, 235, ' + strength + ')');
    context.strokeStyle = core;
    context.lineWidth = 3.6;
    context.stroke();
    glow(head, 21, track.color, strength * .77);
  }

  function paint(time) {
    context.clearRect(0, 0, width, height);
    context.lineJoin = 'round';
    context.lineCap = 'round';
    const progress = Math.min(time / travel, 1);
    const approach = Math.max(0, 1 - Math.max(0, time - travel) / 370);

    tracks.forEach((track, index) => {
      const distance = Math.pow(progress, index === 0 ? .9 : 1.12) * track.length;
      drawTrain(track, distance - track.length * .15, approach * .53, track.length * .14);
      drawTrain(track, distance, approach, track.length * .24);
    });

    const release = (time - travel + 70) / 720;
    if (release > 0 && release < 1) {
      const strength = Math.sin(Math.PI * release) * (1 - release * .48);
      glow(meet, 18 + release * 39, '255, 153, 91', strength);
      glow(meet, 8 + release * 14, '218, 155, 255', strength * .9);
    }
  }

  let frame = 0;
  let lastFrame = 0;
  let elapsed = 980;
  let paused = true;
  let visible = false;

  function resize() {
    const bounds = art.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const ratio = Math.min(devicePixelRatio, 1.7);
    canvas.width = Math.ceil(bounds.width * ratio);
    canvas.height = Math.ceil(bounds.height * ratio);
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    if (!paused && !reduced.matches) paint(elapsed);
  }

  function sync() {
    canvas.hidden = reduced.matches;
    if (paused || !visible || document.hidden || reduced.matches) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
    } else if (!frame) {
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    if (!lastFrame || now - lastFrame >= 31) {
      if (lastFrame) elapsed = (elapsed + Math.min(now - lastFrame, 85)) % cycle;
      lastFrame = now;
      paint(elapsed);
    }
    frame = requestAnimationFrame(tick);
  }

  new ResizeObserver(resize).observe(art);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(art);
  document.addEventListener('visibilitychange', sync);
  document.addEventListener('magnetita:motion', ({ detail }) => {
    paused = detail;
    sync();
  });
  reduced.addEventListener('change', sync);
  resize();
})();
