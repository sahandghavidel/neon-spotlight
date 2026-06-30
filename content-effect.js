(() => {
  const OVERLAY_CLASS = "ace-neon-element-border";
  const STYLE_ID = "ace-neon-element-border-styles";
  const BUTTON_SELECTOR = [
    "button",
    "input[type='button']",
    "input[type='submit']",
    "input[type='reset']",
    "[role='button']"
  ].join(",");

  const DEFAULT_OPTIONS = {
    modifierKey: "Control",
    colorTheme: "blue",
    motionStyle: "trace",
    hoverLoop: true,
    clickEnabled: true,
    intensity: 85,
    contrast: 80,
    thickness: 3,
    speed: 75
  };

  const THEMES = {
    blue: {
      main: "#42e8ff",
      bright: "#f2ffff",
      deep: "#136cff",
      soft: "rgba(0, 209, 255, 0.32)",
      glow: "rgba(0, 209, 255, 0.95)"
    },
    cyan: {
      main: "#48ffd5",
      bright: "#ecfff9",
      deep: "#00a8d8",
      soft: "rgba(72, 255, 213, 0.28)",
      glow: "rgba(72, 255, 213, 0.9)"
    },
    violet: {
      main: "#b68cff",
      bright: "#fbf6ff",
      deep: "#6f45ff",
      soft: "rgba(182, 140, 255, 0.3)",
      glow: "rgba(182, 140, 255, 0.9)"
    },
    emerald: {
      main: "#56ff94",
      bright: "#f1fff6",
      deep: "#00a66a",
      soft: "rgba(86, 255, 148, 0.27)",
      glow: "rgba(86, 255, 148, 0.88)"
    },
    rose: {
      main: "#ff6fb1",
      bright: "#fff4fb",
      deep: "#ff2f6f",
      soft: "rgba(255, 111, 177, 0.28)",
      glow: "rgba(255, 111, 177, 0.9)"
    },
    gold: {
      main: "#ffd45a",
      bright: "#fffbed",
      deep: "#ff8d24",
      soft: "rgba(255, 212, 90, 0.26)",
      glow: "rgba(255, 212, 90, 0.88)"
    }
  };

  const MIN_SIZE = 8;
  const MAX_SCREEN_COVERAGE = 0.92;
  const LIVE_MARGIN = 5;
  let options = { ...DEFAULT_OPTIONS };
  let modifierIsDown = false;
  let liveOverlay = null;
  let liveTarget = null;
  let lastPointer = { x: 0, y: 0 };
  let liveFrame = 0;
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
    applyOptions(liveOverlay);
  }

  function applyOptions(overlay) {
    if (!overlay) {
      return;
    }

    const theme = THEMES[options.colorTheme] || THEMES.blue;
    const speedFactor = 75 / Math.max(35, options.speed);
    const brightness = Math.max(0.6, options.contrast / 80);
    const saturate = Math.max(0.7, options.contrast / 70);

    overlay.dataset.motion = options.motionStyle;
    overlay.style.setProperty("--ace-main", theme.main);
    overlay.style.setProperty("--ace-bright", theme.bright);
    overlay.style.setProperty("--ace-deep", theme.deep);
    overlay.style.setProperty("--ace-soft", theme.soft);
    overlay.style.setProperty("--ace-glow", theme.glow);
    overlay.style.setProperty("--ace-glow-size", `${Math.max(4, options.intensity * 0.32)}px`);
    overlay.style.setProperty("--ace-main-glow-size", `${Math.max(3, options.intensity * 0.22)}px`);
    overlay.style.setProperty("--ace-spark-glow-size", `${Math.max(4, options.intensity * 0.26)}px`);
    overlay.style.setProperty("--ace-aura-opacity", `${Math.min(1, Math.max(0.18, options.intensity / 100))}`);
    overlay.style.setProperty("--ace-brightness", `${brightness}`);
    overlay.style.setProperty("--ace-saturate", `${saturate}`);
    overlay.style.setProperty("--ace-main-stroke", `${options.thickness}`);
    overlay.style.setProperty("--ace-soft-stroke", `${options.thickness + Math.max(3, options.intensity * 0.055)}`);
    overlay.style.setProperty("--ace-spark-stroke", `${Math.max(1, options.thickness * 0.52 + options.intensity * 0.008)}`);
    overlay.style.setProperty("--ace-comet-main-stroke", `${options.thickness * 0.9}`);
    overlay.style.setProperty("--ace-comet-spark-stroke", `${Math.max(1.2, options.thickness * 0.82)}`);
    overlay.style.setProperty("--ace-corner-size", `${Math.max(8, options.intensity * 0.16)}px`);
    overlay.style.setProperty("--ace-draw-duration", `${0.95 * speedFactor}s`);
    overlay.style.setProperty("--ace-fast-duration", `${0.75 * speedFactor}s`);
    overlay.style.setProperty("--ace-live-duration", `${1.15 * speedFactor}s`);
    overlay.style.setProperty("--ace-breathe-duration", `${1.6 * speedFactor}s`);
    overlay.style.setProperty("--ace-calm-duration", `${2.1 * speedFactor}s`);
    overlay.style.setProperty("--ace-fade-duration", `${1.5 * speedFactor}s`);
  }

  function isModifierActive(event) {
    if (!event) {
      return modifierIsDown;
    }

    if (options.modifierKey === "Control") {
      return event.ctrlKey;
    }

    if (options.modifierKey === "Shift") {
      return event.shiftKey;
    }

    if (options.modifierKey === "Alt") {
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
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      Number(style.opacity) !== 0
    );
  }

  function findButton(start) {
    const element = start instanceof Element ? start : start?.parentElement;
    const button = element?.closest(BUTTON_SELECTOR);

    if (!button || !document.documentElement.contains(button) || !isVisible(button)) {
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
    return Number.isFinite(radius) ? Math.min(radius + LIVE_MARGIN, 32) : 8;
  }

  function geometryFor(element) {
    const rect = element.getBoundingClientRect();
    const width = rect.width + LIVE_MARGIN * 2;
    const height = rect.height + LIVE_MARGIN * 2;

    return {
      left: rect.left - LIVE_MARGIN,
      top: rect.top - LIVE_MARGIN,
      width,
      height,
      radius: borderRadiusFor(element)
    };
  }

  function setOverlayGeometry(overlay, geometry, smooth = true) {
    overlay.classList.toggle("is-smooth", smooth);
    overlay.style.setProperty("--ace-width", `${geometry.width}px`);
    overlay.style.setProperty("--ace-height", `${geometry.height}px`);
    overlay.style.setProperty("--ace-radius", `${geometry.radius}px`);
    overlay.style.transform = `translate3d(${geometry.left}px, ${geometry.top}px, 0)`;
    overlay.querySelector("svg")?.setAttribute("viewBox", `0 0 ${geometry.width} ${geometry.height}`);

    overlay.querySelectorAll("rect").forEach((rectElement) => {
      rectElement.setAttribute("width", `${Math.max(1, geometry.width - 6)}`);
      rectElement.setAttribute("height", `${Math.max(1, geometry.height - 6)}`);
      rectElement.setAttribute("rx", `${geometry.radius}`);
    });
  }

  function removeTrackedEffect(overlay) {
    trackedEffects.delete(overlay);
    overlay.remove();
  }

  function updateTrackedEffects() {
    trackedFrame = 0;

    trackedEffects.forEach((effect, overlay) => {
      if (!document.documentElement.contains(overlay)) {
        trackedEffects.delete(overlay);
        return;
      }

      if (!effect.element || !document.documentElement.contains(effect.element) || !isVisible(effect.element)) {
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

  function trackEffect(overlay, element, durationMs) {
    if (!element) {
      window.setTimeout(() => overlay.remove(), durationMs);
      return;
    }

    trackedEffects.set(overlay, { element });

    window.setTimeout(() => {
      removeTrackedEffect(overlay);
    }, durationMs);
  }

  function createEffect(element, optionsForEffect = {}) {
    const overlay = document.createElement("div");
    const geometry = geometryFor(element);

    overlay.innerHTML = `
      <svg viewBox="0 0 ${geometry.width} ${geometry.height}" preserveAspectRatio="none" aria-hidden="true">
        <rect class="ace-line ace-line-soft" x="3" y="3" width="${geometry.width - 6}" height="${geometry.height - 6}" rx="${geometry.radius}"/>
        <rect class="ace-line ace-line-main" x="3" y="3" width="${geometry.width - 6}" height="${geometry.height - 6}" rx="${geometry.radius}"/>
        <rect class="ace-line ace-line-spark" x="3" y="3" width="${geometry.width - 6}" height="${geometry.height - 6}" rx="${geometry.radius}"/>
      </svg>
      <span class="ace-corner"></span>
    `;

    overlay.className =
      optionsForEffect.live && options.hoverLoop
        ? `${OVERLAY_CLASS} is-live`
        : optionsForEffect.live
          ? `${OVERLAY_CLASS} is-live is-once`
          : OVERLAY_CLASS;
    applyOptions(overlay);
    setOverlayGeometry(overlay, geometry, false);
    document.documentElement.append(overlay);

    if (!optionsForEffect.live) {
      trackEffect(overlay, element, fadeDurationMs() + 100);
    }

    return overlay;
  }

  function showClickEffect(button) {
    if (!options.clickEnabled) {
      return;
    }

    createEffect(button);
  }

  function restartLiveAnimation() {
    if (!liveOverlay) {
      return;
    }

    liveOverlay.classList.remove("is-live");
    liveOverlay.offsetWidth;
    liveOverlay.classList.add("is-live");
  }

  function stopLiveEffect({ completeOnce = false } = {}) {
    modifierIsDown = false;
    liveTarget = null;
    const overlayToRemove = liveOverlay;
    liveOverlay = null;
    window.cancelAnimationFrame(liveFrame);
    liveFrame = 0;

    if (overlayToRemove) {
      if (completeOnce && overlayToRemove.classList.contains("is-once")) {
        overlayToRemove.classList.remove("is-smooth");
        trackEffect(overlayToRemove, overlayToRemove.__aceTarget, fadeDurationMs() + 100);
        return;
      }

      overlayToRemove.classList.add("is-leaving");
      window.setTimeout(() => overlayToRemove.remove(), 180);
    }
  }

  function syncLiveOverlay() {
    if (!modifierIsDown || !liveOverlay || !liveTarget || !isUsableHoverTarget(liveTarget)) {
      stopLiveEffect({ completeOnce: !options.hoverLoop });
      return;
    }

    setOverlayGeometry(liveOverlay, geometryFor(liveTarget), true);
    liveFrame = window.requestAnimationFrame(syncLiveOverlay);
  }

  function updateLiveEffect() {
    pendingPointerFrame = 0;

    if (!modifierIsDown) {
      return;
    }

    const target = findHoverElement(lastPointer.x, lastPointer.y);

    if (!target) {
      stopLiveEffect();
      return;
    }

    if (!liveOverlay) {
      liveTarget = target;
      liveOverlay = createEffect(target, { live: true });
      liveOverlay.__aceTarget = target;
      liveFrame = window.requestAnimationFrame(syncLiveOverlay);
      return;
    }

    if (target !== liveTarget) {
      liveTarget = target;
      liveOverlay.__aceTarget = target;
      liveOverlay.classList.remove("is-resting");
      liveOverlay.classList.add("is-switching");
      setOverlayGeometry(liveOverlay, geometryFor(target), true);
      restartLiveAnimation();
      window.setTimeout(() => liveOverlay?.classList.remove("is-switching"), 220);
    }
  }

  function scheduleLiveUpdate() {
    if (!pendingPointerFrame) {
      pendingPointerFrame = window.requestAnimationFrame(updateLiveEffect);
    }
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
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

      .${OVERLAY_CLASS}.is-leaving {
        opacity: 0;
        transition: opacity 160ms ease-out;
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
        left: 3px;
        top: 3px;
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

      .${OVERLAY_CLASS}.is-live {
        animation: ace-live-presence var(--ace-live-duration) ease-in-out infinite;
      }

      .${OVERLAY_CLASS}.is-live .ace-line-soft {
        animation: ace-live-glow var(--ace-live-duration) ease-in-out infinite;
      }

      .${OVERLAY_CLASS}.is-live .ace-line-main {
        animation: ace-button-draw var(--ace-fast-duration) cubic-bezier(0.19, 1, 0.22, 1) forwards, ace-live-glow var(--ace-live-duration) ease-in-out infinite;
      }

      .${OVERLAY_CLASS}.is-live .ace-line-spark {
        animation: ace-button-spark var(--ace-fast-duration) cubic-bezier(0.19, 1, 0.22, 1) forwards, ace-live-spark var(--ace-live-duration) linear infinite;
      }

      .${OVERLAY_CLASS}.is-live .ace-corner {
        animation: ace-live-corner var(--ace-live-duration) ease-in-out infinite;
      }

      .${OVERLAY_CLASS}.is-live.is-once {
        animation: none;
      }

      .${OVERLAY_CLASS}.is-live.is-once .ace-line-soft {
        animation: ace-button-fade var(--ace-fade-duration) ease-out forwards;
      }

      .${OVERLAY_CLASS}.is-live.is-once .ace-line-main {
        animation: ace-button-draw var(--ace-draw-duration) cubic-bezier(0.19, 1, 0.22, 1) forwards, ace-button-fade var(--ace-fade-duration) ease-out forwards;
      }

      .${OVERLAY_CLASS}.is-live.is-once .ace-line-spark {
        animation: ace-button-spark var(--ace-draw-duration) cubic-bezier(0.19, 1, 0.22, 1) forwards, ace-button-fade var(--ace-fade-duration) ease-out forwards;
      }

      .${OVERLAY_CLASS}.is-live.is-once .ace-corner {
        animation: ace-button-dot var(--ace-fade-duration) ease-out forwards;
      }

      .${OVERLAY_CLASS}[data-motion="comet"] .ace-line-main {
        stroke-width: var(--ace-comet-main-stroke);
      }

      .${OVERLAY_CLASS}[data-motion="comet"] .ace-line-spark {
        stroke-width: var(--ace-comet-spark-stroke);
        stroke-dasharray: 20 80;
      }

      .${OVERLAY_CLASS}.is-live[data-motion="comet"] .ace-line-spark {
        animation: ace-live-comet var(--ace-fast-duration) linear infinite;
      }

      .${OVERLAY_CLASS}.is-live[data-motion="breathe"] .ace-line-main,
      .${OVERLAY_CLASS}.is-live[data-motion="breathe"] .ace-line-soft {
        stroke-dashoffset: 0;
        animation: ace-breathe-line var(--ace-breathe-duration) ease-in-out infinite;
      }

      .${OVERLAY_CLASS}.is-live[data-motion="breathe"] .ace-line-spark {
        opacity: 0.78;
        animation: ace-live-spark var(--ace-breathe-duration) linear infinite;
      }

      .${OVERLAY_CLASS}.is-live[data-motion="calm"] {
        animation: none;
      }

      .${OVERLAY_CLASS}.is-live[data-motion="calm"] .ace-line-main,
      .${OVERLAY_CLASS}.is-live[data-motion="calm"] .ace-line-soft {
        stroke-dashoffset: 0;
        animation: ace-calm-glow var(--ace-calm-duration) ease-in-out infinite;
      }

      .${OVERLAY_CLASS}.is-live[data-motion="calm"] .ace-line-spark,
      .${OVERLAY_CLASS}.is-live[data-motion="calm"] .ace-corner {
        display: none;
      }

      .${OVERLAY_CLASS}.is-live.is-once[data-motion] {
        animation: none;
      }

      .${OVERLAY_CLASS}.is-live.is-once[data-motion] .ace-line-soft {
        display: initial;
        animation: ace-button-fade var(--ace-fade-duration) ease-out forwards;
      }

      .${OVERLAY_CLASS}.is-live.is-once[data-motion] .ace-line-main {
        stroke-dashoffset: 100;
        animation: ace-button-draw var(--ace-draw-duration) cubic-bezier(0.19, 1, 0.22, 1) forwards, ace-button-fade var(--ace-fade-duration) ease-out forwards;
      }

      .${OVERLAY_CLASS}.is-live.is-once[data-motion] .ace-line-spark {
        display: initial;
        animation: ace-button-spark var(--ace-draw-duration) cubic-bezier(0.19, 1, 0.22, 1) forwards, ace-button-fade var(--ace-fade-duration) ease-out forwards;
      }

      .${OVERLAY_CLASS}.is-live.is-once[data-motion] .ace-corner {
        display: initial;
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

      @keyframes ace-live-presence {
        0%,
        100% {
          filter: brightness(1);
        }

        50% {
          filter: brightness(1.2);
        }
      }

      @keyframes ace-live-glow {
        0%,
        100% {
          opacity: 0.76;
        }

        50% {
          opacity: 1;
        }
      }

      @keyframes ace-live-spark {
        from {
          stroke-dashoffset: 112;
        }

        to {
          stroke-dashoffset: 0;
        }
      }

      @keyframes ace-live-comet {
        from {
          stroke-dashoffset: 120;
        }

        to {
          stroke-dashoffset: 0;
        }
      }

      @keyframes ace-live-corner {
        0%,
        100% {
          opacity: 0.76;
          transform: translate(-50%, -50%) scale(0.82);
        }

        50% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.08);
        }
      }

      @keyframes ace-breathe-line {
        0%,
        100% {
          opacity: 0.6;
          stroke-width: 2.5;
        }

        50% {
          opacity: 1;
          stroke-width: 5;
        }
      }

      @keyframes ace-calm-glow {
        0%,
        100% {
          opacity: 0.72;
        }

        50% {
          opacity: 0.95;
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
    if (areaName !== "sync" || !changes.aceOptions) {
      return;
    }

    options = { ...DEFAULT_OPTIONS, ...changes.aceOptions.newValue };
    applyOptions(liveOverlay);
    stopLiveEffect();
  });

  document.addEventListener(
    "click",
    (event) => {
      const button = findButton(event.target);

      if (button) {
        showClickEffect(button);
      }
    },
    true
  );

  document.addEventListener(
    "mousemove",
    (event) => {
      lastPointer = { x: event.clientX, y: event.clientY };
      modifierIsDown = isModifierActive(event);

      if (modifierIsDown) {
        scheduleLiveUpdate();
      } else if (liveOverlay) {
        stopLiveEffect({ completeOnce: !options.hoverLoop });
      }
    },
    true
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (eventMatchesModifier(event)) {
        modifierIsDown = true;
        scheduleLiveUpdate();
      }
    },
    true
  );

  document.addEventListener(
    "keyup",
    (event) => {
      if (eventMatchesModifier(event)) {
        stopLiveEffect({ completeOnce: !options.hoverLoop });
      }
    },
    true
  );

  window.addEventListener("blur", stopLiveEffect);
  window.addEventListener(
    "scroll",
    () => {
      scheduleLiveUpdate();
      scheduleTrackedEffectsUpdate();
    },
    true
  );
  window.addEventListener("resize", () => {
    scheduleLiveUpdate();
    scheduleTrackedEffectsUpdate();
  });
})();
