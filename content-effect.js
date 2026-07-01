(() => {
  const OVERLAY_CLASS = 'ace-neon-element-border';
  const STYLE_ID = 'ace-neon-element-border-styles';
  const BUTTON_SELECTOR = [
    'button',
    "input[type='button']",
    "input[type='submit']",
    "input[type='reset']",
    "[role='button']",
  ].join(',');

  const DEFAULT_OPTIONS = {
    modifierKey: 'Control',
    colorTheme: 'blue',
    clickEnabled: true,
    randomColor: false,
    intensity: 85,
    contrast: 80,
    thickness: 3,
    borderGap: 5,
    speed: 75,
  };

  const THEMES = {
    blue: {
      main: '#42e8ff',
      bright: '#f2ffff',
      soft: 'rgba(0, 209, 255, 0.32)',
      glow: 'rgba(0, 209, 255, 0.95)',
    },
    cyan: {
      main: '#48ffd5',
      bright: '#ecfff9',
      soft: 'rgba(72, 255, 213, 0.28)',
      glow: 'rgba(72, 255, 213, 0.9)',
    },
    violet: {
      main: '#b68cff',
      bright: '#fbf6ff',
      soft: 'rgba(182, 140, 255, 0.3)',
      glow: 'rgba(182, 140, 255, 0.9)',
    },
    emerald: {
      main: '#56ff94',
      bright: '#f1fff6',
      soft: 'rgba(86, 255, 148, 0.27)',
      glow: 'rgba(86, 255, 148, 0.88)',
    },
    rose: {
      main: '#ff6fb1',
      bright: '#fff4fb',
      soft: 'rgba(255, 111, 177, 0.28)',
      glow: 'rgba(255, 111, 177, 0.9)',
    },
    gold: {
      main: '#ffd45a',
      bright: '#fffbed',
      soft: 'rgba(255, 212, 90, 0.26)',
      glow: 'rgba(255, 212, 90, 0.88)',
    },
  };

  const MIN_SIZE = 8;
  const MAX_SCREEN_COVERAGE = 0.92;
  const THEME_KEYS = Object.keys(THEMES);
  let options = { ...DEFAULT_OPTIONS };
  let lastRandomTheme = null;
  let modifierIsDown = false;
  let hoverOverlay = null;
  let hoverTarget = null;
  let lastPointer = { x: 0, y: 0 };
  let hoverFrame = 0;
  let pendingPointerFrame = 0;
  let trackedFrame = 0;
  const trackedEffects = new Map();

  function fadeDurationMs() {
    const speedFactor = 75 / Math.max(35, options.speed);
    return Math.ceil(1500 * speedFactor);
  }

  function storageGet(defaults) {
    return new Promise((resolve) => {
      chrome.storage.sync.get(defaults, resolve);
    });
  }

  async function loadOptions() {
    const result = await storageGet({ aceOptions: DEFAULT_OPTIONS });
    options = { ...DEFAULT_OPTIONS, ...result.aceOptions };
    applyOptions(hoverOverlay);
  }

  function applyOptions(overlay, colorTheme = options.colorTheme) {
    if (!overlay) {
      return;
    }

    const theme = THEMES[colorTheme] || THEMES.blue;
    const speedFactor = 75 / Math.max(35, options.speed);
    const brightness = Math.max(0.6, options.contrast / 80);
    const saturate = Math.max(0.7, options.contrast / 70);

    overlay.style.setProperty('--ace-main', theme.main);
    overlay.style.setProperty('--ace-bright', theme.bright);
    overlay.style.setProperty('--ace-soft', theme.soft);
    overlay.style.setProperty('--ace-glow', theme.glow);
    overlay.style.setProperty(
      '--ace-glow-size',
      `${Math.max(4, options.intensity * 0.32)}px`,
    );
    overlay.style.setProperty(
      '--ace-main-glow-size',
      `${Math.max(3, options.intensity * 0.22)}px`,
    );
    overlay.style.setProperty(
      '--ace-spark-glow-size',
      `${Math.max(4, options.intensity * 0.26)}px`,
    );
    overlay.style.setProperty(
      '--ace-aura-opacity',
      `${Math.min(1, Math.max(0.18, options.intensity / 100))}`,
    );
    overlay.style.setProperty('--ace-brightness', `${brightness}`);
    overlay.style.setProperty('--ace-saturate', `${saturate}`);
    overlay.style.setProperty('--ace-main-stroke', `${options.thickness}`);
    overlay.style.setProperty(
      '--ace-soft-stroke',
      `${options.thickness + Math.max(3, options.intensity * 0.055)}`,
    );
    overlay.style.setProperty(
      '--ace-spark-stroke',
      `${Math.max(1, options.thickness * 0.52 + options.intensity * 0.008)}`,
    );
    overlay.style.setProperty(
      '--ace-corner-size',
      `${Math.max(8, options.intensity * 0.16)}px`,
    );
    overlay.style.setProperty('--ace-draw-duration', `${0.95 * speedFactor}s`);
    overlay.style.setProperty('--ace-fade-duration', `${1.5 * speedFactor}s`);
  }

  function chooseEffectTheme() {
    if (!options.randomColor) {
      lastRandomTheme = options.colorTheme;
      return options.colorTheme;
    }

    const choices = THEME_KEYS.filter((theme) => theme !== lastRandomTheme);
    const theme =
      choices[Math.floor(Math.random() * choices.length)] || options.colorTheme;
    lastRandomTheme = theme;
    return theme;
  }

  function isModifierActive(event) {
    if (!event) {
      return modifierIsDown;
    }

    if (options.modifierKey === 'Control') {
      return event.ctrlKey;
    }

    if (options.modifierKey === 'Shift') {
      return event.shiftKey;
    }

    if (options.modifierKey === 'Alt') {
      return event.altKey;
    }

    return event.metaKey;
  }

  function eventMatchesModifier(event) {
    return event.key === options.modifierKey;
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width >= MIN_SIZE &&
      rect.height >= MIN_SIZE &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      Number(style.opacity) !== 0
    );
  }

  function findButton(start) {
    const element = start instanceof Element ? start : start?.parentElement;
    const button = element?.closest(BUTTON_SELECTOR);

    if (
      !button ||
      !document.documentElement.contains(button) ||
      !isVisible(button)
    ) {
      return null;
    }

    return button;
  }

  function isUsableHoverTarget(element) {
    if (
      !element ||
      !(element instanceof Element) ||
      element === document.documentElement ||
      element === document.body ||
      element.closest?.(`.${OVERLAY_CLASS}`)
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const coversScreen =
      rect.width >= window.innerWidth * MAX_SCREEN_COVERAGE &&
      rect.height >= window.innerHeight * MAX_SCREEN_COVERAGE;

    return isVisible(element) && !coversScreen;
  }

  function findHoverElement(x, y) {
    let element = document.elementFromPoint(x, y);

    while (element && !isUsableHoverTarget(element)) {
      element = element.parentElement;
    }

    return element;
  }

  function borderRadiusFor(element) {
    const style = window.getComputedStyle(element);
    const radius = Number.parseFloat(style.borderTopLeftRadius);
    return Number.isFinite(radius) ? Math.min(radius + effectGap(), 32) : 8;
  }

  function effectGap() {
    return Math.max(0, Math.min(24, Number(options.borderGap) || 0));
  }

  function geometryFor(element) {
    const rect = element.getBoundingClientRect();
    const gap = effectGap();
    const width = rect.width + gap * 2;
    const height = rect.height + gap * 2;

    return {
      left: rect.left - gap,
      top: rect.top - gap,
      width,
      height,
      radius: borderRadiusFor(element),
    };
  }

  function setOverlayGeometry(overlay, geometry, smooth = true) {
    overlay.classList.toggle('is-smooth', smooth);
    overlay.style.setProperty('--ace-width', `${geometry.width}px`);
    overlay.style.setProperty('--ace-height', `${geometry.height}px`);
    overlay.style.setProperty('--ace-radius', `${geometry.radius}px`);
    overlay.style.transform = `translate3d(${geometry.left}px, ${geometry.top}px, 0)`;
    overlay
      .querySelector('svg')
      ?.setAttribute('viewBox', `0 0 ${geometry.width} ${geometry.height}`);

    overlay.querySelectorAll('rect').forEach((rectElement) => {
      rectElement.setAttribute('width', `${Math.max(1, geometry.width)}`);
      rectElement.setAttribute('height', `${Math.max(1, geometry.height)}`);
      rectElement.setAttribute('rx', `${geometry.radius}`);
    });
  }

  function removeTrackedEffect(overlay) {
    const effect = trackedEffects.get(overlay);
    trackedEffects.delete(overlay);
    overlay.remove();
    effect?.onRemove?.();
  }

  function updateTrackedEffects() {
    trackedFrame = 0;

    trackedEffects.forEach((effect, overlay) => {
      if (!document.documentElement.contains(overlay)) {
        trackedEffects.delete(overlay);
        return;
      }

      if (
        !effect.element ||
        !document.documentElement.contains(effect.element) ||
        !isVisible(effect.element)
      ) {
        removeTrackedEffect(overlay);
        return;
      }

      setOverlayGeometry(overlay, geometryFor(effect.element), false);
    });
  }

  function scheduleTrackedEffectsUpdate() {
    if (!trackedFrame && trackedEffects.size) {
      trackedFrame = window.requestAnimationFrame(updateTrackedEffects);
    }
  }

  function trackEffect(overlay, element, durationMs, onRemove) {
    if (!element) {
      window.setTimeout(() => {
        overlay.remove();
        onRemove?.();
      }, durationMs);
      return;
    }

    trackedEffects.set(overlay, { element, onRemove });

    window.setTimeout(() => {
      removeTrackedEffect(overlay);
    }, durationMs);
  }

  function createEffect(element, onRemove) {
    const overlay = document.createElement('div');
    const geometry = geometryFor(element);

    overlay.innerHTML = `
      <svg viewBox="0 0 ${geometry.width} ${geometry.height}" preserveAspectRatio="none" aria-hidden="true">
        <rect class="ace-line ace-line-soft" x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="${geometry.radius}"/>
        <rect class="ace-line ace-line-main" x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="${geometry.radius}"/>
        <rect class="ace-line ace-line-spark" x="0" y="0" width="${geometry.width}" height="${geometry.height}" rx="${geometry.radius}"/>
      </svg>
      <span class="ace-corner"></span>
    `;

    overlay.className = OVERLAY_CLASS;
    overlay.dataset.aceTheme = chooseEffectTheme();
    applyOptions(overlay, overlay.dataset.aceTheme);
    setOverlayGeometry(overlay, geometry, false);
    document.documentElement.append(overlay);

    trackEffect(overlay, element, fadeDurationMs() + 100, onRemove);

    return overlay;
  }

  function showClickEffect(button) {
    if (!options.clickEnabled) {
      return;
    }

    createEffect(button);
  }

  function stopHoverEffect() {
    modifierIsDown = false;
    hoverTarget = null;
    const hadHoverOverlay = Boolean(hoverOverlay);
    hoverOverlay = null;
    window.cancelAnimationFrame(hoverFrame);
    hoverFrame = 0;

    if (hadHoverOverlay) {
      scheduleTrackedEffectsUpdate();
    }
  }

  function syncHoverOverlay() {
    if (
      !modifierIsDown ||
      !hoverOverlay ||
      !hoverTarget ||
      !isUsableHoverTarget(hoverTarget)
    ) {
      stopHoverEffect();
      return;
    }

    setOverlayGeometry(hoverOverlay, geometryFor(hoverTarget), true);
    hoverFrame = window.requestAnimationFrame(syncHoverOverlay);
  }

  function updateHoverEffect() {
    pendingPointerFrame = 0;

    if (!modifierIsDown) {
      return;
    }

    const target = findHoverElement(lastPointer.x, lastPointer.y);

    if (!target) {
      stopHoverEffect();
      return;
    }

    if (!hoverOverlay) {
      hoverTarget = target;
      const overlay = createEffect(target, () => {
        if (hoverOverlay === overlay) {
          hoverOverlay = null;
          hoverTarget = null;
          window.cancelAnimationFrame(hoverFrame);
          hoverFrame = 0;
        }
      });
      hoverOverlay = overlay;
      hoverFrame = window.requestAnimationFrame(syncHoverOverlay);
      return;
    }

    if (target !== hoverTarget) {
      hoverTarget = target;
      setOverlayGeometry(hoverOverlay, geometryFor(target), true);
    }
  }

  function scheduleHoverUpdate() {
    if (!pendingPointerFrame) {
      pendingPointerFrame = window.requestAnimationFrame(updateHoverEffect);
    }
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${OVERLAY_CLASS} {
        all: initial;
        box-sizing: border-box;
        position: fixed;
        left: 0;
        top: 0;
        width: var(--ace-width);
        height: var(--ace-height);
        z-index: 2147483647;
        pointer-events: none;
        overflow: visible;
        border-radius: var(--ace-radius);
        opacity: 1;
        transform-origin: 0 0;
        contain: layout style paint;
        will-change: transform, width, height, opacity;
      }

      .${OVERLAY_CLASS}.is-smooth {
        transition:
          transform 150ms cubic-bezier(0.2, 0.9, 0.2, 1),
          width 150ms cubic-bezier(0.2, 0.9, 0.2, 1),
          height 150ms cubic-bezier(0.2, 0.9, 0.2, 1),
          border-radius 150ms cubic-bezier(0.2, 0.9, 0.2, 1);
      }

      .${OVERLAY_CLASS} svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
      }

      .${OVERLAY_CLASS} .ace-line {
        fill: none;
        vector-effect: non-scaling-stroke;
        pathLength: 100;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .${OVERLAY_CLASS} .ace-line-soft {
        stroke: var(--ace-soft);
        stroke-width: var(--ace-soft-stroke);
        opacity: var(--ace-aura-opacity);
        filter:
          brightness(var(--ace-brightness))
          saturate(var(--ace-saturate))
          drop-shadow(0 0 var(--ace-glow-size) var(--ace-glow));
        animation: ace-button-fade var(--ace-fade-duration) ease-out forwards;
      }

      .${OVERLAY_CLASS} .ace-line-main {
        stroke: var(--ace-main);
        stroke-width: var(--ace-main-stroke);
        stroke-dasharray: 100;
        stroke-dashoffset: 100;
        filter:
          brightness(var(--ace-brightness))
          saturate(var(--ace-saturate))
          drop-shadow(0 0 var(--ace-main-glow-size) var(--ace-glow));
        animation: ace-button-draw var(--ace-draw-duration) cubic-bezier(0.19, 1, 0.22, 1) forwards, ace-button-fade var(--ace-fade-duration) ease-out forwards;
      }

      .${OVERLAY_CLASS} .ace-line-spark {
        stroke: var(--ace-bright);
        stroke-width: var(--ace-spark-stroke);
        stroke-dasharray: 12 88;
        stroke-dashoffset: 112;
        filter:
          brightness(var(--ace-brightness))
          saturate(var(--ace-saturate))
          drop-shadow(0 0 var(--ace-spark-glow-size) var(--ace-bright));
        animation: ace-button-spark var(--ace-draw-duration) cubic-bezier(0.19, 1, 0.22, 1) forwards, ace-button-fade var(--ace-fade-duration) ease-out forwards;
      }

      .${OVERLAY_CLASS} .ace-corner {
        position: absolute;
        left: 0;
        top: 0;
        width: var(--ace-corner-size);
        height: var(--ace-corner-size);
        border-radius: 50%;
        background: var(--ace-bright);
        box-shadow:
          0 0 10px 3px var(--ace-bright),
          0 0 24px 9px var(--ace-glow);
        transform: translate(-50%, -50%);
        animation: ace-button-dot var(--ace-fade-duration) ease-out forwards;
      }

      @keyframes ace-button-draw {
        to {
          stroke-dashoffset: 0;
        }
      }

      @keyframes ace-button-spark {
        to {
          stroke-dashoffset: 0;
        }
      }

      @keyframes ace-button-fade {
        0%,
        72% {
          opacity: 1;
        }

        100% {
          opacity: 0;
        }
      }

      @keyframes ace-button-dot {
        0% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(0.6);
        }

        18%,
        68% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }

        100% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.25);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .${OVERLAY_CLASS},
        .${OVERLAY_CLASS}.is-smooth {
          transition-duration: 1ms;
          animation-duration: 1ms;
        }

        .${OVERLAY_CLASS} .ace-line-main,
        .${OVERLAY_CLASS} .ace-line-spark {
          animation-duration: 1ms;
        }
      }
    `;

    document.documentElement.append(style);
  }

  installStyles();
  loadOptions();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.aceOptions) {
      return;
    }

    options = { ...DEFAULT_OPTIONS, ...changes.aceOptions.newValue };
    applyOptions(hoverOverlay, hoverOverlay?.dataset.aceTheme);
    stopHoverEffect();
  });

  document.addEventListener(
    'click',
    (event) => {
      const button = findButton(event.target);

      if (button) {
        showClickEffect(button);
      }
    },
    true,
  );

  document.addEventListener(
    'mousemove',
    (event) => {
      lastPointer = { x: event.clientX, y: event.clientY };
      modifierIsDown = isModifierActive(event);

      if (modifierIsDown) {
        scheduleHoverUpdate();
      } else if (hoverOverlay) {
        stopHoverEffect();
      }
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (eventMatchesModifier(event)) {
        modifierIsDown = true;
        scheduleHoverUpdate();
      }
    },
    true,
  );

  document.addEventListener(
    'keyup',
    (event) => {
      if (eventMatchesModifier(event)) {
        stopHoverEffect();
      }
    },
    true,
  );

  window.addEventListener('blur', stopHoverEffect);
  window.addEventListener(
    'scroll',
    () => {
      scheduleHoverUpdate();
      scheduleTrackedEffectsUpdate();
    },
    true,
  );
  window.addEventListener('resize', () => {
    scheduleHoverUpdate();
    scheduleTrackedEffectsUpdate();
  });
})();
