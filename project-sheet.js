const sheet = document.querySelector("#project-sheet");
const cards = [...document.querySelectorAll(".work-card")];
const back = sheet.querySelector("button");
const original = sheet.querySelector("a");
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let activeCard;
let motion;

function openSheet(card) {
  motion?.cancel();
  activeCard = card;
  const preview = card.hasAttribute("data-preview");
  const content = document.createElement(preview ? "img" : "iframe");
  const title = card.querySelector("p").textContent;
  sheet.setAttribute("aria-label", title);
  if (preview) content.alt = title;
  else content.title = title;
  content.src = card.href;
  original.href = card.href;
  sheet.lastElementChild.matches("iframe,img") && sheet.lastElementChild.remove();
  sheet.append(content);
  sheet.showModal();
  if (!reduced.matches) motion = sheet.animate(
    [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
    { duration: 340, easing: "cubic-bezier(.2,.8,.2,1)" }
  );
}

async function closeSheet() {
  const start = getComputedStyle(sheet).transform;
  motion?.cancel();
  if (!reduced.matches) {
    motion = sheet.animate([{ transform: start }, { transform: "translateY(105%)" }],
      { duration: 230, easing: "cubic-bezier(.4,0,.8,.3)", fill: "forwards" });
    try { await motion.finished; } catch { return; }
  }
  sheet.close();
  sheet.lastElementChild.remove();
  motion?.cancel();
  activeCard.focus({ preventScroll: true });
}

for (const [index, card] of cards.entries()) {
  card.addEventListener("click", event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState({ ...history.state, projectIndex: index }, "", "#work");
    openSheet(card);
  });
}
function dismiss() {
  if (history.state?.projectIndex != null) history.back();
}
back.addEventListener("click", dismiss);
sheet.addEventListener("cancel", event => { event.preventDefault(); dismiss(); });
sheet.addEventListener("keydown", event => event.stopPropagation());
sheet.addEventListener("click", event => {
  if (event.target !== sheet) return;
  const rect = sheet.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss();
});
function restoreSheet() {
  const card = cards[history.state?.projectIndex];
  if (card) openSheet(card);
  else if (sheet.open) closeSheet();
}
addEventListener("popstate", restoreSheet);
restoreSheet();
