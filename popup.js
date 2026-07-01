const DEFAULT_OPTIONS = {
  modifierKey: "Control",
  colorTheme: "blue",
  clickEnabled: true,
  intensity: 85,
  contrast: 80,
  thickness: 3,
  borderGap: 5,
  speed: 75
};

const THEME_LABELS = {
  blue: "Electric blue",
  cyan: "Aqua cyan",
  violet: "Violet",
  emerald: "Emerald",
  rose: "Rose",
  gold: "Gold"
};

const hasChromeStorage = typeof chrome !== "undefined" && chrome.storage?.sync;
const button = document.querySelector("#preview-effect");
const statusText = document.querySelector("#status");
const modifierSelect = document.querySelector("#modifier-key");
const clickEnabledToggle = document.querySelector("#click-enabled");
const intensityInput = document.querySelector("#intensity");
const contrastInput = document.querySelector("#contrast");
const thicknessInput = document.querySelector("#thickness");
const borderGapInput = document.querySelector("#border-gap");
const speedInput = document.querySelector("#speed");
const resetVisualsButton = document.querySelector("#reset-visuals");
const intensityValue = document.querySelector("#intensity-value");
const contrastValue = document.querySelector("#contrast-value");
const thicknessValue = document.querySelector("#thickness-value");
const borderGapValue = document.querySelector("#border-gap-value");
const speedValue = document.querySelector("#speed-value");
const swatches = [...document.querySelectorAll("[data-value]")];

let options = { ...DEFAULT_OPTIONS };

function storageGet() {
  if (hasChromeStorage) {
    return chrome.storage.sync.get({ aceOptions: DEFAULT_OPTIONS });
  }

  const saved = JSON.parse(localStorage.getItem("aceOptions") || "null");
  return Promise.resolve({ aceOptions: saved || DEFAULT_OPTIONS });
}

function storageSet(nextOptions) {
  if (hasChromeStorage) {
    return chrome.storage.sync.set({ aceOptions: nextOptions });
  }

  localStorage.setItem("aceOptions", JSON.stringify(nextOptions));
  return Promise.resolve();
}

function setStatus() {
  const keyName = options.modifierKey === "Meta" ? "Command" : options.modifierKey;
  statusText.textContent = `Hold ${keyName} over any element. Click effect is ${options.clickEnabled ? "on" : "off"}.`;
}

function paintControls() {
  document.body.dataset.theme = options.colorTheme;
  button.style.setProperty("--preview-glow", `${Math.max(2, options.intensity * 0.24)}px`);
  button.style.setProperty("--preview-aura", `${Math.max(0.25, options.intensity / 100)}`);
  button.style.setProperty("--preview-brightness", `${Math.max(0.55, options.contrast / 80)}`);
  button.style.setProperty("--preview-thickness", `${options.thickness}px`);
  button.style.setProperty("--preview-gap", `${options.borderGap}px`);
  modifierSelect.value = options.modifierKey;
  clickEnabledToggle.checked = options.clickEnabled;
  intensityInput.value = options.intensity;
  contrastInput.value = options.contrast;
  thicknessInput.value = options.thickness;
  borderGapInput.value = options.borderGap;
  speedInput.value = options.speed;
  intensityValue.value = `${options.intensity}%`;
  contrastValue.value = `${options.contrast}%`;
  thicknessValue.value = `${options.thickness}px`;
  borderGapValue.value = `${options.borderGap}px`;
  speedValue.value = `${options.speed}%`;

  swatches.forEach((swatch) => {
    const selected = swatch.dataset.value === options.colorTheme;
    swatch.classList.toggle("is-selected", selected);
    swatch.setAttribute("aria-pressed", String(selected));
  });

  setStatus();
}

async function saveOptions(nextOptions) {
  options = { ...options, ...nextOptions };
  paintControls();
  await storageSet(options);
}

async function loadOptions() {
  const result = await storageGet();
  options = { ...DEFAULT_OPTIONS, ...result.aceOptions };
  paintControls();
}

button.addEventListener("click", () => {
  button.classList.remove("is-previewing");
  button.offsetWidth;
  button.classList.add("is-previewing");
  setStatus();
});

modifierSelect.addEventListener("change", () => {
  saveOptions({ modifierKey: modifierSelect.value });
});

clickEnabledToggle.addEventListener("change", () => {
  saveOptions({ clickEnabled: clickEnabledToggle.checked });
});

intensityInput.addEventListener("input", () => {
  saveOptions({ intensity: Number(intensityInput.value) });
});

contrastInput.addEventListener("input", () => {
  saveOptions({ contrast: Number(contrastInput.value) });
});

thicknessInput.addEventListener("input", () => {
  saveOptions({ thickness: Number(thicknessInput.value) });
});

borderGapInput.addEventListener("input", () => {
  saveOptions({ borderGap: Number(borderGapInput.value) });
});

speedInput.addEventListener("input", () => {
  saveOptions({ speed: Number(speedInput.value) });
});

resetVisualsButton.addEventListener("click", () => {
  saveOptions({
    intensity: DEFAULT_OPTIONS.intensity,
    contrast: DEFAULT_OPTIONS.contrast,
    thickness: DEFAULT_OPTIONS.thickness,
    borderGap: DEFAULT_OPTIONS.borderGap,
    speed: DEFAULT_OPTIONS.speed
  });
});

swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    saveOptions({ colorTheme: swatch.dataset.value });
  });
});

loadOptions();
