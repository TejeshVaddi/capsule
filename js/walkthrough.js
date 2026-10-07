// First run: a short welcome, then the first day done together.
//
// Written for someone who may be new to apps entirely: one idea at a time,
// large type, plain language, an always-visible way out, and no jargon.
// It never implies the app assesses or diagnoses anything.
//
// It comes in two halves.
//
// The welcome is three cards saying what Capsule is for. Nothing is asked of
// anyone yet, so these sit in the middle of a dimmed screen and are read.
//
// The tutorial is the other half, and it is not a slideshow. A tour that
// says "this is where you write your day" and then leaves has taught
// nothing to someone who cannot hold it until tomorrow. So the tutorial
// asks for one real thing at a time and waits for it to actually happen:
// write today's entry, then do the two activities, then look back at a day.
// It reads the app's own daily plan to know when each one is genuinely
// done, so it can never congratulate someone for something they have not
// done, and it cannot drift out of step with the rest of the app. The
// screen stays live underneath, because the point is that they do it.

import { db } from "./data.js?v=9d6a2c4f69";
import { ICONS } from "./icons.js?v=9d6a2c4f69";
import { getDailyPlan } from "./daily.js?v=9d6a2c4f69";

const SEEN_KEY = "walkthroughSeen";

/* ---------------- The welcome ---------------- */

const CARDS = [
  {
    icon: "graph",
    title: "Welcome to Capsule",
    body: "Capsule is a place to talk about your day and keep those memories. Nothing here is a test, and there are no right answers.",
  },
  {
    icon: "check",
    title: "Three things, and they are short",
    body: "Each time you open Capsule: tell it about your day, do a few short activities, and after a while, look back at an earlier day. Home keeps the list and ticks it off as you go.",
  },
  {
    icon: "device",
    title: "It stays on this device",
    body: "Your entries and photos are yours. Nothing is sold, there are no adverts, and you can take a copy or erase the lot whenever you like.",
  },
];

export async function shouldShowWalkthrough() {
  try {
    return !(await db.getMeta(SEEN_KEY));
  } catch {
    return false;
  }
}

export async function markWalkthroughSeen() {
  try {
    await db.setMeta(SEEN_KEY, new Date().toISOString());
  } catch {
    /* non-fatal */
  }
}

/** The welcome cards. Resolves once they are read or skipped. */
export function startWalkthrough() {
  return new Promise((resolve) => {
    let index = 0;

    const layer = document.createElement("div");
    layer.className = "tour-layer tour-modal";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-label", "Welcome to Capsule");
    layer.innerHTML = `
      <div class="tour-dim"></div>
      <div class="glass-panel tour-panel">
        <span class="walkthrough-icon" data-slot="icon"></span>
        <h2 data-slot="title"></h2>
        <p class="walkthrough-body" data-slot="body"></p>
        <div class="walkthrough-dots" data-slot="dots" aria-hidden="true"></div>
        <div class="walkthrough-actions">
          <button class="btn btn-primary btn-large" data-slot="next">Next</button>
          <div class="walkthrough-secondary">
            <button class="btn-text" data-slot="back">Back</button>
            <button class="btn-text" data-slot="skip">Skip this</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(layer);

    const iconEl = layer.querySelector('[data-slot="icon"]');
    const titleEl = layer.querySelector('[data-slot="title"]');
    const bodyEl = layer.querySelector('[data-slot="body"]');
    const dotsEl = layer.querySelector('[data-slot="dots"]');
    const nextBtn = layer.querySelector('[data-slot="next"]');
    const backBtn = layer.querySelector('[data-slot="back"]');
    const skipBtn = layer.querySelector('[data-slot="skip"]');

    function render() {
      const card = CARDS[index];
      iconEl.innerHTML = ICONS[card.icon] || "";
      titleEl.textContent = card.title;
      bodyEl.textContent = card.body;
      dotsEl.innerHTML = CARDS.map(
        (_, i) => `<span class="walkthrough-dot${i === index ? " active" : ""}"></span>`
      ).join("");
      nextBtn.textContent = index === CARDS.length - 1 ? "I'm ready" : "Next";
      backBtn.style.visibility = index === 0 ? "hidden" : "visible";
      skipBtn.style.visibility = index === CARDS.length - 1 ? "hidden" : "visible";
      nextBtn.focus();
    }

    async function finish() {
      document.removeEventListener("keydown", onKey);
      await markWalkthroughSeen();
      layer.classList.add("tour-out");
      setTimeout(() => { layer.remove(); resolve(); }, 260);
    }

    function onKey(e) {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") nextBtn.click();
      if (e.key === "ArrowLeft" && index > 0) backBtn.click();
    }

    nextBtn.addEventListener("click", () => {
      if (index === CARDS.length - 1) return void finish();
      index++;
      render();
    });
    backBtn.addEventListener("click", () => {
      if (index > 0) { index--; render(); }
    });
    skipBtn.addEventListener("click", finish);
    document.addEventListener("keydown", onKey);

    render();
  });
}

/* ---------------- The tutorial ---------------- */

// Each stage asks for one real thing and waits for the app's own daily plan
// to say it happened. `spot` is the control to lift out of the page while
// they look for it; it is looked up fresh every time, because a view is
// rebuilt from scratch whenever it is opened.
const STAGES = [
  {
    key: "journal",
    view: "journal",
    icon: "pencil",
    title: "Tell Capsule about today",
    body: "Tap the microphone and talk, or type in the box. Then tap Save today's entry.",
    waiting: "Take as long as you like. This moves on by itself.",
    spot: ".record-row",
    doneWord: "That is today saved.",
  },
  {
    key: "activities",
    view: "activities",
    icon: "star",
    title: "Now the activities",
    body: "Tap Start under number 1. Capsule picks them for you.",
    waiting: "The next one follows straight after each.",
    spot: ".activity-next .card-action, .activity-card .card-action",
    doneWord: "All the activities done.",
  },
  {
    key: "recall",
    view: "recall",
    icon: "clock",
    title: "Last, a look back",
    body: "Read the note, say whatever comes back, then tap the button underneath.",
    waiting: "However much comes back is worth having.",
    spot: ".record-row",
    doneWord: "That is your visit done.",
  },
];

const POLL_MS = 900;
const CHEER_MS = 1700;
const SPOT_PAD = 8;

/**
 * Leads the first session: one instruction at a time, each waiting on the
 * real thing being done. Resolves when the day's list is finished or the
 * person stops the tutorial.
 */
export function startGuidedSession({ navigate } = {}) {
  return new Promise((resolve) => {
    let stage = null;
    let cheering = false;
    let timer = null;
    let stopped = false;

    const layer = document.createElement("div");
    layer.className = "tour-layer tour-live";
    layer.innerHTML = `
      <div class="tour-spot" data-slot="spot" hidden></div>
      <div class="glass-panel coach-bar" data-slot="bar" role="status" aria-live="polite">
        <div class="coach-head">
          <span class="coach-icon" data-slot="icon" aria-hidden="true"></span>
          <strong data-slot="title"></strong>
          <span class="coach-step" data-slot="count"></span>
        </div>
        <p class="coach-body" data-slot="body"></p>
        <p class="coach-wait muted" data-slot="waiting"></p>
        <button class="btn-text coach-skip" data-slot="skip">Stop the tutorial</button>
      </div>`;
    document.body.appendChild(layer);

    const spot = layer.querySelector('[data-slot="spot"]');
    const bar = layer.querySelector('[data-slot="bar"]');
    const iconEl = layer.querySelector('[data-slot="icon"]');
    const titleEl = layer.querySelector('[data-slot="title"]');
    const bodyEl = layer.querySelector('[data-slot="body"]');
    const waitEl = layer.querySelector('[data-slot="waiting"]');
    const countEl = layer.querySelector('[data-slot="count"]');

    /** Which stages this person actually has today, in order. */
    function stagesFor(plan) {
      const keys = new Set(
        plan.tasks.filter((t) => t.key !== "recall" || plan.recallAvailable).map((t) => t.key)
      );
      return STAGES.filter((s) => keys.has(s.key));
    }

    const isDone = (plan, key) => Boolean(plan.tasks.find((t) => t.key === key)?.done);

    function show(s, list, plan) {
      iconEl.innerHTML = ICONS[s.icon] || "";
      // How many activities a session asks for follows the rhythm, so the
      // number comes from the plan rather than being written into the copy.
      titleEl.textContent = s.key === "activities" && plan.activityTarget
        ? `Now the ${plan.activityTarget} activities`
        : s.title;
      bodyEl.textContent = s.body;
      countEl.textContent = `Step ${list.indexOf(s) + 1} of ${list.length}`;
      bar.classList.remove("coach-cheer");
      // Part-way through counts as progress and is worth saying back.
      const progress = plan.tasks.find((t) => t.key === s.key)?.progress;
      waitEl.textContent = progress ? `${progress}. ${s.waiting}` : s.waiting;
    }

    /** A moment of credit between one thing and the next. */
    function cheer(word) {
      cheering = true;
      bar.classList.add("coach-cheer");
      iconEl.innerHTML = ICONS.check || "";
      titleEl.textContent = word;
      bodyEl.textContent = "";
      waitEl.textContent = "";
      countEl.textContent = "";
      spot.hidden = true;
      setTimeout(() => { cheering = false; }, CHEER_MS);
    }

    /** Lifts the control they need out of the page, without dimming it. */
    function placeSpot() {
      const el = stage?.spot ? document.querySelector(stage.spot) : null;
      if (!el || cheering) { spot.hidden = true; return; }
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > window.innerHeight) {
        spot.hidden = true;
        return;
      }
      spot.hidden = false;
      spot.style.left = `${r.left - SPOT_PAD}px`;
      spot.style.top = `${r.top - SPOT_PAD}px`;
      spot.style.width = `${r.width + SPOT_PAD * 2}px`;
      spot.style.height = `${r.height + SPOT_PAD * 2}px`;
      // The bar sits at the foot of the screen; anything highlighted down
      // there would be underneath it, so the bar moves out of the way.
      const barH = bar.getBoundingClientRect().height;
      const top = r.bottom > window.innerHeight - barH - 110;
      bar.classList.toggle("coach-bar-top", top);
      reserveSpace(top, barH);
    }

    /**
     * Keeps the foot of the page reachable. The bar floats over the screen,
     * so without this the Save button can sit underneath it with no way to
     * scroll it clear, which would stop the very step being asked for.
     */
    function reserveSpace(atTop, barH) {
      document.body.classList.add("coaching");
      document.body.classList.toggle("coaching-top", atTop);
      document.body.style.setProperty("--coach-h", `${Math.round(barH)}px`);
    }

    async function tick() {
      if (stopped) return;
      let plan;
      try {
        plan = await getDailyPlan();
      } catch {
        return schedule();
      }
      if (stopped) return;

      const list = stagesFor(plan);
      if (!list.length) return void finish();

      if (!cheering) {
        const next = list.find((s) => !isDone(plan, s.key)) || null;
        if (next === stage) {
          show(stage, list, plan);
        } else if (!next) {
          // Everything on today's list is done.
          if (stage) {
            cheer(stage.doneWord);
            setTimeout(finish, CHEER_MS);
          } else {
            finish();
          }
          return;
        } else {
          const finished = stage && isDone(plan, stage.key);
          if (finished) cheer(stage.doneWord);
          stage = next;
          if (navigate) await navigate(next.view);
          if (stopped) return;
          if (finished) setTimeout(() => { if (!stopped) show(stage, list, plan); }, CHEER_MS);
          else show(stage, list, plan);
        }
      }
      placeSpot();
      schedule();
    }

    function schedule() {
      timer = setTimeout(tick, POLL_MS);
    }

    function finish() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      document.body.classList.remove("coaching", "coaching-top");
      document.body.style.removeProperty("--coach-h");
      window.removeEventListener("resize", placeSpot);
      window.removeEventListener("scroll", placeSpot, true);
      layer.classList.add("tour-out");
      setTimeout(() => { layer.remove(); resolve(); }, 260);
    }

    layer.querySelector('[data-slot="skip"]').addEventListener("click", finish);
    window.addEventListener("resize", placeSpot);
    window.addEventListener("scroll", placeSpot, true);
    tick();
  });
}
