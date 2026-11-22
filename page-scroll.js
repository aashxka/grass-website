export const motionDials = {
  "Nav duration (ms)": [720, 150, 1600, 10],
  "Grass scroll speed (×)": [1.3, 0.5, 2.5, 0.05],
};

export const portfolioMotion = new EventTarget();
const clampProgress = value => Math.min(1, Math.max(0, value));
const smooth = progress => progress * progress * (3 - 2 * progress);

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
let introEnd = 0, workTop = 0, grassDrop = 0;
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
  const progress = clampProgress((y - introEnd) / Math.max(1, workTop - introEnd));
  const drop = smooth(progress);
  const workReveal = smooth(clampProgress((progress - 0.5) * 2));
  const reduced = reducedMotion.matches;
  landscape.style.setProperty("--landscape-drop", (reduced ? 0 : drop * grassDrop) + "px");
  landscape.style.setProperty("--landscape-opacity", 1 - smooth(clampProgress((progress - 0.3) / 0.7)));
  workRail.style.setProperty("--work-reveal", workReveal);
  workRail.style.setProperty("--work-rise", (reduced ? 0 : (1 - workReveal) * 14) + "px");
  landscape.inert = progress >= 1;
  intro.inert = y >= introEnd && !intro.contains(document.activeElement);
  const hideWork = workReveal < 0.04;
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
  grassDrop = vh * 0.4;
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

addEventListener("scroll", schedulePaint, { passive: true });
function canTurnPage(towardWork) {
  return towardWork ? window.scrollY < workTop - 2 : window.scrollY > 1 && window.scrollY <= workTop + 2;
}

// A trackpad sends a series of wheel events, including momentum after release.
// Consume the rest of that gesture so it cannot interrupt or overshoot the transition.
let lastTurnWheel = -Infinity;
addEventListener("wheel", event => {
  if (event.defaultPrevented || event.ctrlKey || event.shiftKey ||
      Math.abs(event.deltaY) <= Math.abs(event.deltaX) || event.target.closest?.(tuneControls)) return;
  const now = performance.now();
  if (now - lastTurnWheel < 160 || destination !== null) {
    if (event.cancelable) event.preventDefault();
    lastTurnWheel = now;
    return;
  }
  const towardWork = event.deltaY > 0;
  if (!event.cancelable || !canTurnPage(towardWork)) return;
  event.preventDefault();
  lastTurnWheel = now;
  openFromNav(towardWork);
}, { passive: false });

let swipe = null;
addEventListener("touchstart", event => {
  swipe = null;
  if (event.touches.length !== 1 || event.target.closest?.(tuneControls)) return;
  const { clientX, clientY } = event.touches[0];
  swipe = { x: clientX, y: clientY, turned: false };
}, { passive: true });
addEventListener("touchmove", event => {
  if (!swipe || event.touches.length !== 1 || !event.cancelable) return;
  if (swipe.turned) {
    event.preventDefault();
    return;
  }
  const dx = event.touches[0].clientX - swipe.x;
  const dy = swipe.y - event.touches[0].clientY;
  const towardWork = dy > 0;
  if (Math.abs(dy) <= Math.abs(dx) || !canTurnPage(towardWork)) return;
  // Hold native scrolling from the first vertical move while the swipe crosses the threshold.
  event.preventDefault();
  if (Math.abs(dy) < 12) return;
  swipe.turned = true;
  openFromNav(towardWork);
}, { passive: false });

for (const event of ["touchstart", "pointerdown"]) {
  addEventListener(event, input => {
    if (!workLink.contains(input.target)) stopAnimation();
  }, { passive: true });
}
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
