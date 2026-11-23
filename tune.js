// DialKit tune panel: every control from the grass-hills page, live on the hero.
// Loaded only with ?tune (see the end of index.html). DialKit 2.1.0, vanilla build, vendored.
//
//   View        Scene / Terrain, Banner / Hero 16:9
//   Desk        show, left/right, near/far, elevation, size, angle, monitor size
//   Coffee mug  left/right, back/front, size
//   Hills       style, height, background mounds, humps, width, circled hills, banner hills
//   Light       haze, overall, depth of field, glow
//   Grass       impact radius, length, density (15–300%), base, lavender
//   Wind        Seattle live wind, strength, gusts, pause
//   Colours     all 14 pickers, reset colours
//   Reset       back to the tuned defaults (colours stay, as in grass-hills)
import { sheetDials, sheetMotion } from "./sheet-motion.js";
import { createDialKit, createDialRoot } from "./vendor/dialkit/index.js";
import { motionDials, portfolioMotion } from "./page-scroll.js?v=about";

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
  ["Grass", "Density (%)", "density", 15, 300, 1, 100],   // above 100% grows more blades
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
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(c)) return c.slice(0, 7).toLowerCase();   // #rrggbbaa: keep rgb exact
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

let dialRoot;
function getDialRoot() {
  dialRoot ??= loadStyles().then(() => createDialRoot({
    position: "bottom-right", theme: "system", defaultOpen: true,
  }));
  return dialRoot;
}

let desktopFontDatabase;
function openDesktopFontDatabase() {
  desktopFontDatabase ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("portfolio-homepage-fonts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("fonts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return desktopFontDatabase;
}

function createIntroFontControl(element, fallback, property = "--intro-font", key = element.id) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".woff2,.woff,.ttf,.otf";
  const desktopFamily = `Portfolio desktop ${key}`;
  let desktopFace;
  let fontRevision = 0;
  let googleFamily = "";
  let googleStylesheet;
  let googleTimer;

  async function applyDesktopFont(data, revision) {
    const face = await new FontFace(desktopFamily, data).load();
    if (revision !== fontRevision) return false;
    if (desktopFace) document.fonts.delete(desktopFace);
    desktopFace = face;
    document.fonts.add(face);
    return true;
  }

  return {
    choose: () => input.click(),
    async restore(refresh) {
      const revision = fontRevision;
      try {
        const database = await openDesktopFontDatabase();
        const store = database.transaction("fonts").objectStore("fonts");
        const request = store.get(key);
        request.onsuccess = async () => {
          try {
            if (request.result && await applyDesktopFont(request.result, revision)) refresh();
          } catch (error) {
            console.warn("Saved desktop font could not load", error);
          }
        };
      } catch (error) {
        console.warn("Saved desktop fonts are unavailable", error);
      }
    },
    onChoose(selectDesktop) {
      input.addEventListener("change", async () => {
        const file = input.files[0];
        input.value = "";
        if (!file) return;
        const revision = ++fontRevision;
        let data;
        try {
          data = await file.arrayBuffer();
          if (!await applyDesktopFont(data, revision)) return;
        } catch {
          if (revision === fontRevision) alert("This font could not be loaded. Choose a WOFF2, WOFF, TTF, or OTF file.");
          return;
        }
        selectDesktop();
        try {
          const database = await openDesktopFontDatabase();
          if (revision !== fontRevision) return;
          const transaction = database.transaction("fonts", "readwrite");
          transaction.objectStore("fonts").put(data, key);
          transaction.onabort = () => console.warn("Desktop font could not be saved for the next visit", transaction.error);
        } catch (error) {
          console.warn("Desktop font could not be saved for the next visit", error);
        }
      });
    },
    apply(selection, requestedFamily, installedFamily = "") {
      const nextGoogleFamily = selection === "Google Font" ? requestedFamily.trim() : "";
      if (nextGoogleFamily !== googleFamily) {
        googleFamily = nextGoogleFamily;
        clearTimeout(googleTimer);
        googleStylesheet?.remove();
        if (googleFamily) {
          googleTimer = setTimeout(() => {
            const params = new URLSearchParams({ family: googleFamily, display: "swap" });
            googleStylesheet = document.createElement("link");
            googleStylesheet.rel = "stylesheet";
            googleStylesheet.href = `https://fonts.googleapis.com/css2?${params}`;
            document.head.append(googleStylesheet);
          }, 350);
        }
      }
      let family = selection;
      if (selection === "Google Font") family = googleFamily || fallback;
      if (selection === "Desktop font") family = installedFamily.trim() || desktopFace?.family || fallback;
      element.style.setProperty(property, `"${CSS.escape(family)}", "${fallback}"`);
    },
  };
}

// Homepage panel (?tune): the home's sizes and spacing first, then each part's copy, colour and font.
// Slider defaults are read from homepage.css, so the stylesheet stays the one source of truth.
//
//   Text sizes   name, headline, list; headline line height + tracking; list line height
//   Spacing      headline → list, row gap, year → place, place → role, block centre, name top / left
//   Name · Headline        copy, colour, font (incl. a Google or desktop font)
//   Years & places · Roles colour, font
export async function mountHomepageTune() {
  await getDialRoot();
  const homepage = document.querySelector(".homepage");
  const css = getComputedStyle(homepage);
  const fontSelect = defaultValue => ({
    type: "select",
    options: ["Season Mix", "Necto Mono", "Stevie Sans Book", "Outfit", "Google Font", "Desktop font"]
      .map(value => ({ value, label: value })),
    default: defaultValue,
  });
  const text = (defaultValue, placeholder) => ({ type: "text", default: defaultValue, placeholder });
  const colour = defaultValue => ({ type: "color", default: defaultValue });

  // [label, custom property on .homepage, min, max, step, unit]
  const DIALS = {
    "Text sizes": [
      ["Name (px)", "--name-size", 10, 40, 1, "px"],
      ["Headline (px)", "--headline-size", 14, 96, 1, "px"],
      ["List (px)", "--list-size", 10, 32, 1, "px"],
      ["Headline line height", "--headline-leading", 0.8, 2, 0.01, ""],
      ["Headline tracking (em)", "--headline-tracking", -0.08, 0.1, 0.005, "em"],
      ["List line height", "--list-leading", 1, 2.4, 0.01, ""],
    ],
    Spacing: [
      ["Headline → list (px)", "--list-gap", 0, 200, 1, "px"],
      ["Row gap (px)", "--row-gap", 0, 80, 1, "px"],
      ["Year → place (px)", "--label-gap", 0, 80, 1, "px"],
      ["Place → role (px)", "--column-gap", 0, 200, 1, "px"],
      ["Block centre (% of height)", "--block-centre", 20, 70, 1, ""],
      ["Name top (px)", "--name-top", 0, 120, 1, "px"],
      ["Name left (px)", "--name-left", 0, 120, 1, "px"],
    ],
  };
  const dials = Object.entries(DIALS).flatMap(([folder, rows]) => rows.map(([label, property, min, max, step, unit]) => ({
    folder, label, property, min, max, step, unit,
    value: +(Math.round(parseFloat(css.getPropertyValue(property)) / step) * step).toFixed(3),
  })));
  const config = {};
  for (const { folder, label, value, min, max, step } of dials) {
    (config[folder] ??= {})[label] = [value, min, max, step];
  }

  // Each part's font goes in its own custom property, so the list's two columns can differ.
  const list = homepage.querySelector(".intro-list");
  // The name is a one-item nav: its copy lives in the link's label (and the bold hover copy in
  // data-label), and its colour dial sets the selected ink; unselected it greys like the nav.
  const nameLink = homepage.querySelector("#home-link");
  const nameCopy = {
    get: () => nameLink.dataset.label,
    set: value => {
      nameLink.dataset.label = value;
      nameLink.setAttribute("aria-label", value);
      nameLink.querySelector(".nav-label").textContent = value;
    },
  };
  const headline = homepage.querySelector(".intro-headline");
  const parts = [
    { name: "Name", element: homepage.querySelector(".intro-name"), colourProperty: "--name-ink", font: "Stevie Sans Book", colour: "#1b1b1b", copy: nameCopy },
    { name: "Headline", element: headline, font: "Season Mix", colour: "#1b1b1b",
      copy: { get: () => headline.textContent, set: value => { headline.textContent = value; } } },
    { name: "Years & places", element: list, property: "--label-font", colourProperty: "--ink-50", font: "Stevie Sans Book", colour: "#1b1b1b80" },
    { name: "Roles", element: list, property: "--role-font", colourProperty: "--ink", font: "Stevie Sans Book", colour: "#1b1b1b" },
  ];
  const desktopActions = new Map();
  for (const part of parts) {
    part.control = createIntroFontControl(part.element, part.font, part.property, part.name);
    config[part.name] = {
      _collapsed: true,
      ...(part.copy ? { Text: text(part.copy.get()) } : {}),
      Colour: colour(part.colour),
      Font: fontSelect(part.font),
      "Google font family": text("", "Exact family name, e.g. Inter"),
      "Installed font name": text("", "Exact installed family name"),
      "Choose desktop font file": { type: "action" },
    };
    desktopActions.set(`${part.name}.Choose desktop font file`, part.control.choose);
  }

  const kit = createDialKit("Homepage", config, {
    id: "homepage",
    persist: { key: "grass-website-homepage-v4" },   // v4: her mock (centred headline + list)
    onAction: path => desktopActions.get(path)?.(),
  });

  function apply(values) {
    for (const { folder, label, property, value: defaultValue, unit } of dials) {
      const value = values[folder][label];
      if (value === defaultValue) homepage.style.removeProperty(property);
      else homepage.style.setProperty(property, value + unit);
    }
    for (const { name, element, colour: defaultColour, colourProperty, control, copy } of parts) {
      const settings = values[name];
      if (copy && settings.Text !== copy.get()) copy.set(settings.Text);
      const value = settings.Colour === defaultColour ? "" : settings.Colour;
      if (colourProperty) element.style.setProperty(colourProperty, value);
      else element.style.color = value;
      control.apply(settings.Font, settings["Google font family"], settings["Installed font name"]);
    }
  }
  kit.subscribe(apply);
  const refresh = () => apply(kit.getValues());
  for (const { name, control } of parts) {
    control.onChoose(() => {
      kit.setValue(`${name}.Installed font name`, "");
      kit.setValue(`${name}.Font`, "Desktop font");
      refresh();
    });
    control.restore(refresh);
  }
  refresh();
  createDialKit("Scroll motion", motionDials, {
    id: "portfolio-scroll-motion",
    persist: { key: "portfolio-scroll-motion" },
  }).subscribe(values => portfolioMotion.dispatchEvent(new CustomEvent("change", { detail: values })));
  const opening = createDialKit("Project opening", sheetDials, {
    id: "project-opening", persist: { key: "portfolio-project-opening-v1" },
  });
  const configureOpening = values => Object.assign(sheetMotion, values);
  opening.subscribe(configureOpening);
  configureOpening(opening.getValues());
  mountCardHoverTune();
}

/* Card hover panel (?tune): the Work covers' hover spring, lift and shadow.
 *   Spring        physics (stiffness / damping / mass) or time (duration / bounce), as DialKit offers
 *   Lift          how far the cover scales up
 *   Shadow        y, x, blur, opacity, colour of the drop shadow it casts
 *   Hold hover    pins every cover in its hovered state, to judge the shadow
 *   Replay        bounces the first cover in and back out
 * The spring is sampled into a CSS linear() curve with the same maths as the shipped default, and every
 * value lands as a custom property on .work-rail (index.html keeps the defaults). */
const CARD_HOVER = { stiffness: 151, damping: 21, mass: 1.1, lift: 1.025, y: 15, x: 0, blur: 8, opacity: 0.1, colour: "#1b1b1b6e" };   // her ?tune values, 2026-11-23

function springEasing(spring) {
  let { stiffness, damping, mass = 1 } = spring;
  if (spring.visualDuration !== undefined) {   // time mode → physics, the way Motion converts it
    const root = (2 * Math.PI) / (Math.max(0.05, spring.visualDuration) * 1.2);
    stiffness = root * root;
    damping = 2 * Math.min(1, Math.max(0.05, 1 - (spring.bounce ?? 0))) * root;
    mass = 1;
  }
  const w0 = Math.sqrt(stiffness / Math.max(0.01, mass));
  const zeta = damping / (2 * Math.sqrt(stiffness * Math.max(0.01, mass)));
  const offset = t => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    if (zeta === 1) return Math.exp(-w0 * t) * (1 + w0 * t);
    const root = Math.sqrt(zeta * zeta - 1), r1 = -w0 * (zeta - root), r2 = -w0 * (zeta + root);
    const c2 = -r1 / (r2 - r1);
    return (1 - c2) * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  };
  let end = 0;
  for (let t = 0; t <= 3; t += 0.004) if (Math.abs(offset(t)) > 0.005) end = t;   // settled within 0.5%
  const duration = Math.max(0.08, end + 0.004);
  const points = [];
  for (let i = 0; i <= 60; i++) points.push(+(1 - offset((duration * i) / 60)).toFixed(4));
  points[60] = 1;
  return { time: Math.round(duration * 1000) + "ms", easing: `linear(${points.join(", ")})` };
}

export async function mountCardHoverTune() {
  await getDialRoot();
  const rail = document.querySelector(".work-rail");
  if (!rail) return;
  const d = CARD_HOVER;
  let replayTimer = 0;
  const kit = createDialKit("Card hover", {
    Spring: { type: "spring", stiffness: d.stiffness, damping: d.damping, mass: d.mass },
    "Lift (scale)": [d.lift, 1, 1.1, 0.005],
    Shadow: {
      "Y offset (px)": [d.y, -20, 60, 1],
      "X offset (px)": [d.x, -40, 40, 1],
      "Blur (px)": [d.blur, 0, 80, 1],
      Opacity: [d.opacity, 0, 1, 0.01],
      Colour: { type: "color", default: d.colour },
    },
    "Hold hover": false,
    Replay: { type: "action", label: "Replay on first card" },
  }, {
    id: "card-hover",
    persist: { key: "grass-website-card-hover" },
    onAction: path => {
      if (path !== "Replay") return;
      const cover = rail.querySelector(".work-card-cover");
      if (!cover) return;
      const { time } = springEasing(kit.getValues().Spring);
      cover.removeAttribute("data-hover-replay");
      void cover.offsetWidth;   // restart even mid-replay
      cover.setAttribute("data-hover-replay", "");
      clearTimeout(replayTimer);
      replayTimer = setTimeout(() => cover.removeAttribute("data-hover-replay"), parseFloat(time) + 300);
    },
  });

  function apply(values) {
    const { time, easing } = springEasing(values.Spring);
    const shadow = values.Shadow;
    const hex = toHex(shadow.Colour);
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    rail.style.setProperty("--cover-time", time);
    rail.style.setProperty("--cover-spring", easing);
    rail.style.setProperty("--cover-lift", String(values["Lift (scale)"]));
    rail.style.setProperty("--cover-shadow", `rgba(${r}, ${g}, ${b}, ${shadow.Opacity}) ${shadow["X offset (px)"]}px ${shadow["Y offset (px)"]}px ${shadow["Blur (px)"]}px`);
    rail.toggleAttribute("data-hover-held", Boolean(values["Hold hover"]));
  }
  kit.subscribe(apply);
  apply(kit.getValues());
}

export async function mountTune(h,game) {
  const { P, PAL, PAL_DEFAULT, PAL_INFO, DEFAULTS, LAYERS, GIRL, HIDE, WIND, hiddenLayers } = h;
  const farLayers = LAYERS.filter(layer => layer.d > GIRL.d);   // the banner's background hills

  // what the panel shows: the scene as it is now, or the tuned defaults (for Reset)
  const stateNow = () => ({
    P, hideFar: HIDE.far, hidden: hiddenLayers, live: WIND.live, strength: WIND.strength, gusts: WIND.gusts,
    showDesk: h.showDesk, paused: h.paused,
  });
  const stateDefault = () => ({
    P: { ...DEFAULTS }, hideFar: true, hidden: new Set(), live: true, strength: DEFAULTS.wind, gusts: DEFAULTS.gust,
    showDesk: false, paused: false,
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

  const root = await getDialRoot();
  const {mountCharacterDial}=await import("./character-dial.js?v=scarf-ball");
  await mountCharacterDial(P,game);
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
    if (changed.has("density")) h.scheduleBlades();
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
