// First-run walkthrough.
//
// Written for someone who may be new to apps entirely: one idea per screen,
// large type, plain language, an always-visible way out, and no jargon.
// It never implies the app assesses or diagnoses anything.

import { db } from "./data.js?v=9bbaea5e28";
import { ICONS } from "./icons.js?v=9bbaea5e28";

const SEEN_KEY = "walkthroughSeen";

const STEPS = [
  {
    icon: "graph",
    title: "Welcome to Capsule",
    body: "Capsule is a place to talk about your day and keep those memories. Let's take a quick look around. It only takes a minute.",
    tab: null,
  },
  {
    icon: "pencil",
    title: "Today: tell it about your day",
    body: "Tap the big microphone and just talk, the way you would to a friend. Capsule writes it down for you. Prefer typing? The box below works just as well.",
    tab: "journal",
  },
  {
    icon: "camera",
    title: "Add photos if you like",
    body: "You can add pictures from your day. They stay with that entry, so you can look back at them later.",
    tab: "journal",
  },
  {
    icon: "clock",
    title: "Recall: revisit an older day",
    body: "After a while, Capsule brings back an earlier day and asks what you remember about it. To help, it shows a few short notes from what you said that day, and a photo if you added one.",
    tab: "recall",
  },
  {
    icon: "star",
    title: "Activities: word and memory games",
    body: "Each day there are 2 short activities to do: a game or a question. After those, there are extras, but you never have to do them.",
    tab: "activities",
  },
  {
    icon: "trend",
    title: "Trends: your own patterns",
    body: "Charts of how your entries change over time, compared only with your own earlier ones.",
    tab: "trends",
  },
  {
    icon: "book",
    title: "History: everything you've saved",
    body: "Every entry you've made lives here, and you can download a copy of it all at any time.",
    tab: "history",
  },
  {
    icon: "check",
    title: "That's everything",
    body: "There's no wrong way to use Capsule. Start whenever you like, and you can see this tour again from the Account page.",
    tab: "journal",
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

/** Opens the walkthrough. Resolves once the person finishes or skips it. */
export function startWalkthrough({ navigate } = {}) {
  return new Promise((resolve) => {
    let index = 0;

    const overlay = document.createElement("div");
    overlay.className = "overlay walkthrough-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Guided tour of Capsule");
    overlay.innerHTML = `
      <div class="glass-panel walkthrough-panel">
        <div class="walkthrough-icon" data-slot="icon"></div>
        <h2 data-slot="title"></h2>
        <p class="walkthrough-body" data-slot="body"></p>
        <div class="walkthrough-dots" data-slot="dots" aria-hidden="true"></div>
        <div class="walkthrough-actions">
          <button class="btn btn-primary btn-large" data-slot="next">Next</button>
          <div class="walkthrough-secondary">
            <button class="btn-text" data-slot="back">Back</button>
            <button class="btn-text" data-slot="skip">Skip the tour</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const iconEl = overlay.querySelector('[data-slot="icon"]');
    const titleEl = overlay.querySelector('[data-slot="title"]');
    const bodyEl = overlay.querySelector('[data-slot="body"]');
    const dotsEl = overlay.querySelector('[data-slot="dots"]');
    const nextBtn = overlay.querySelector('[data-slot="next"]');
    const backBtn = overlay.querySelector('[data-slot="back"]');
    const skipBtn = overlay.querySelector('[data-slot="skip"]');

    function render() {
      const step = STEPS[index];
      iconEl.innerHTML = ICONS[step.icon] || "";
      titleEl.textContent = step.title;
      bodyEl.textContent = step.body;
      dotsEl.innerHTML = STEPS.map(
        (_, i) => `<span class="walkthrough-dot${i === index ? " active" : ""}"></span>`
      ).join("");
      nextBtn.textContent = index === STEPS.length - 1 ? "Start using Capsule" : "Next";
      backBtn.style.visibility = index === 0 ? "hidden" : "visible";
      skipBtn.style.visibility = index === STEPS.length - 1 ? "hidden" : "visible";
      if (step.tab && navigate) navigate(step.tab);
      nextBtn.focus();
    }

    async function finish() {
      await markWalkthroughSeen();
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve();
    }

    function onKey(e) {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") nextBtn.click();
      if (e.key === "ArrowLeft" && index > 0) backBtn.click();
    }

    nextBtn.addEventListener("click", () => {
      if (index === STEPS.length - 1) return void finish();
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
