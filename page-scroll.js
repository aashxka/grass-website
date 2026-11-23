export const motionDials = {
  "Nav duration (ms)": [720, 150, 1600, 10],
  "Grass scroll speed (×)": [1.3, 0.5, 2.5, 0.05],
};

export const portfolioMotion = new EventTarget();
const clampProgress = value => Math.min(1, Math.max(0, value));

const nav = document.getElementById("nav");
const links = [...nav.querySelectorAll("a")];
const thumb = nav.querySelector(".nav-thumb");
const workLink = links[0];
const home = document.getElementById("home");
const intro = home.querySelector(".intro");
const landscape = document.querySelector(".landscape");
const work = document.getElementById("work");
const workRail = work.querySelector(".work-rail");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const tuneControls = ".dialkit-root, .dialkit-version-overlay, [data-dialkit-ignore]";

let duration = motionDials["Nav duration (ms)"][0];
let grassSpeed = motionDials["Grass scroll speed (×)"][0];
let introEnd = 0, workTop = 0;
let animation = 0, pendingPaint = 0, destination = null;
let current, openedWork = false;

function placeThumb(animate) {
  thumb.hidden = !current;
  if (!current) return;
  if (!animate) thumb.style.transition = "none";
  thumb.style.width = current.offsetWidth + "px";
  thumb.style.transform = `translateX(${current.offsetLeft}px)`;
  if (!animate) {
    void thumb.offsetWidth;
    thumb.style.transition = "";
  }
}

function selectLink(animate) {
  const hashLink = links.find(link => link.hash === location.hash);
  const onWork = workTop > 0 && window.scrollY >= workTop - 2;
  const next = hashLink && hashLink !== workLink ? hashLink : onWork ? workLink : undefined;
  if (current === next) return;
  const hasPrevious = Boolean(current);
  current?.removeAttribute("aria-current");
  current = next;
  current?.setAttribute("aria-current", "page");
  placeThumb(animate && hasPrevious);
}

function paint() {
  pendingPaint = 0;
  const y = window.scrollY;
  // Let the intro lead by a few scroll pixels, then move the hill directly with the gesture.
  const drop = Math.max(0, y - 4) * grassSpeed;
  const reduced = reducedMotion.matches;
  const cleared = y >= workTop || (reduced ? y > 4 : drop >= window.innerHeight * 0.4);
  landscape.style.setProperty("--landscape-drop", (reduced ? 0 : drop) + "px");
  landscape.inert = cleared;
  workRail.style.setProperty("--work-visibility", cleared ? "visible" : "hidden");
  intro.inert = y >= introEnd && !intro.contains(document.activeElement);
  const hideWork = !cleared;
  if (hideWork && work.contains(document.activeElement)) workLink.focus({ preventScroll: true });
  work.inert = hideWork;
  if (location.hash !== "#work") openedWork = false;
  else if (y >= workTop - 2) openedWork = true;
  else if (openedWork && y <= 1 && destination === null) {
    history.replaceState(history.state, "", location.pathname + location.search);
    openedWork = false;
  }
  selectLink(true);
}

function measure() {
  const workOffset = window.scrollY - workTop;
  const wasInWork = workTop > 0 && workOffset >= -2 && destination === null;
  const vh = window.innerHeight;
  const runway = Math.max(100, vh * (reducedMotion.matches ? 0.25 : 0.54) / grassSpeed);
  home.style.setProperty("--landscape-runway", runway + "px");
  introEnd = Math.ceil(intro.offsetTop + intro.offsetHeight);
  workTop = work.offsetTop;
  if (wasInWork) {
    window.scrollTo({ top: workTop + Math.max(0, workOffset), behavior: "instant" });
  }
  paint();
}

function schedulePaint() {
  if (!pendingPaint) pendingPaint = requestAnimationFrame(paint);
}

function stopAnimation() {
  cancelAnimationFrame(animation);
  animation = 0;
  destination = null;
}

function navigate(toWork, { animate = true, focusWork = false } = {}) {
  stopAnimation();
  const from = window.scrollY;
  const target = toWork ? workTop : 0;
  if (!animate || reducedMotion.matches || Math.abs(target - from) < 2) {
    window.scrollTo({ top: target, behavior: "instant" });
    paint();
    if (toWork && focusWork) work.focus({ preventScroll: true });
    return;
  }
  destination = toWork ? "work" : "home";
  const start = performance.now();
  const scrollDuration = duration * Math.sqrt(Math.min(1, Math.abs(target - from) / workTop));
  function step(now) {
    const progress = clampProgress((now - start) / scrollDuration);
    const end = toWork ? workTop : 0;
    // Use the same ease-out for navigation and scroll gestures.
    const eased = 1 - (1 - progress) ** 3;
    window.scrollTo({ top: from + (end - from) * eased, behavior: "instant" });
    if (progress < 1) animation = requestAnimationFrame(step);
    else {
      stopAnimation();
      if (toWork && focusWork) work.focus({ preventScroll: true });
    }
    schedulePaint();
  }
  animation = requestAnimationFrame(step);
}

function openFromNav(toWork, focusWork = false) {
  const url = location.pathname + location.search + (toWork ? "#work" : "");
  if (url !== location.pathname + location.search + location.hash) history.pushState(null, "", url);
  selectLink(true);
  navigate(toWork, { focusWork });
}

workLink.addEventListener("click", event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const goingToWork = destination === "work" || window.scrollY >= workTop - 2;
  openFromNav(!goingToWork, event.detail === 0);
});

// Let the browser handle wheel momentum, touch panning and scrollbar dragging.
// Complete a partial section transition when the native gesture ends.
let previousY = window.scrollY;
let towardWork = true;
let moved = false;
let settleTimer = 0;
const hasScrollEnd = "onscrollend" in document;

function settleScroll() {
  clearTimeout(settleTimer);
  if (!moved || destination !== null) return;
  moved = false;
  if (window.scrollY > 0 && window.scrollY < workTop) openFromNav(towardWork);
}

addEventListener("scroll", () => {
  const y = window.scrollY;
  if (y !== previousY) {
    towardWork = y > previousY;
    moved = destination === null;
    previousY = y;
  }
  schedulePaint();
  if (!hasScrollEnd && moved) {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settleScroll, 180);
  }
}, { passive: true });
document.addEventListener("scrollend", settleScroll);

function interruptNavigation(event) {
  if (!workLink.contains(event.target) && !event.target.closest?.(tuneControls)) stopAnimation();
}
addEventListener("pointerdown", interruptNavigation, { passive: true });
addEventListener("wheel", interruptNavigation, { passive: true });
addEventListener("keydown", event => {
  if (event.defaultPrevented) return;
  if (event.key === "Escape" && (location.hash === "#work" || window.scrollY > introEnd)) {
    openFromNav(false);
  } else if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) {
    stopAnimation();
  }
});
addEventListener("hashchange", () => selectLink(true));
addEventListener("popstate", () => {
  selectLink(true);
  if (location.hash === "#work" || !location.hash) navigate(location.hash === "#work", { animate: false });
});
addEventListener("resize", measure);
reducedMotion.addEventListener("change", () => {
  stopAnimation();
  measure();
});
portfolioMotion.addEventListener("change", event => {
  duration = event.detail["Nav duration (ms)"];
  grassSpeed = event.detail["Grass scroll speed (×)"];
  measure();
});

const startInWork = location.hash === "#work";
selectLink(false);
measure();
if (startInWork) navigate(true, { animate: false });
new ResizeObserver(measure).observe(intro);
new ResizeObserver(measure).observe(home);
new ResizeObserver(() => placeThumb(false)).observe(nav);
const font = document.fonts ? document.fonts.load('14px "Stevie Sans Book"') : Promise.resolve();
Promise.race([font, new Promise(resolve => setTimeout(resolve, 1500))]).catch(() => {}).then(() => {
  placeThumb(false);
  nav.classList.add("ready");
});
