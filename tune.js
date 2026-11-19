// DialKit tune panel: every control from the grass-hills page, live on the hero.
// Loaded only with ?tune (see the end of index.html). DialKit 2.1.0, vanilla build, vendored.
//
//   View        Scene / Terrain, Banner / Hero 16:9
//   Desk        show, left/right, near/far, elevation, size, angle, monitor size
//   Coffee mug  left/right, back/front, size
//   Hills       style, height, background mounds, humps, width, circled hills, banner hills
//   Light       haze, overall, depth of field, glow
//   Grass       impact radius, length, density, base, lavender
//   Wind        Seattle live wind, strength, gusts, pause
//   Colours     all 14 pickers, reset colours
//   Reset       back to the tuned defaults (colours stay, as in grass-hills)
import { createDialKit, createDialRoot } from "./vendor/dialkit/index.js";

const VIEW = [{ value: "0", label: "Scene" }, { value: "1", label: "Terrain" }];
const FRAME = [{ value: "0", label: "Banner" }, { value: "1", label: "Hero 16:9" }];
const STYLE = [{ value: "0", label: "Rounded mounds" }, { value: "1", label: "From banner" }, { value: "2", label: "Valley" }];

// Sliders: [folder, label, P key, min, max, step, scale (panel value = P value × scale)]
const SLIDERS = [
  ["Desk", "Left / right (m)", "deskX", -5, 5, 0.05, 1],
  ["Desk", "Near / far (m)", "deskDepth", -4, 4, 0.05, 1],
  ["Desk", "Desk elevation (cm)", "lift", -150, 80, 1, 100],
  ["Desk", "Size", "gsize", 0.7, 3, 0.01, 1],
  ["Desk", "Desk angle (°)", "angle", -180, 180, 1, 1],
  ["Desk", "Monitor size", "monitor", 0.65, 1.4, 0.01, 1],
  ["Coffee mug", "Left / right (cm)", "mugX", -90, 17, 1, 100],
  ["Coffee mug", "Back / front (cm)", "mugZ", -37, 1, 1, 100],
  ["Coffee mug", "Mug size", "mugSize", 0.55, 1.8, 0.01, 1],
  ["Hills", "Hill height", "depth", 0.2, 2, 0.01, 1],
  ["Hills", "Background mounds (%)", "background", 0, 100, 10, 1, "mounds"],
  ["Hills", "Humps", "humps", 1, 8, 1, 1, "mounds"],
  ["Hills", "Hill width", "hillW", 0.6, 2.4, 0.01, 1],
  ["Light", "Haze", "haze", 0, 2, 0.01, 1],
  ["Light", "Overall", "overall", 0.6, 1.5, 0.01, 1],
  ["Light", "Depth of field", "dof", 0, 2, 0.01, 1],
  ["Light", "Glow", "glow", 0, 2, 0.01, 1],
  ["Grass", "Impact radius (px)", "radius", 24, 180, 1, 1],
  ["Grass", "Grass length", "len", 0.4, 1.8, 0.01, 1],
  ["Grass", "Density (%)", "density", 15, 100, 1, 100],
  ["Grass", "Base (%)", "base", 0, 100, 1, 100],
  ["Grass", "Lavender", "lav", 0, 2, 0.01, 1],
];
// changing these rebuilds the land (about a second), as on the grass-hills page
const RESHAPE = new Set(["background", "hillW", "humps", "hills"]);

const round = (v, step) => Math.round(v / step) * step;
const layerLabel = name => name.replaceAll("-", " ");

// any CSS colour the picker hands back -> #rrggbb for the shaders
const swatch = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
function toHex(c) {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  swatch.clearRect(0, 0, 1, 1); swatch.fillStyle = "#000"; swatch.fillStyle = c; swatch.fillRect(0, 0, 1, 1);
  const [r, g, b] = swatch.getImageData(0, 0, 1, 1).data;
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

function loadStyles() {
  return new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet"; link.href = new URL("./vendor/dialkit/styles.css", import.meta.url).href;
    link.onload = link.onerror = resolve;
    document.head.appendChild(link);
  });
}

export async function mountTune(h) {
  const { P, PAL, PAL_DEFAULT, PAL_INFO, DEFAULTS, LAYERS, GIRL, HIDE, WIND, hiddenLayers } = h;
  const farLayers = LAYERS.filter(layer => layer.d > GIRL.d);   // the banner's background hills

  // what the panel shows: the scene as it is now, or the tuned defaults (for Reset)
  const stateNow = () => ({
    P, hideFar: HIDE.far, hidden: hiddenLayers, live: WIND.live, strength: WIND.strength, gusts: WIND.gusts,
    showDesk: h.showDesk, paused: h.paused,
  });
  const stateDefault = () => ({
    P: { ...DEFAULTS }, hideFar: true, hidden: new Set(), live: true, strength: DEFAULTS.wind, gusts: DEFAULTS.gust,
    showDesk: true, paused: false,
  });

  // the panel layout for a hill style, with that state's values as its defaults
  function config(st = stateNow()) {
    const P = st.P;
    const c = {
      View: {
        View: { type: "select", options: VIEW, default: String(P.view) },
        Frame: { type: "select", options: FRAME, default: String(P.frame) },
      },
      Desk: { Show: st.showDesk },
      "Coffee mug": {},
      Hills: { Style: { type: "select", options: STYLE, default: String(P.hills) } },
      Light: {}, Grass: {},
      Wind: {
        "Seattle live wind": st.live,
        Strength: [round(st.strength, 0.01), 0, 2, 0.01],
        Gusts: [round(st.gusts, 0.01), 0, 2, 0.01],
        "Pause wind": st.paused,
      },
      Colours: { _collapsed: true },
      Reset: { type: "action", label: "Reset" },
    };
    for (const [folder, label, key, min, max, step, scale, only] of SLIDERS) {
      if (only === "mounds" && P.hills !== 0) continue;
      c[folder][label] = [round(P[key] * scale, step), min, max, step];
    }
    if (P.hills === 0) c.Hills["Hide circled hills"] = st.hideFar;
    if (P.hills === 1) {
      c.Hills["Visible background hills"] = {};
      for (const layer of farLayers) c.Hills["Visible background hills"][layerLabel(layer.name)] = !st.hidden.has(layer.name);
    }
    for (const [key, label] of PAL_INFO) c.Colours[label] = { type: "color", default: PAL[key] };
    c.Colours["Reset colours"] = { type: "action", label: "Reset colours" };
    return c;
  }

  await loadStyles();
  // top-left: the desk sits on the right of the hero
  const root = createDialRoot({ position: "top-left", theme: "system", defaultOpen: true });
  let style = P.hills;
  const kit = createDialKit("Grass hills", config(), {
    id: "grass-hills",
    persist: { key: "grass-website-tune" },
    onAction: path => {
      if (path.endsWith("Reset colours")) resetColours();
      else if (path.endsWith("Reset")) resetAll();
    },
  });

  // panel -> scene
  let muted = false;
  kit.subscribe(v => { if (!muted) apply(v); });
  function apply(v) {
    const changed = new Set();
    const set = (key, value) => { if (P[key] !== value) { P[key] = value; changed.add(key); } };
    set("view", +v.View.View);
    set("frame", +v.View.Frame);
    h.showDesk = v.Desk.Show;
    set("hills", +v.Hills.Style);
    for (const [folder, label, key, , , , scale] of SLIDERS) {
      const value = v[folder][label];
      if (value !== undefined) set(key, value / scale);
    }
    if (v.Hills["Hide circled hills"] !== undefined && HIDE.far !== v.Hills["Hide circled hills"]) {
      HIDE.far = v.Hills["Hide circled hills"]; changed.add("hills");
    }
    const visible = v.Hills["Visible background hills"];
    if (visible) for (const layer of farLayers) {
      const show = visible[layerLabel(layer.name)];
      if (show === undefined || show === !hiddenLayers.has(layer.name)) continue;
      if (show) hiddenLayers.delete(layer.name); else hiddenLayers.add(layer.name);
      changed.add("hills");
    }
    const wasLive = WIND.live;
    WIND.live = v.Wind["Seattle live wind"]; WIND.strength = v.Wind.Strength; WIND.gusts = v.Wind.Gusts;
    if (WIND.live && !wasLive) h.ensureLive();
    h.retarget();
    h.paused = v.Wind["Pause wind"];
    for (const [key, label] of PAL_INFO) {
      const hex = toHex(v.Colours[label]);
      if (PAL[key] !== hex) { PAL[key] = hex; if (key === "sky") h.applySky(); }
    }
    if (changed.has("frame")) h.applyFrame();
    if (changed.has("len") || changed.has("depth")) h.scheduleOcclusion();
    if (changed.has("depth")) h.scheduleLight();
    if ([...changed].some(key => RESHAPE.has(key))) h.scheduleReshape();
    // a new hill style shows its own controls (humps and background mounds, or the banner's hills)
    if (P.hills !== style) { style = P.hills; queueMicrotask(() => kit.updateConfig(config())); }
  }

  function resetColours() {
    kit.setValues({ Colours: Object.fromEntries(PAL_INFO.map(([key, label]) => [label, PAL_DEFAULT[key]])) });
  }
  // Reset: the tuned look again (colours stay, like the grass-hills Reset button). The panel is
  // rebuilt for the default hill style and set to the defaults while muted, then applied once.
  function resetAll() {
    const st = stateDefault(), target = config(st);
    const layersWereHidden = hiddenLayers.size > 0;
    hiddenLayers.clear();
    muted = true;
    style = st.P.hills;
    kit.updateConfig(target);
    const { Colours, Reset, ...rest } = target;
    kit.setValues(valuesOf(rest));
    muted = false;
    apply(kit.getValues());
    if (layersWereHidden) h.scheduleReshape();
  }

  window.__tune = { kit, root };
}

// a config's defaults as a plain values object (for setValues)
function valuesOf(c) {
  const out = {};
  for (const [key, value] of Object.entries(c)) {
    if (key === "_collapsed") continue;
    if (Array.isArray(value)) out[key] = value[0];
    else if (value && typeof value === "object" && "type" in value) { if (value.type !== "action") out[key] = value.default; }
    else if (value && typeof value === "object") out[key] = valuesOf(value);
    else out[key] = value;
  }
  return out;
}
