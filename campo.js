'use strict';

(() => {
  const canvas = document.querySelector('.magnet-field');
  const hero = canvas?.closest('.magnet-hero');
  const context = canvas?.getContext('2d');
  if (!hero || !context) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: .4, y: .7, targetX: .4, targetY: .7, strength: 0, targetStrength: 0 };
  const pointsPerLine = 41;
  const maxPixels = 570_000;
  let width = 0;
  let height = 0;
  let clock = 0;
  let previousFrame = 0;
  let request = 0;
  let visible = false;

  const art = hero.querySelector('.magnet-art');
  const emblem = art?.querySelector('img');
  const illumination = document.createElement('canvas');
  const light = illumination.getContext('2d');
  illumination.className = 'magnet-conduction';
  illumination.setAttribute('aria-hidden', 'true');
  if (emblem && light) art.append(illumination);

  const violetTrace = buildTrace([
    [.205, .749], [.285, .711], [.346, .671], [.400, .625], [.432, .565],
    [.452, .509], [.455, .447], [.469, .373], [.484, .320], [.520, .285],
    [.578, .263], [.632, .222], [.686, .193], [.743, .165], [.803, .151],
    [.864, .134], [.924, .121], [.958, .118],
  ]);
  const emberTrace = buildTrace([
    [.626, .777], [.661, .757], [.699, .735], [.735, .714],
    [.769, .695], [.795, .676], [.815, .659],
  ]);

  function buildTrace(points) {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      lengths.push(lengths[i - 1] + Math.hypot((x1 - x0) * 1.776, y1 - y0));
    }
    const total = lengths.at(-1);
    return progress => {
      const position = Math.max(0, Math.min(progress, 1)) * total;
      const index = Math.max(1, lengths.findIndex(distance => distance >= position));
      const blend = (position - lengths[index - 1]) / (lengths[index] - lengths[index - 1]);
      const [x0, y0] = points[index - 1];
      const [x1, y1] = points[index];
      return [(x0 + (x1 - x0) * blend) * illumination.width, (y0 + (y1 - y0) * blend) * illumination.height];
    };
  }

  function fitIllumination() {
    if (!emblem || !light || !emblem.clientWidth || !emblem.clientHeight) return;
    const scale = Math.min(devicePixelRatio, 1.35, Math.sqrt(800_000 / (emblem.clientWidth * emblem.clientHeight)));
    const targetWidth = Math.round(emblem.clientWidth * scale);
    const targetHeight = Math.round(emblem.clientHeight * scale);
    if (illumination.width !== targetWidth || illumination.height !== targetHeight) {
      illumination.width = targetWidth;
      illumination.height = targetHeight;
    }
    renderIllumination();
  }

  function renderIllumination() {
    if (!emblem || !light || reduced.matches) return;
    const { width: w, height: h } = illumination;
    light.clearRect(0, 0, w, h);
    const scale = w / 1260;
    const time = (clock + .3) % 7.2;
    illuminate(emberTrace, (time - .08) / 2.28, [255, 113, 37], '#fff2cd', 25 * scale, .98, .17);
    illuminate(violetTrace, (time - .56) / 3.88, [159, 66, 255], '#f5e8ff', 30 * scale, .88, .13);
    illuminate(violetTrace, (time - 2.77) / 3.42, [111, 50, 224], '#dfc6ff', 19 * scale, .59, .105);
    illuminate(emberTrace, (time - 4.36) / 1.92, [255, 128, 48], '#ffdfaa', 20 * scale, .7, .19);
  }

  function illuminate(trace, progress, color, core, radius, strength, tailLength) {
    if (progress <= 0 || progress >= 1.06) return;
    const power = strength * Math.min(1, progress * 11, (1.06 - progress) * 13);
    const [r, g, b] = color;
    const layers = 11;
    for (let step = 0; step < layers; step++) {
      const trail = step / layers;
      const distance = progress - tailLength * trail;
      if (distance < 0 || distance > 1) continue;
      const [x, y] = trace(distance);
      const spread = Math.max(2, radius * (1 - trail * .55));
      const alpha = power * (1 - trail) ** 1.6;
      const halo = light.createRadialGradient(x, y, 0, x, y, spread);
      halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * .61})`);
      halo.addColorStop(.35, `rgba(${r}, ${g}, ${b}, ${alpha * .27})`);
      halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      light.fillStyle = halo;
      light.fillRect(x - spread, y - spread, spread * 2, spread * 2);
    }

    const [x, y] = trace(progress);
    const spread = Math.max(1.5, radius * .21);
    const glow = light.createRadialGradient(x, y, 0, x, y, spread);
    glow.addColorStop(0, core);
    glow.addColorStop(.22, `rgba(${r}, ${g}, ${b}, .85)`);
    glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    light.globalAlpha = power;
    light.fillStyle = glow;
    light.fillRect(x - spread, y - spread, spread * 2, spread * 2);
    light.globalAlpha = 1;
  }


  function measure() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (!width || !height) {
      sync();
      return;
    }
    const scale = Math.min(devicePixelRatio, 1.35, Math.sqrt(maxPixels / (width * height)));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    render();
    sync();
  }

  function placePoint(lane, phase, t, compact) {
    const remainder = 1 - t;
    const first = remainder * remainder * remainder;
    const second = 3 * remainder * remainder * t;
    const third = 3 * remainder * t * t;
    const last = t * t * t;
    const curl = Math.sin(t * 7.9 - clock * .44 + phase) * Math.sin(t * Math.PI);
    let x = first * (-.13 + lane * .04) + second * (.11 + lane * .16)
      + third * (.46 - lane * .065) + last * (1.04 + lane * .045);
    let y = first * (.89 + lane * .11) + second * (.91 - lane * .06)
      + third * (.76 - lane * .51) + last * (.53 + lane * .12);

    x += curl * .023;
    y += curl * .048 + Math.sin(t * 12.6 - clock * .68 + lane * 4) * .013;
    if (compact) {
      y = .38 + y * .34;
      x = x * .96;
    }

    const dx = pointer.x - x;
    const dy = pointer.y - y;
    const distanceSquared = dx * dx + dy * dy;
    const pull = pointer.strength * Math.exp(-distanceSquared * 11) * Math.sin(t * Math.PI);
    x += pull * (dx * .60 - dy * .32);
    y += pull * (dy * .85 + dx * .39);

    return [x * width, y * height];
  }

  function render() {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    const compact = width < 560;
    const count = compact ? 16 : 26;
    const violet = context.createLinearGradient(0, height * .91, width, height * .54);
    violet.addColorStop(0, 'rgba(62, 26, 104, 0)');
    violet.addColorStop(.20, 'rgba(106, 51, 166, .23)');
    violet.addColorStop(.53, 'rgba(158, 100, 231, .58)');
    violet.addColorStop(.81, 'rgba(208, 173, 255, .44)');
    violet.addColorStop(1, 'rgba(185, 144, 249, 0)');
    const metal = context.createLinearGradient(0, height * .94, width, height * .55);
    metal.addColorStop(0, 'rgba(74, 32, 130, 0)');
    metal.addColorStop(.34, 'rgba(144, 91, 213, .44)');
    metal.addColorStop(.64, 'rgba(213, 193, 248, .76)');
    metal.addColorStop(.88, 'rgba(224, 177, 240, .35)');
    metal.addColorStop(1, 'rgba(206, 141, 246, 0)');

    for (let index = 0; index < count; index++) {
      const lane = index / (count - 1) * 2 - 1;
      const phase = index * .31;
      const crest = .5 + .5 * Math.sin(clock * .55 + phase);
      context.beginPath();
      for (let step = 0; step < pointsPerLine; step++) {
        const [x, y] = placePoint(lane, phase, step / (pointsPerLine - 1), compact);
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      const etched = index % 6 === 2;
      context.strokeStyle = etched ? metal : violet;
      context.lineWidth = (etched ? 1.13 : .55) + crest * .26;
      context.globalAlpha = (etched ? .7 : .44) + crest * .18 + pointer.strength * .11;
      context.stroke();

      if (!etched) continue;
      const progress = (clock * .069 + index * .151) % 1;
      const pulse = Math.sin(progress * Math.PI) ** 2;
      const [x, y] = placePoint(lane, phase, progress, compact);
      const radius = 3.5 + pulse * 3.5;
      const ember = index % 4 === 0;
      const flare = context.createRadialGradient(x, y, 0, x, y, radius);
      flare.addColorStop(0, ember ? '#fff1ce' : '#ede0ff');
      flare.addColorStop(.23, ember ? '#ff9e59' : '#bf8dff');
      flare.addColorStop(1, ember ? 'rgba(255,111,54,0)' : 'rgba(154,90,238,0)');
      context.globalAlpha = pulse * .75;
      context.fillStyle = flare;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    context.globalAlpha = 1;
    renderIllumination();
  }

  function canMove() {
    return width > 0 && height > 0 && visible && !document.hidden && !reduced.matches
      && !document.body.classList.contains('filament-motion-paused');
  }

  function nextFrame(now) {
    request = 0;
    if (!canMove()) return;
    const delta = now - (previousFrame || now - 32);
    if (delta >= 31) {
      const seconds = Math.min(delta, 64) / 1000;
      const easing = 1 - Math.exp(-seconds * 6);
      clock += seconds;
      previousFrame = now;
      pointer.x += (pointer.targetX - pointer.x) * easing;
      pointer.y += (pointer.targetY - pointer.y) * easing;
      pointer.strength += (pointer.targetStrength - pointer.strength) * easing;
      render();
    }
    request = requestAnimationFrame(nextFrame);
  }

  function sync() {
    if (canMove() && !request) {
      previousFrame = 0;
      request = requestAnimationFrame(nextFrame);
    } else if (!canMove() && request) {
      cancelAnimationFrame(request);
      request = 0;
    }
  }

  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || reduced.matches) return;
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    pointer.targetX = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    pointer.targetY = Math.max(.26, Math.min(.96, (event.clientY - box.top) / box.height));
    pointer.targetStrength = event.clientX <= box.right ? 1 : 0;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.targetStrength = 0; });
  new ResizeObserver(measure).observe(canvas);
  if (emblem) new ResizeObserver(fitIllumination).observe(emblem);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }).observe(hero);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  measure();
})();
