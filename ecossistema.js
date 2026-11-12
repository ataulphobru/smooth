'use strict';

(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'smooth-magnetita-paused';
  const fallbackName = 'smooth:magnetita:movimento-pausado';

  if (document.body.classList.contains('magnet-home')
    && new URLSearchParams(location.search).get('boot') === '1') {
    document.body.setAttribute('data-boot', '');
  }

  const sectors = [...document.querySelectorAll('main > :is(header, section, article, div, aside)')];
  for (const sector of sectors) {
    sector.classList.add('v20-sector');
    sector.setAttribute('data-depth', '');
    for (const layerName of ['v20-seam', 'v20-ambient', 'v20-optics']) {
      const layer = document.createElement('span');
      layer.className = layerName;
      layer.setAttribute('aria-hidden', 'true');
      sector.append(layer);
    }
  }

  const sectorObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      entry.target.classList.toggle('is-in-view', entry.isIntersecting);
    }
  }, { rootMargin: '0px 0px -7% 0px' });

  for (const sector of sectors) sectorObserver.observe(sector);

  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.site-nav');
    if (!nav) return;
    document.documentElement.style.setProperty('--filament-phase', (-Date.now() % 24_000 / 1000) + 's');

    let paused;
    try { paused = sessionStorage.getItem(storageKey) === 'true'; }
    catch { paused = window.name === fallbackName; }

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'filament-toggle';
    toggle.setAttribute('aria-label', 'Pausar movimento');
    nav.append(toggle);

    function sync() {
      const shouldPause = paused || reduce.matches;
      if (shouldPause) clearReflection();
      toggle.hidden = reduce.matches;
      toggle.title = paused ? 'Retomar movimento' : 'Pausar movimento';
      toggle.setAttribute('aria-pressed', String(paused));
      document.body.classList.toggle('filament-motion-paused', shouldPause);
      document.dispatchEvent(new CustomEvent('magnetita:motion', { detail: shouldPause }));
    }

    toggle.addEventListener('click', () => {
      paused = !paused;
      try { sessionStorage.setItem(storageKey, String(paused)); }
      catch {
        // Alguns contextos de prévia bloqueiam sessionStorage. Guarde só este sinal.
        if (!window.name || window.name === fallbackName) window.name = paused ? fallbackName : '';
      }
      sync();
    });
    reduce.addEventListener('change', sync);
    sync();
  });

  const hover = matchMedia('(hover: hover) and (pointer: fine)');
  let surface = null;
  let pointer = null;
  let reflectionFrame = 0;

  document.addEventListener('pointermove', (event) => {
    if (!hover.matches || reduce.matches || event.pointerType === 'touch'
      || document.body.classList.contains('filament-motion-paused')
      || !(event.target instanceof Element)) return;

    const nextSurface = event.target.closest('.eco-panel, [data-specular], [data-depth]');
    if (nextSurface !== surface) {
      surface?.removeAttribute('data-lit');
      surface = nextSurface;
    }
    if (!surface) return;

    pointer = { x: event.clientX, y: event.clientY };
    if (!reflectionFrame) reflectionFrame = requestAnimationFrame(() => {
      reflectionFrame = 0;
      if (!surface) return;

      const bounds = surface.getBoundingClientRect();
      const x = pointer.x - bounds.left;
      const y = pointer.y - bounds.top;
      surface.style.setProperty('--reflection-x', x + 'px');
      surface.style.setProperty('--reflection-y', y + 'px');
      if (surface.hasAttribute('data-depth') && bounds.width && bounds.height) {
        surface.style.setProperty('--optics-x', ((x / bounds.width - .5) * 28) + 'px');
        surface.style.setProperty('--optics-y', ((y / bounds.height - .5) * 16) + 'px');
      }
      surface.setAttribute('data-lit', '');
    });
  }, { passive: true });

  function clearReflection() {
    surface?.removeAttribute('data-lit');
    surface = null;
  }

  document.documentElement.addEventListener('pointerleave', clearReflection);
  addEventListener('scroll', clearReflection, { passive: true });

  let navigating = false;
  addEventListener('pageshow', () => {
    navigating = false;
    document.body.classList.remove('eco-header-charge');
  });

  document.addEventListener('click', (event) => {
    if (reduce.matches || event.defaultPrevented || event.button !== 0
      || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
      || !(event.target instanceof Element)) return;

    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || link.target
      || link.matches('.skip-link, .skip')) return;
    const target = new URL(link.href);
    if (!['http:', 'https:', 'file:'].includes(target.protocol)
      || target.protocol !== location.protocol || target.host !== location.host
      || (target.pathname === location.pathname && target.search === location.search)) return;

    event.preventDefault();
    if (navigating) return;
    navigating = true;
    document.body.classList.add('eco-header-charge');
    setTimeout(() => location.assign(target.href), 110);
  });
})();

