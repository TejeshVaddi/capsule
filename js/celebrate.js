// End-of-day celebration: drag the streak ball into the capsule.
//
// Pointer Events are used throughout so mouse, finger, and stylus all take the
// same path. The drop target is generous (a wide radius, and the pill starts
// opening well before contact) because precise dragging is exactly the kind of
// motor task that gets harder with age, and missing the target would turn a
// reward into a failure. There is also a plain button for anyone who cannot
// drag at all: the celebration must never be a gate.

const OPEN_DISTANCE = 190;  // pill starts opening
const DROP_DISTANCE = 96;   // close enough to count as dropped

export function celebrateStreak(streakCount) {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "celebrate-screen";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.innerHTML = `
      <div class="celebrate-inner">
        <p class="celebrate-title"><span class="celebrate-num">${streakCount}</span> day streak of Capsule!</p>
        <p class="celebrate-hint" data-slot="hint">Drag the circle into the capsule.</p>

        <div class="celebrate-stage" data-slot="stage">
          <div class="streak-ball" data-slot="ball" role="button" tabindex="0"
               aria-label="Streak marker. Drag into the capsule, or press Enter.">
            <span>${streakCount}</span>
          </div>

          <div class="capsule-pill" data-slot="pill" aria-hidden="true">
            <div class="pill-half pill-top"></div>
            <div class="pill-half pill-bottom"></div>
          </div>
        </div>

        <button class="btn btn-secondary celebrate-skip" data-slot="skip">Just finish</button>
      </div>`;
    document.body.appendChild(el);

    const ball = el.querySelector('[data-slot="ball"]');
    const pill = el.querySelector('[data-slot="pill"]');
    const stage = el.querySelector('[data-slot="stage"]');
    const hint = el.querySelector('[data-slot="hint"]');

    let dragging = false, finished = false;
    let offX = 0, offY = 0;

    const pillCentre = () => {
      const r = pill.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    function setOpenness(dist) {
      // 0 when far away, 1 when touching. Drives how far the pill halves part.
      const t = Math.max(0, Math.min(1, (OPEN_DISTANCE - dist) / (OPEN_DISTANCE - DROP_DISTANCE)));
      pill.style.setProperty("--open", t.toFixed(3));
      pill.classList.toggle("pill-ready", t > 0.75);
    }

    function moveTo(clientX, clientY) {
      const s = stage.getBoundingClientRect();
      const x = clientX - s.left - offX;
      const y = clientY - s.top - offY;
      ball.style.left = `${x}px`;
      ball.style.top = `${y}px`;
      ball.style.transform = "none";

      const b = ball.getBoundingClientRect();
      const c = pillCentre();
      const dist = Math.hypot(b.left + b.width / 2 - c.x, b.top + b.height / 2 - c.y);
      setOpenness(dist);
      return dist;
    }

    function onDown(e) {
      if (finished) return;
      dragging = true;
      ball.setPointerCapture?.(e.pointerId);
      const b = ball.getBoundingClientRect();
      offX = e.clientX - b.left;
      offY = e.clientY - b.top;
      ball.classList.add("dragging");
      hint.textContent = "Keep going, the capsule is opening.";
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging || finished) return;
      moveTo(e.clientX, e.clientY);
    }

    function onUp(e) {
      if (!dragging || finished) return;
      dragging = false;
      ball.classList.remove("dragging");
      const dist = moveTo(e.clientX, e.clientY);
      if (dist <= DROP_DISTANCE) swallow();
      else {
        // Gently return home rather than leaving it stranded.
        ball.classList.add("returning");
        ball.style.left = ""; ball.style.top = ""; ball.style.transform = "";
        setOpenness(Infinity);
        hint.textContent = "Almost. Bring it a little closer to the capsule.";
        setTimeout(() => ball.classList.remove("returning"), 400);
      }
    }

    /** The pill closes around the ball and carries it off screen. */
    function swallow() {
      if (finished) return;
      finished = true;
      const c = pillCentre();
      const s = stage.getBoundingClientRect();
      const b = ball.getBoundingClientRect();
      ball.style.left = `${c.x - s.left - b.width / 2}px`;
      ball.style.top = `${c.y - s.top - b.height / 2}px`;
      ball.classList.add("swallowed");
      pill.style.setProperty("--open", "1");

      setTimeout(() => {
        pill.style.setProperty("--open", "0");
        pill.classList.remove("pill-ready");
        pill.classList.add("pill-closed");
      }, 320);

      setTimeout(() => {
        el.querySelector(".celebrate-stage").classList.add("stage-exit");
      }, 780);

      setTimeout(() => {
        el.querySelector(".celebrate-inner").innerHTML =
          `<p class="celebrate-done">Amazing work today!</p>`;
      }, 1350);

      setTimeout(close, 2500);
    }

    function close() {
      el.classList.add("celebrate-out");
      setTimeout(() => { el.remove(); resolve(); }, 400);
    }

    ball.addEventListener("pointerdown", onDown);
    ball.addEventListener("pointermove", onMove);
    ball.addEventListener("pointerup", onUp);
    ball.addEventListener("pointercancel", onUp);
    // Keyboard and anyone who cannot drag.
    ball.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); swallow(); }
    });
    el.querySelector('[data-slot="skip"]').addEventListener("click", () => {
      if (!finished) swallow();
    });
  });
}
