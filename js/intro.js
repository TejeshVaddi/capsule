// Opening sequence: the logo's semantic graph drawing itself, then the streak.
//
// Built from the logo's own node and edge coordinates, so it is literally the
// mark assembling rather than a generic animation placed near it. Kept short,
// skippable by a tap anywhere, and disabled entirely under reduced motion.

const NODES = [
  { x: 56, y: 15, r: 7 },
  { x: 30, y: 32, r: 9.5 },
  { x: 72, y: 37, r: 6 },
  { x: 55, y: 63, r: 6.5 },
  { x: 45, y: 80, r: 9.5 },
  { x: 74, y: 79, r: 7 },
];

const EDGES = [
  { d: "M 30 32 A 33 33 0 1 0 45 80", w: 7 },
  { d: "M 56 15 A 40 40 0 0 0 30 32", w: 7 },
  { d: "M 45 80 A 42 42 0 0 0 74 79", w: 5 },
  { d: "M 56 15 L 72 37", w: 3.5 },
  { d: "M 30 32 L 55 63", w: 3.5 },
  { d: "M 72 37 L 55 63", w: 3.5 },
  { d: "M 55 63 L 45 80", w: 3.5 },
  { d: "M 55 63 L 74 79", w: 3.5 },
];

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Plays the opening. Resolves when finished or skipped. */
export function playIntro({ streak = 0, atRisk = false } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "intro-screen";
    el.setAttribute("role", "status");
    el.innerHTML = `
      <div class="intro-inner">
        <svg class="intro-logo" viewBox="0 0 100 100" aria-hidden="true">
          <g fill="none" stroke="#4A2E5C" stroke-linecap="round">
            ${EDGES.map((e, i) => `<path class="intro-edge" style="--i:${i}" d="${e.d}" stroke-width="${e.w}"/>`).join("")}
          </g>
          <g fill="#4A2E5C">
            ${NODES.map((n, i) => `<circle class="intro-node" style="--i:${i}" cx="${n.x}" cy="${n.y}" r="${n.r}"/>`).join("")}
          </g>
        </svg>
        <p class="intro-word">Capsule</p>
        <div class="intro-streak">
          ${streak > 0
            ? `<span class="intro-streak-num">${streak}</span><span class="intro-streak-label">day${streak === 1 ? "" : "s"} in a row${atRisk ? ", keep it going today" : ""}</span>`
            : `<span class="intro-streak-label">Let's begin today</span>`}
        </div>
      </div>`;
    document.body.appendChild(el);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.classList.add("intro-out");
      setTimeout(() => { el.remove(); resolve(); }, 420);
    };

    el.addEventListener("click", finish);
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        document.removeEventListener("keydown", onKey);
        finish();
      }
    });

    // Reduced motion still gets the streak, just without the drawing.
    setTimeout(finish, reduced() ? 900 : 2600);
  });
}
