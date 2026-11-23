import { play, unlock } from "cuelume";

document.addEventListener("click", async event => {
  const ball = event.target instanceof Element && event.target.closest("#stage button");
  if (ball && !ball.disabled && await unlock()) {
    play("navigate", { theme: "bubble" });
  }
}, true);
