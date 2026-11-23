// Interface sounds (Cuelume, mech theme, vendor/cuelume/): every clickable thing on the page gets
// a ratchet detent when a mouse lands on it and a switch snapping over when it's pressed.
// Two presses sound different: throwing the ball (bubble navigate) and backing out of a case study (mech close).
// Synthesised live with Web Audio, no audio files.
import { play, setTheme, unlock } from "cuelume";

setTheme("mech");

const CLICKABLE = 'a[href], button, [role="button"], summary, label[for], select, input:not([type="hidden"]), .sheet-chip';
const BALL = "#stage button";                                    // fetch.js: the dog's ball
const SHEET_BACK = ".sheet-strip, .sheet-chip, .sheet-error button"; // project-sheet.js: gap, back chip, "Go back"
const scope = document.querySelector(".homepage");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const HOVER_GAP = 50; // ms between detents, so a fast sweep across the nav stays a ratchet, not a buzz

const clickableAt = node => {
  const el = node instanceof Element ? node.closest(CLICKABLE) : null;
  if (!el || !(scope?.contains(el) || el.matches(BALL)) || el.matches(":disabled, [aria-disabled='true']")) return null;
  return el;
};

const playPress = el => {
  if (el.matches(BALL)) play("navigate", { theme: "bubble" });
  else if (el.matches(SHEET_BACK)) play("close");
  else play("toggle");
};

// Browsers only allow sound after the first click or key press on the page; until then hovers stay quiet.
const audioAllowed = () => navigator.userActivation?.hasBeenActive ?? true;
const startAudio = () => {
  unlock().then(ready => {
    if (!ready) return;
    removeEventListener("pointerdown", startAudio, true);
    removeEventListener("keydown", startAudio, true);
  });
};
addEventListener("pointerdown", startAudio, true);
addEventListener("keydown", startAudio, true);

/* ── Hover: select ── */

let hovered = null;    // the clickable under the pointer now
let lastSounded = null;
let lastSoundAt = 0;
let pointer = { x: NaN, y: NaN };

// A later sibling (next nav pill, next card) clicks a touch higher, an earlier one a touch lower.
const directionFrom = (prev, next) => {
  if (!prev || prev.parentElement !== next.parentElement) return undefined;
  return prev.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING ? "forward" : "back";
};

addEventListener("pointerover", event => {
  if (event.pointerType !== "mouse") return;
  const target = clickableAt(event.target);
  // Same spot as the last pointer event: the page moved under a still pointer (scroll, sheet morph), so no sound.
  const moved = event.clientX !== pointer.x || event.clientY !== pointer.y;
  pointer = { x: event.clientX, y: event.clientY };
  if (target === hovered) return;
  hovered = target;
  if (!target || !moved || !finePointer.matches || !audioAllowed()) return;
  const now = performance.now();
  if (now - lastSoundAt < HOVER_GAP) return;
  play("select", { direction: directionFrom(lastSounded, target) });
  lastSounded = target;
  lastSoundAt = now;
}, true);
addEventListener("pointermove", event => {
  if (event.pointerType === "mouse") pointer = { x: event.clientX, y: event.clientY };
}, { capture: true, passive: true });
addEventListener("pointerout", event => {
  if (!event.relatedTarget) hovered = null; // left the window
}, true);

/* ── Press: toggle (ball: bubble navigate, sheet back: close) ── */
// A mouse sounds as the button goes down; touch, pen and keyboard sound on the click itself,
// so a scroll that starts on a card stays silent.

let pressed = null;
addEventListener("pointerdown", event => {
  pressed = null;
  if (event.pointerType !== "mouse" || event.button !== 0) return;
  const target = clickableAt(event.target);
  if (!target) return;
  pressed = target;
  playPress(target);
}, true);
addEventListener("click", event => {
  const target = clickableAt(event.target);
  const alreadySounded = pressed !== null;
  pressed = null;
  if (!target || alreadySounded) return;
  playPress(target);
}, true);
