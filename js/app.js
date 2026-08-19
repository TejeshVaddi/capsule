import { db, refreshDataMode } from "./data.js";
import { onAuthChange } from "./cloud.js";
import { cloudConfigured } from "./config.js";
import { revokePhotoUrls } from "./ui.js";
import { ICONS, LOGO_SVG, LOGO_DATA_URI } from "./icons.js";
import { renderJournalView } from "./views/journal.js";
import { renderRecallView } from "./views/recall.js";
import { renderActivitiesView } from "./views/activities.js";
import { renderTrendsView } from "./views/trends.js";
import { renderHistoryView } from "./views/history.js";
import { renderAccountView } from "./views/account.js";
import { destroyCharts } from "./charts.js";
import { shouldShowWalkthrough, startWalkthrough } from "./walkthrough.js";

const VIEWS = {
  journal: renderJournalView,
  recall: renderRecallView,
  activities: renderActivitiesView,
  trends: renderTrendsView,
  history: renderHistoryView,
  account: renderAccountView,
};

const viewRoot = document.getElementById("view-root");
const tabBar = document.getElementById("tab-bar");
let currentView = null;

/* Branding: favicon, header mark, disclaimer logo, tab icons */
document.getElementById("favicon").href = LOGO_DATA_URI;
document.getElementById("brand-mark").innerHTML = LOGO_SVG;
document.getElementById("disclaimer-logo").innerHTML = LOGO_SVG;
for (const btn of tabBar.querySelectorAll(".tab-btn")) {
  const name = btn.dataset.icon;
  if (name && ICONS[name]) btn.querySelector(".tab-icon").innerHTML = ICONS[name];
}

async function navigate(viewName) {
  if (!VIEWS[viewName]) viewName = "journal";
  currentView = viewName;

  destroyCharts();
  revokePhotoUrls();

  for (const btn of tabBar.querySelectorAll(".tab-btn")) {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  }

  viewRoot.style.animation = "none";
  // force reflow so the fade replays on every navigation
  void viewRoot.offsetHeight;
  viewRoot.style.animation = "";

  try {
    await VIEWS[viewName](viewRoot, { navigate });
  } catch (err) {
    console.error("View render failed:", err);
    viewRoot.innerHTML = `
      <div class="glass-panel empty-state">
        <h2>Something went wrong</h2>
        <p>That page hit a snag. Your saved entries are safe. Try another tab.</p>
      </div>`;
  }
}

tabBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab-btn");
  if (btn) navigate(btn.dataset.view);
});

/* ---------- Disclaimer flow ---------- */

const overlay = document.getElementById("disclaimer-overlay");
const app = document.getElementById("app");
const ackCheckbox = document.getElementById("ack-checkbox");
const ackContinue = document.getElementById("ack-continue");

ackCheckbox.addEventListener("change", () => {
  ackContinue.disabled = !ackCheckbox.checked;
});

ackContinue.addEventListener("click", async () => {
  await db.setMeta("disclaimerAcknowledged", new Date().toISOString());
  overlay.hidden = true;
  app.hidden = false;
  // On a fresh cloud-enabled install, start at sign-in; otherwise the journal.
  await navigate(cloudConfigured() ? "account" : "journal");
  await maybeRunWalkthrough();
});

/** Shows the tour to anyone who has not seen it yet on this device. */
async function maybeRunWalkthrough() {
  if (await shouldShowWalkthrough()) {
    await startWalkthrough({ navigate });
    await navigate("journal");
  }
}

document.getElementById("disclaimer-reopen").addEventListener("click", () => {
  ackCheckbox.checked = true;
  ackContinue.disabled = false;
  overlay.hidden = false;
});

overlay.addEventListener("click", (e) => {
  // when reopened for reference, clicking outside the panel closes it again
  if (e.target === overlay && !app.hidden) overlay.hidden = true;
});

/* ---------- Boot ---------- */

async function boot() {
  let acknowledged;
  try {
    acknowledged = await db.getMeta("disclaimerAcknowledged");
  } catch (err) {
    console.error("Storage unavailable:", err);
    document.body.innerHTML = `
      <div class="overlay">
        <div class="glass-panel disclaimer-panel">
          <h1>Capsule needs storage</h1>
          <p>Capsule keeps your journal privately on this device, but this browser is blocking storage
          (this can happen in private/incognito windows). Please open Capsule in a regular browser window.</p>
        </div>
      </div>`;
    return;
  }

  if (navigator.storage?.persist) {
    // ask the browser not to evict the journal under storage pressure
    navigator.storage.persist().catch(() => {});
  }

  await refreshDataMode();

  let lastUserId = null;
  onAuthChange(async (session) => {
    await refreshDataMode();
    const userId = session?.user?.id || null;
    // Run the tour on a genuine new sign-in, not on token refreshes.
    if (userId && userId !== lastUserId) {
      lastUserId = userId;
      await maybeRunWalkthrough();
    }
    if (!userId) lastUserId = null;
  });

  if (acknowledged) {
    app.hidden = false;
    await navigate("journal");
    await maybeRunWalkthrough();
  } else {
    overlay.hidden = false;
  }
}

boot();
