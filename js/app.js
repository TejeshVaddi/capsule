import { db, refreshDataMode } from "./data.js";
import { onAuthChange } from "./cloud.js";
import { cloudConfigured } from "./config.js";
import { revokePhotoUrls } from "./ui.js";
import { ICONS, LOGO_SVG } from "./icons.js";
import { renderHomeView } from "./views/home.js";
import { renderJournalView } from "./views/journal.js";
import { playIntro } from "./intro.js";
import { getStreak } from "./daily.js";
import { renderRecallView } from "./views/recall.js";
import { renderActivitiesView } from "./views/activities.js";
import { renderTrendsView } from "./views/trends.js";
import { renderHistoryView } from "./views/history.js";
import { renderAccountView, openDeleteFlow } from "./views/account.js";
import { renderFooter } from "./footer.js";
import { isCloudMode } from "./data.js";
import { destroyCharts } from "./charts.js";
import { shouldShowWalkthrough, startWalkthrough } from "./walkthrough.js";
import { openPrivacyPolicy, POLICY_VERSION } from "./privacy.js";
import { openTerms, TERMS_VERSION } from "./terms.js";
import { migrateMetrics } from "./migrate.js";

const VIEWS = {
  home: renderHomeView,
  journal: renderJournalView,
  recall: renderRecallView,
  activities: renderActivitiesView,
  trends: renderTrendsView,
  history: renderHistoryView,
  account: renderAccountView,
};

const viewRoot = document.getElementById("view-root");
const tabBar = document.getElementById("tab-bar");
let navToken = 0;

document.getElementById("brand-mark").innerHTML = LOGO_SVG;
document.getElementById("disclaimer-logo").innerHTML = LOGO_SVG;
for (const btn of tabBar.querySelectorAll(".tab-btn")) {
  const name = btn.dataset.icon;
  if (name && ICONS[name]) btn.querySelector(".tab-icon").innerHTML = ICONS[name];
}

async function navigate(viewName) {
  if (!VIEWS[viewName]) viewName = "home";

  destroyCharts();
  revokePhotoUrls();
  document.body.classList.remove("typing");
  queueFit();

  for (const btn of tabBar.querySelectorAll(".tab-btn")) {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  }

  // Each visit gets its own page element. A page still loading when the
  // person taps another tab (Home is slow at start-up, cloud data slower
  // still) keeps writing into its own element, now detached, instead of
  // painting over the page they asked for under the wrong tab.
  const token = ++navToken;
  const page = document.createElement("div");
  viewRoot.replaceChildren(page);

  viewRoot.style.animation = "none";
  // force reflow so the fade replays on every navigation
  void viewRoot.offsetHeight;
  viewRoot.style.animation = "";

  // A new page starts at its top. Otherwise it opens at the previous page's
  // scroll position, which on a phone can mean landing on the footer.
  window.scrollTo(0, 0);

  try {
    await VIEWS[viewName](page, { navigate });
  } catch (err) {
    console.error("View render failed:", err);
    if (token !== navToken) return;
    page.innerHTML = `
      <div class="glass-panel empty-state">
        <h2>Something went wrong</h2>
        <p>That page hit a snag. Your saved entries are safe. Try another tab.</p>
      </div>`;
  }
  if (token !== navToken) return;

  // The legal footer sits on every screen, including the error state above,
  // so these links are never more than a scroll away.
  page.appendChild(renderFooter({ navigate, onDeleteData: openDeleteFromFooter }));
}

/** Footer "Delete your data" opens the flow that matches the current mode. */
function openDeleteFromFooter(nav) {
  openDeleteFlow({ mode: isCloudMode() ? "cloud" : "local", navigate: nav });
}

/* While a text field has focus on a touch screen, the tab bar steps aside
   (see body.typing in the stylesheet). The short delay on focusout avoids a
   flicker when moving straight from one field to the next. */
const TEXT_ENTRY = 'textarea, input:not([type]), input[type="text"], input[type="email"], input[type="search"], input[type="tel"], input[type="number"]';
const touchScreen = window.matchMedia("(hover: none), (pointer: coarse)").matches;
if (touchScreen) {
  document.addEventListener("focusin", (e) => {
    if (e.target.matches && e.target.matches(TEXT_ENTRY)) document.body.classList.add("typing");
  });
  const settleTyping = () => {
    const a = document.activeElement;
    if (!(a && a.matches && a.matches(TEXT_ENTRY))) document.body.classList.remove("typing");
  };
  document.addEventListener("focusout", () => setTimeout(settleTyping, 120));
  // A focused field removed from the page (a view re-rendering after a save)
  // does not reliably fire focusout in Safari or Chrome, which would leave the
  // tab bar hidden for good. Any later touch re-checks.
  document.addEventListener("pointerdown", () => setTimeout(settleTyping, 0), { passive: true });
}

/* Tab labels: width-based CSS rules cannot see enlarged system text (Android
   text scaling, Samsung and Firefox font-size settings), because the screen
   is no narrower, only the letters are bigger. So measure instead: if any
   label is cut off, lay the bar out in two rows. */
const SIDEBAR_LAYOUT = window.matchMedia("(min-width: 860px) and (min-height: 540px)");
function fitTabLabels() {
  tabBar.classList.remove("tab-bar--rows");
  document.body.classList.remove("tabs-in-rows");
  if (SIDEBAR_LAYOUT.matches) return;
  const clipped = [...tabBar.querySelectorAll(".tab-label")].some((l) => l.scrollWidth > l.clientWidth + 0.5);
  if (clipped) {
    tabBar.classList.add("tab-bar--rows");
    document.body.classList.add("tabs-in-rows");
  }
  // Content keeps clear of the bar at whatever height it has ended up,
  // one row or three, rather than a guessed fixed padding.
  if (getComputedStyle(tabBar).position === "fixed") {
    document.documentElement.style.setProperty("--tabbar-h", `${tabBar.offsetHeight}px`);
  }
}
// A timer rather than requestAnimationFrame: rAF does not run at all while a
// tab is in the background, so a page opened in a new tab would sit with
// clipped labels until it was shown.
let fitTimer = null;
const queueFit = () => {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(fitTabLabels, 60);
};
window.addEventListener("resize", queueFit);
window.addEventListener("orientationchange", queueFit);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueFit);

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

// A summary of the policy sits on the opening screen itself, with the full
// text one tap away, so nobody has to hunt for it or leave the app to read it.
document.getElementById("policy-preview").innerHTML = `
  <p class="policy-preview-title">How Capsule handles your information</p>
  <ul>
    <li>Your entries, photos, and speech measurements are visible to <strong>you only</strong>. This is enforced at the database level.</li>
    <li>We never sell your information, show ads, or use it to diagnose anything.</li>
    <li>Your email is used only to send a sign-in code. There is no password.</li>
    <li>You can delete your account and everything in it at any time, and deletion happens straight away.</li>
    <li>Without an account, everything stays on this device and is never sent anywhere.</li>
  </ul>`;

document.getElementById("policy-open").addEventListener("click", () => openPrivacyPolicy());
document.getElementById("terms-open").addEventListener("click", () => openTerms());

ackContinue.addEventListener("click", async () => {
  const at = new Date().toISOString();
  await db.setMeta("disclaimerAcknowledged", at);
  await db.setMeta("legalRead", { privacyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, at });
  overlay.hidden = true;
  app.hidden = false;
  // On a fresh cloud-enabled install, start at sign-in; otherwise the journal.
  await navigate(cloudConfigured() ? "account" : "home");
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

  // Recompute anything saved under an older metric definition, so trend
  // lines never mix two definitions of the same measurement.
  try {
    await migrateMetrics();
  } catch (err) {
    console.error("Metric migration failed:", err);
  }

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
    // The opening sequence plays before the first paint of the home screen.
    const streak = await getStreak().catch(() => ({ count: 0 }));
    await playIntro({ streak: streak.count || 0, atRisk: streak.atRisk });
    await navigate("home");
    await maybeRunWalkthrough();
  } else {
    overlay.hidden = false;
  }
}

boot();
