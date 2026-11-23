// Card → sheet, edge peek and back chip: ported value for value from the Framer homepage
// (PageProjectInteractions.tsx — SHEET, SHEET_MORPH, SHEET_BLUR and BACK on Home), so both sites open
// a case study the same way.
//
//     0ms  press: the card dips to 0.98 under the pointer and lifts back on release
//     0ms  click: the sheet grows out of the card's exact rect on one critically damped spring (0.44s
//          response) and fades in over its first 140ms, so the card dissolves into it. Nothing waits
//          for the case study to load.
//  ~310ms  once the sheet is 94% open and the case study can paint, the page fades in (240ms)
//   hover  the 16px gap around the sheet is the close button: the back chip follows the pointer, the
//          sheet slides 24px away from that edge, its shadow deepens and the blur behind it clears
//   close  the page fades out (110ms) while the sheet springs back into the card (0.34s response) and
//          dissolves over its last stretch. A close mid-open turns around from wherever the sheet is.
// Reduced motion: cross-fades only.

const SHEET = { margin: 16, peek: 24, chip: 40 }; // px; the look lives in the #project-sheet CSS
const SHEET_TIMING = { fontWait: 350, loadError: 15000, poll: 30 }; // ms
const SHEET_MORPH = {
  open: appleSpring(0.44),
  close: appleSpring(0.34),
  surfaceIn: 140, // ms
  contentIn: 240, // ms
  contentAt: 0.94, // open progress before the page may show, so it never shows mid-stretch
  contentOut: 110, // ms
  dissolveFrom: 0.7, // close progress where the sheet starts fading into the card
  dissolveTo: 0.98,
  zoom: 0.96, // a sheet without a card on screen zooms in from, and back to, this scale
  zoomIn: 180, // ms
  zoomOut: 0.9, // close progress by which a centred sheet has faded out
  press: 0.98,
  pressIn: 120, // ms
  pressOut: 260, // ms
  ease: "cubic-bezier(0.23, 1, 0.32, 1)",
};
const CHIP_SPRING = { stiffness: 600, damping: 34, mass: 1 }; // the chip popping in and out
const TURN_SPRING = { stiffness: 300, damping: 24, mass: 1 }; // the arrow turning up on phones
const MORPH_REST = "translate3d(0px, 0px, 0px) scale(1, 1)";
// The Framer pages the case-study sheets load (vercel.json proxies them onto this origin).
const FRAMER_SITE = "https://aashikaashok.com";
// Inside the sheet: the case study's own floating nav goes, and so does its scrollbar.
const FRAME_CSS = 'html{scrollbar-width:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}[data-framer-name="Dock Navigation" i],[data-docknav-dock]{display:none!important}';

const sheet = document.getElementById("project-sheet");
const strip = sheet.querySelector(".sheet-strip");
const box = sheet.querySelector(".sheet-box");
const panel = sheet.querySelector(".sheet-panel");
const content = sheet.querySelector(".sheet-content");
const chip = sheet.querySelector(".sheet-chip");
const rail = document.querySelector(".work-rail");
const cards = [...document.querySelectorAll(".work-card")];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");

let entry = null; // { card, index, url, study, title, scroll, morph }
let ready = false, closing = false, peeking = false, pressed = false, fullyOpen = false;
let growAnimation = null; // the open spring, while it runs
let pageAt = 0; // performance.now() when the page may start fading in
let stopLoading = () => {};
let stopClosing = () => {};
let closed = null; // resolves when the running close has finished
let pageWidth = 0; // a fixed-width page's layout width, scaled down to fit on touch screens

/* ── Springs: the same maths as the Framer file ─────────────────────────────────────────── */

// Apple's two spring knobs: response (seconds to get there) and damping ratio (1 = no overshoot).
function appleSpring(response, dampingRatio = 1) {
  return {
    stiffness: Math.pow((2 * Math.PI) / response, 2),
    damping: (4 * Math.PI * dampingRatio) / response,
    mass: 1,
  };
}

// A damped spring's progress (0 → 1) at time t seconds, and how long it takes to settle.
function springProgress({ stiffness, damping, mass }, velocity = 0) {
  const w0 = Math.sqrt(stiffness / Math.max(0.01, mass));
  const zeta = damping / (2 * Math.sqrt(stiffness * Math.max(0.01, mass)));
  const offsetAt = t => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0 - velocity) / wd) * Math.sin(wd * t));
    }
    if (zeta === 1) return Math.exp(-w0 * t) * (1 + (w0 - velocity) * t);
    const root = Math.sqrt(zeta * zeta - 1);
    const r1 = -w0 * (zeta - root);
    const r2 = -w0 * (zeta + root);
    const c2 = (-velocity - r1) / (r2 - r1);
    return (1 - c2) * Math.exp(r1 * t) + c2 * Math.exp(r2 * t);
  };
  let end = 0;
  for (let t = 0; t <= 4; t += 0.004) if (Math.abs(offsetAt(t)) > 0.0015) end = t;
  return { duration: Math.max(0.06, end + 0.004), at: t => 1 - offsetAt(t) };
}

// The spring as a WAAPI/CSS timing: sampled into linear(), so it stays smooth while the page hydrates.
const linearEasing = typeof CSS !== "undefined" && CSS.supports("transition-timing-function", "linear(0, 1)");
function springCurve(spec, velocity = 0) {
  const { duration, at } = springProgress(spec, velocity);
  if (!linearEasing) return { duration: duration * 1000, easing: SHEET_MORPH.ease };
  const steps = Math.max(10, Math.min(90, Math.round(duration * 120)));
  const points = [];
  for (let i = 0; i < steps; i++) points.push(at((duration * i) / steps).toFixed(4));
  points.push("1");
  return { duration: duration * 1000, easing: `linear(${points.join(", ")})` };
}

// When a spring (0 → 1) first reaches `progress`, in ms.
function springTime(spec, progress, velocity = 0) {
  const { duration, at } = springProgress(spec, velocity);
  for (let t = 0; t < duration; t += 0.004) if (at(t) >= progress) return t * 1000;
  return duration * 1000;
}

// The transform (origin 0 0) that lays a box the size of `sheetBox` exactly over `target`.
function morphTransform(target, sheetBox) {
  return `translate3d(${target.left - sheetBox.left}px, ${target.top - sheetBox.top}px, 0px) scale(${target.width / Math.max(1, sheetBox.width)}, ${target.height / Math.max(1, sheetBox.height)})`;
}

// The sheet's own box scaled about its centre: where a sheet with no card on screen zooms from and to.
function zoomBox(rect, scale = SHEET_MORPH.zoom) {
  return {
    left: rect.left + (rect.width * (1 - scale)) / 2,
    top: rect.top + (rect.height * (1 - scale)) / 2,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

// A card's rect, only while some of it is on screen (the rail scrolls sideways).
function visibleBox(element) {
  if (!element?.isConnected) return null;
  const rect = element.getBoundingClientRect();
  const onScreen = rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight;
  return rect.width > 0 && rect.height > 0 && onScreen ? rect : null;
}

// The chip's pop and the arrow's turn ride CSS transitions; hand them the springs as linear() curves.
for (const [name, spec] of [["chip", CHIP_SPRING], ["turn", TURN_SPRING]]) {
  const { duration, easing } = springCurve(spec);
  sheet.style.setProperty(`--${name}-time`, `${Math.round(duration)}ms`);
  sheet.style.setProperty(`--${name}-ease`, easing);
}
sheet.style.setProperty("--sheet-margin", SHEET.margin + "px");

/* ── Card press ─────────────────────────────────────────────────────────────────────────── */

const pressing = new WeakMap();
// Press feedback rides the individual `scale` property, so it never fights a transform the card owns.
function pressCard(card, down) {
  if (typeof card.animate !== "function" || reduced.matches) return;
  const now = parseFloat(getComputedStyle(card).getPropertyValue("scale"));
  const from = Number.isFinite(now) ? now : 1; // "none" at rest
  pressing.get(card)?.cancel();
  pressing.delete(card);
  if (!down && Math.abs(from - 1) < 0.001) return;
  const animation = card.animate(
    [{ scale: String(from) }, { scale: String(down ? SHEET_MORPH.press : 1) }],
    { duration: down ? SHEET_MORPH.pressIn : SHEET_MORPH.pressOut, easing: SHEET_MORPH.ease, fill: "forwards" }
  );
  pressing.set(card, animation);
  if (!down) animation.onfinish = () => {
    animation.cancel();
    pressing.delete(card);
  };
}

/* ── State → attributes (the CSS reads these) ───────────────────────────────────────────── */

function sync() {
  const chipVisible = Boolean(entry) && ready && !closing && (finePointer.matches ? peeking : true);
  const backActive = finePointer.matches && chipVisible; // the chip is under the pointer
  sheet.toggleAttribute("data-ready", ready);
  sheet.toggleAttribute("data-chip", chipVisible);
  sheet.toggleAttribute("data-blurred", Boolean(entry) && !closing && !backActive);
  sheet.toggleAttribute("data-peek", peeking);
  sheet.toggleAttribute("data-pressed", pressed);
  sheet.toggleAttribute("data-closing", closing);
  panel.style.willChange = !fullyOpen || closing ? "transform, opacity" : "auto";
}

/* ── The gap around the sheet: peek, back chip, close ───────────────────────────────────── */

// The sheet slides away from the edge under the pointer, revealing more of the page there. (Framer
// slides right for every edge but the top, which on the right and bottom edges lands the sheet under
// the pointer and drops the peek; here each edge pushes the sheet away from itself.)
function peekAt(x, y) {
  const edges = [["top", y], ["bottom", innerHeight - y], ["left", x], ["right", innerWidth - x]];
  const [edge] = edges.reduce((nearest, next) => (next[1] < nearest[1] ? next : nearest));
  const shift = SHEET.peek;
  box.style.transform = {
    top: `translate3d(0px, ${shift}px, 0px)`,
    bottom: `translate3d(0px, ${-shift}px, 0px)`,
    left: `translate3d(${shift}px, 0px, 0px)`,
    right: `translate3d(${-shift}px, 0px, 0px)`,
  }[edge];
}

function placeChip(x, y) {
  // Keep the whole tile on screen, even when the pointer hugs the window edge.
  const half = SHEET.chip / 2 + 4;
  const cx = Math.min(innerWidth - half, Math.max(half, x));
  const cy = Math.min(innerHeight - half, Math.max(half, y));
  chip.style.transform = `translate3d(${cx - SHEET.chip / 2}px, ${cy - SHEET.chip / 2}px, 0)`;
}

// Touch screens have no hover, so the chip rests in the middle of the top gap (and takes taps there).
function restChip() {
  if (!finePointer.matches) placeChip(innerWidth / 2, SHEET.margin / 2);
}

function startPeek(event) {
  if (event.pointerType === "touch" || closing || !entry) return;
  placeChip(event.clientX, event.clientY);
  peekAt(event.clientX, event.clientY);
  if (!peeking) {
    peeking = true;
    sync();
  }
}
strip.addEventListener("pointerenter", startPeek);
strip.addEventListener("pointermove", startPeek);
strip.addEventListener("pointerleave", () => {
  if (closing) return;
  peeking = false;
  pressed = false;
  box.style.transform = "";
  sync();
});
strip.addEventListener("pointerdown", () => {
  pressed = true;
  sync();
});
strip.addEventListener("pointerup", () => {
  pressed = false;
  sync();
});
strip.addEventListener("click", () => dismiss());
chip.addEventListener("click", () => dismiss());
addEventListener("resize", restChip);
finePointer.addEventListener("change", () => {
  restChip();
  sync();
});

/* ── Loading the case study ─────────────────────────────────────────────────────────────── */

const samePath = (a, b) => (a.replace(/\/+$/, "") || "/") === (b.replace(/\/+$/, "") || "/");
const isFramerSite = url => url.origin === location.origin || /(^|\.)aashikaashok\.com$/.test(url.hostname);
const studyPath = card => new URL(card.href).pathname;
const cardTitle = card => card.querySelector(".work-caption p")?.textContent.trim() || "Case study";

function cardForPath(pathname) {
  return cards.find(card => card.hasAttribute("data-study") && samePath(studyPath(card), pathname));
}

function linkTarget(element, base) {
  // Framer renders nested links as <span href data-nested-link>, so accept those as well as anchors.
  const anchor = element?.closest?.("a[href], [data-nested-link][href]");
  const href = anchor?.getAttribute("href");
  if (!anchor || !href || anchor.hasAttribute("download")) return null;
  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return null;
  try {
    const url = new URL(href, base);
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

// A link inside the sheet: another project swaps in, home closes, anything else leaves for real.
function followFromSheet(url) {
  if (!isFramerSite(url)) {
    location.assign(url.href);
    return;
  }
  if (samePath(url.pathname, "/")) {
    dismiss();
    return;
  }
  const card = cardForPath(url.pathname);
  if (card) swapTo(card);
  else location.assign(FRAMER_SITE + url.pathname + url.search + url.hash);
}

function showLoadError() {
  if (!entry || content.querySelector(".sheet-error")) return;
  const error = document.createElement("div");
  error.className = "sheet-error";
  error.setAttribute("role", "alert");
  const message = document.createElement("p");
  message.textContent = "This page is taking longer to load.";
  const direct = document.createElement("a");
  direct.href = entry.card.href;
  direct.textContent = "Open the page directly";
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = "Go back";
  back.addEventListener("click", () => dismiss());
  error.append(message, direct, back);
  content.append(error);
}

function reveal() {
  if (!entry || ready) return;
  ready = true;
  sync();
  const frame = content.querySelector("iframe");
  if (entry.scroll) {
    try { frame?.contentWindow.scrollTo(entry.scroll.x, entry.scroll.y); } catch {}
  }
  // The page can paint: fade it in once the sheet is nearly open, so it never shows mid-stretch.
  content.getAnimations().forEach(animation => animation.cancel());
  content.style.opacity = "1";
  if (!reduced.matches && typeof content.animate === "function") {
    content.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: SHEET_MORPH.contentIn,
      delay: Math.max(0, pageAt - performance.now()),
      easing: SHEET_MORPH.ease,
      fill: "backwards",
    });
  }
  // Keyboard scrolling belongs to the case study once it's in.
  try {
    if (frame && (!document.activeElement || sheet.contains(document.activeElement))) frame.contentWindow.focus();
  } catch {}
}

// Wait for the case study (or preview image) to be able to paint, then reveal it.
function load() {
  stopLoading();
  const { url } = entry;
  let disposed = false;
  const timers = [setTimeout(() => {
    if (disposed || ready) return;
    showLoadError();
    reveal();
  }, SHEET_TIMING.loadError)];

  if (!entry.study) {
    const image = content.querySelector("img");
    image.decode().then(() => !disposed && reveal(), () => {
      if (disposed) return;
      showLoadError();
      reveal();
    });
    stopLoading = () => {
      disposed = true;
      timers.forEach(clearTimeout);
    };
    return;
  }

  const frame = content.querySelector("iframe");
  const target = new URL(url, location.href);
  const wired = new WeakSet();
  const decorated = new WeakSet();
  let waitingForFonts = false;
  let saveTimer = 0;
  const readDoc = () => {
    try { return frame.contentDocument; } catch { return null; }
  };
  const wire = doc => {
    const view = doc.defaultView;
    if (!view || wired.has(doc)) return;
    wired.add(doc);
    // One history entry per sheet: the case study's own pushState replaces instead, so Back lands on Work.
    try {
      const pageHistory = view.history;
      const replace = pageHistory.replaceState.bind(pageHistory);
      pageHistory.pushState = (data, unused, next) => replace(data, unused, next);
    } catch {}
    doc.addEventListener("click", event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const found = linkTarget(event.target, doc.baseURI);
      if (!found) return;
      const here = new URL(doc.URL);
      if (found.origin === here.origin && samePath(found.pathname, here.pathname)) return; // in-page links stay
      event.preventDefault();
      event.stopPropagation();
      followFromSheet(found);
    }, true);
    view.addEventListener("keydown", event => {
      if (event.key === "Escape") dismiss();
    });
    // Remember how far in the reader is, so Forward reopens the case study where they left it.
    view.addEventListener("scroll", () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (!entry || history.state?.projectIndex !== entry.index) return;
        try {
          history.replaceState({ ...history.state, sheetScroll: { x: view.scrollX, y: view.scrollY } }, "");
        } catch {}
      }, 150);
    }, { passive: true });
  };
  const decorate = doc => {
    if (decorated.has(doc) || !doc.head || !doc.body) return;
    decorated.add(doc);
    doc.documentElement.setAttribute("data-case-study-sheet", "");
    const style = doc.createElement("style");
    style.textContent = FRAME_CSS;
    doc.head.append(style);
    // A page without phone breakpoints asks for a fixed viewport (Framer writes width=1200). Phones honour
    // that by zooming out; an iframe ignores it, so on touch screens the sheet lays it out there and scales.
    const viewport = /(?:^|[,;\s])width\s*=\s*(\d+)/i.exec(doc.querySelector('meta[name="viewport"]')?.getAttribute("content") || "");
    pageWidth = viewport ? Number(viewport[1]) : 0;
    fitPage();
    const color = doc.defaultView?.getComputedStyle(doc.body).backgroundColor;
    if (color && color !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(color)) panel.style.setProperty("--page-color", color);
  };
  const check = () => {
    const doc = readDoc();
    if (!doc) {
      if (frame.contentWindow) reveal(); // another origin: show it as it is
      return;
    }
    let path = "";
    try { path = new URL(doc.URL).pathname; } catch {}
    if (doc.URL === "about:blank" || !samePath(path, target.pathname)) return;
    wire(doc);
    if (doc.readyState === "loading" || waitingForFonts) return;
    decorate(doc);
    const fonts = doc.fonts;
    if (!fonts || fonts.status === "loaded") {
      reveal();
      return;
    }
    waitingForFonts = true;
    timers.push(setTimeout(reveal, SHEET_TIMING.fontWait));
    fonts.ready.then(reveal, reveal);
  };
  const poll = setInterval(() => {
    check();
    if (ready) clearInterval(poll);
  }, SHEET_TIMING.poll);
  const onLoad = () => {
    const doc = readDoc();
    if (doc && doc.URL === "about:blank") return;
    check();
  };
  frame.addEventListener("load", onLoad);
  check();
  stopLoading = () => {
    disposed = true;
    clearInterval(poll);
    clearTimeout(saveTimer);
    timers.forEach(clearTimeout);
    frame.removeEventListener("load", onLoad);
  };
}

function fitPage() {
  const frame = content.querySelector("iframe");
  if (!frame) return;
  const width = content.clientWidth;
  const scale = pageWidth && !finePointer.matches && width && width < pageWidth ? width / pageWidth : 1;
  Object.assign(frame.style, scale < 1
    ? { width: pageWidth + "px", height: content.clientHeight / scale + "px", transform: `scale(${scale})`, transformOrigin: "0 0" }
    : { width: "", height: "", transform: "", transformOrigin: "" });
}
new ResizeObserver(fitPage).observe(content);

function mountContent() {
  content.replaceChildren();
  if (entry.study) {
    const frame = document.createElement("iframe");
    frame.title = entry.title;
    frame.src = entry.url; // set before it's attached, so loading it adds no history entry
    content.append(frame);
  } else {
    const image = document.createElement("img");
    image.alt = entry.title;
    image.src = entry.url;
    content.append(image);
  }
}

/* ── Open ───────────────────────────────────────────────────────────────────────────────── */

function entryFor(card, options = {}) {
  const study = card.hasAttribute("data-study");
  return {
    card,
    index: cards.indexOf(card),
    study,
    url: study ? studyPath(card) : card.href,
    title: cardTitle(card),
    scroll: options.scroll,
    morph: !options.restored,
  };
}

function openSheet(card, options = {}) {
  if (entry && entry.card === card && !closing) return;
  if (entry) finishClose(); // a running close gives way at once
  entry = entryFor(card, options);
  ready = false;
  closing = false;
  peeking = false;
  pressed = false;
  fullyOpen = false;
  pageWidth = 0;
  sheet.setAttribute("aria-label", entry.title);
  panel.style.removeProperty("--page-color");
  box.style.transition = "";
  box.style.transform = "";
  panel.style.transform = "";
  panel.style.opacity = "0";
  content.style.opacity = "0";
  mountContent();
  sheet.showModal();
  panel.focus({ preventScroll: true });
  restChip();
  sync();
  grow();
  load();
}

// Card → sheet on the next frame, while the page is still loading.
function grow() {
  const to = panel.getBoundingClientRect();
  const fromCard = entry.morph ? visibleBox(entry.card) : null;
  const from = fromCard ?? zoomBox(to);
  panel.style.transformOrigin = "0 0";
  panel.style.opacity = "1";
  growAnimation = null;
  if (!entry.morph || typeof panel.animate !== "function") {
    // A sheet restored by a reload is simply there.
    fullyOpen = true;
    pageAt = 0;
    sync();
    return;
  }
  const animations = [];
  if (reduced.matches) {
    animations.push(panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease" }));
    pageAt = 0;
  } else {
    animations.push(
      panel.animate([{ transform: morphTransform(from, to) }, { transform: MORPH_REST }], springCurve(SHEET_MORPH.open)),
      panel.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: fromCard ? SHEET_MORPH.surfaceIn : SHEET_MORPH.zoomIn,
        easing: SHEET_MORPH.ease,
      })
    );
    growAnimation = animations[0];
    pageAt = performance.now() + springTime(SHEET_MORPH.open, SHEET_MORPH.contentAt);
  }
  // One start time, so the surface and its fade never drift apart.
  const start = document.timeline.currentTime;
  if (start !== null) animations.forEach(animation => { animation.startTime = start; });
  animations[0].onfinish = () => {
    fullyOpen = true;
    sync();
  };
}

// Another project, linked from inside the open sheet, takes its place without closing.
function swapTo(card) {
  if (!entry || closing || card === entry.card) return;
  const frame = content.querySelector("iframe");
  entry = { ...entryFor(card), morph: entry.morph };
  sheet.setAttribute("aria-label", entry.title);
  frame.title = entry.title;
  try {
    history.replaceState({ ...history.state, projectIndex: entry.index, sheetScroll: undefined }, "", "#work");
  } catch {}
  bringIntoView(card); // so the close lands on the card that's open now
  ready = false;
  sync();
  content.getAnimations().forEach(animation => animation.cancel());
  content.style.opacity = "0";
  content.querySelector(".sheet-error")?.remove();
  try {
    frame.contentWindow.location.replace(new URL(entry.url, location.href).href);
  } catch {
    frame.src = entry.url;
  }
  load();
}

function bringIntoView(card) {
  const rect = card.getBoundingClientRect();
  const railRect = rail.getBoundingClientRect();
  if (rect.left >= railRect.left && rect.right <= railRect.right) return;
  const inset = parseFloat(getComputedStyle(rail).scrollPaddingInlineStart) || 0;
  rail.scrollTo({ left: rail.scrollLeft + rect.left - railRect.left - inset, behavior: "instant" });
}

/* ── Close ──────────────────────────────────────────────────────────────────────────────── */

function closeSheet() {
  if (!entry) return Promise.resolve();
  if (closing) return closed;
  closing = true;
  let done;
  closed = new Promise(resolve => { done = resolve; });
  sync();

  // Presentation values first: a close mid-open reverses from wherever the sheet is right now.
  const shownStyle = getComputedStyle(panel);
  const shown = new DOMMatrixReadOnly(shownStyle.transform === "none" ? undefined : shownStyle.transform);
  const surface = Number(shownStyle.opacity);
  const page = Number(getComputedStyle(content).opacity);
  // Closing mid-open: hand the open spring's velocity to the close, so the sheet turns around in one
  // continuous motion instead of stopping dead. In close progress it points away from the card.
  let velocity = 0;
  if (growAnimation?.playState === "running" && growAnimation.currentTime !== null) {
    const opening = springProgress(SHEET_MORPH.open);
    const t = Number(growAnimation.currentTime) / 1000;
    const reached = opening.at(t);
    const speed = (opening.at(t + 0.004) - reached) / 0.004;
    if (reached > 0.05) velocity = -speed / reached;
  }
  panel.getAnimations().forEach(animation => animation.cancel());
  content.getAnimations().forEach(animation => animation.cancel());
  // The peek holds where it is while the sheet leaves.
  const frozen = getComputedStyle(box).transform;
  box.style.transition = "none";
  box.style.transform = frozen === "none" ? "" : frozen;
  panel.style.transformOrigin = "0 0";
  panel.style.transform = "";
  const sheetBox = panel.getBoundingClientRect();
  const cardBox = visibleBox(entry.card);
  const target = cardBox ?? zoomBox(sheetBox);
  const current = `translate3d(${shown.m41}px, ${shown.m42}px, 0px) scale(${shown.a}, ${shown.d})`;

  const animations = [];
  content.style.opacity = "0";
  if (page > 0 && !reduced.matches) {
    animations.push(content.animate([{ opacity: page }, { opacity: 0 }], { duration: SHEET_MORPH.contentOut, easing: SHEET_MORPH.ease }));
  }
  panel.style.opacity = "0";
  let collapse, duration, visibleFor; // visibleFor: ms until the sheet has faded out completely
  if (reduced.matches || typeof panel.animate !== "function") {
    duration = 160;
    visibleFor = duration;
    panel.style.transform = current;
    collapse = panel.animate?.([{ opacity: surface }, { opacity: 0 }], { duration, easing: "ease" });
    if (collapse) animations.push(collapse);
  } else {
    const timing = springCurve(SHEET_MORPH.close, velocity);
    duration = timing.duration;
    const fadeFrom = Math.min(1, springTime(SHEET_MORPH.close, cardBox ? SHEET_MORPH.dissolveFrom : 0, velocity) / duration);
    const fadeTo = Math.min(1, springTime(SHEET_MORPH.close, cardBox ? SHEET_MORPH.dissolveTo : SHEET_MORPH.zoomOut, velocity) / duration);
    visibleFor = Math.max(fadeFrom, fadeTo) * duration;
    const end = morphTransform(target, sheetBox);
    panel.style.transform = end;
    collapse = panel.animate([{ transform: current }, { transform: end }], timing);
    animations.push(
      collapse,
      panel.animate([
        { opacity: surface, offset: 0 },
        { opacity: surface, offset: fadeFrom, easing: "ease" },
        { opacity: 0, offset: Math.max(fadeFrom, fadeTo) },
        { opacity: 0, offset: 1 },
      ], { duration })
    );
  }
  const start = document.timeline.currentTime;
  if (start !== null) animations.forEach(animation => { animation.startTime = start; });
  // Hand the page back (scroll, clicks) the moment the sheet is gone, not when the spring's tail settles.
  const faded = setTimeout(finishClose, visibleFor + 16);
  const fallback = setTimeout(finishClose, duration + 100);
  if (collapse) collapse.onfinish = finishClose;
  stopClosing = () => {
    clearTimeout(faded);
    clearTimeout(fallback);
    animations.forEach(animation => animation.cancel());
    done();
  };
  return closed;
}

// Everything back to rest; focus returns to the card the sheet came from.
function finishClose() {
  if (!entry) return;
  const card = entry.card;
  stopLoading();
  stopLoading = () => {};
  const stop = stopClosing;
  stopClosing = () => {};
  entry = null;
  ready = closing = peeking = pressed = fullyOpen = false;
  growAnimation = null;
  if (sheet.open) sheet.close();
  content.replaceChildren();
  panel.getAnimations().forEach(animation => animation.cancel());
  content.getAnimations().forEach(animation => animation.cancel());
  panel.style.transform = "";
  panel.style.opacity = "0";
  box.style.transition = "";
  box.style.transform = "";
  sync();
  stop();
  card.focus({ preventScroll: true });
}

// An explicit close (the gap, the chip, Esc, the page's own home link) stays on the current Work entry.
async function dismiss() {
  if (!entry || closing) return;
  await closeSheet();
  if (history.state?.projectIndex == null) return;
  const state = { ...history.state };
  delete state.projectIndex;
  delete state.sheetScroll;
  history.replaceState(state, "", "#work");
}

/* ── Wiring ─────────────────────────────────────────────────────────────────────────────── */

for (const [index, card] of cards.entries()) {
  card.addEventListener("pointerdown", event => {
    if (event.button === 0) pressCard(card, true);
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) card.addEventListener(type, () => pressCard(card, false));
  card.addEventListener("click", event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState({ ...history.state, projectIndex: index }, "", "#work");
    openSheet(card);
  });
}

// Escape closes the sheet only (the homepage's own Escape goes back to Home).
sheet.addEventListener("keydown", event => {
  event.stopPropagation();
  if (event.key !== "Escape") return;
  event.preventDefault();
  dismiss();
});
sheet.addEventListener("cancel", event => {
  event.preventDefault();
  dismiss();
});
// The browser can force a modal shut (a second quick Escape); settle our state with it.
sheet.addEventListener("close", () => {
  if (!entry) return;
  finishClose();
  if (history.state?.projectIndex == null) return;
  const state = { ...history.state };
  delete state.projectIndex;
  delete state.sheetScroll;
  history.replaceState(state, "", "#work");
});

// Back closes the sheet into its card; Forward opens it again, scrolled where the reader left it.
function restoreSheet({ restored = false } = {}) {
  const card = cards[history.state?.projectIndex];
  if (card) {
    if (!entry || entry.card !== card || closing) openSheet(card, { scroll: history.state.sheetScroll, restored });
  } else if (entry && !closing) {
    closeSheet();
  }
}
addEventListener("popstate", () => restoreSheet());

// Direct visits to a case study come back here as /?case-study=/path (the Framer page's entry bridge,
// proxied onto this origin): land on Work and open that project from its card.
const params = new URLSearchParams(location.search);
const requested = params.get("case-study");
const requestedCard = requested && cardForPath(new URL(requested, location.href).pathname);
if (requested) {
  params.delete("case-study");
  const query = params.toString() ? "?" + params : "";
  history.replaceState(requestedCard ? null : history.state, "", location.pathname + query + (requestedCard ? "#work" : location.hash));
}
// Wait for the homepage to settle on Work (page-scroll.js runs after this), then open.
addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => requestAnimationFrame(() => {
  if (requestedCard) {
    history.pushState({ ...history.state, projectIndex: cards.indexOf(requestedCard) }, "", "#work");
    openSheet(requestedCard);
  } else {
    restoreSheet({ restored: true }); // a reload with the sheet open
  }
})));
