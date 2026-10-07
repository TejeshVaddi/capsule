import { db, refreshDataMode } from "./data.js?v=9d6a2c4f69";
import { onAuthChange } from "./cloud.js?v=9d6a2c4f69";
import { cloudConfigured } from "./config.js?v=9d6a2c4f69";
import { revokePhotoUrls } from "./ui.js?v=9d6a2c4f69";
import { ICONS, LOGO_SVG } from "./icons.js?v=9d6a2c4f69";
import { renderHomeView } from "./views/home.js?v=9d6a2c4f69";
import { renderJournalView } from "./views/journal.js?v=9d6a2c4f69";
import { playIntro } from "./intro.js?v=9d6a2c4f69";
import { getStreak } from "./daily.js?v=9d6a2c4f69";
import { currentRhythm } from "./rhythm.js?v=9d6a2c4f69";
import { renderRecallView } from "./views/recall.js?v=9d6a2c4f69";
import { renderActivitiesView } from "./views/activities.js?v=9d6a2c4f69";
import { renderTrendsView } from "./views/trends.js?v=9d6a2c4f69";
import { renderHistoryView } from "./views/history.js?v=9d6a2c4f69";
import { renderAccountView, openDeleteFlow } from "./views/account.js?v=9d6a2c4f69";
import { renderFooter } from "./footer.js?v=9d6a2c4f69";
import { isCloudMode } from "./data.js?v=9d6a2c4f69";
import { destroyCharts } from "./charts.js?v=9d6a2c4f69";
import { shouldShowWalkthrough, startWalkthrough, startGuidedSession } from "./walkthrough.js?v=9d6a2c4f69";
import { openPrivacyPolicy, POLICY_VERSION } from "./privacy.js?v=9d6a2c4f69";
import { openTerms, TERMS_VERSION } from "./terms.js?v=9d6a2c4f69";
import { migrateMetrics } from "./migrate.js?v=9d6a2c4f69";
import { renderResidentsView } from "./views/residents.js?v=9d6a2c4f69";
import { isCentre, activeProfileId, getProfile, firstNameOf } from "./profiles.js?v=9d6a2c4f69";

const VIEWS = {
  residents: renderResidentsView,
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

/**
 * Which tabs this screen should have. A care centre with nobody open is
 * looking after a house, not keeping a journal, so it gets the list of
 * residents and the account and nothing else. Opening a resident hands the
 * whole app over to them, tabs and all.
 */
async function applyShell() {
  const centre = await isCentre();
  const open = activeProfileId();
  const listing = centre && !open;
  document.body.classList.toggle("centre-mode", centre);
  document.body.classList.toggle("centre-listing", listing);
  for (const btn of tabBar.querySelectorAll(".tab-btn")) {
    const view = btn.dataset.view;
    const show = listing ? view === "residents" || view === "account" : view !== "residents";
    btn.hidden = !show;
  }
  queueFit();
  return { centre, listing };
}

async function navigate(viewName, { launched = false } = {}) {
  const { listing } = await applyShell();
  // A centre screen with nobody open has nowhere else to be.
  if (listing && viewName !== "residents" && viewName !== "account") viewName = "residents";
  if (!VIEWS[viewName]) viewName = listing ? "residents" : "home";

  // Opening a resident greets them by name, the way their own Capsule would.
  if (launched) {
    const who = await getProfile(activeProfileId());
    await playIntro({ welcome: true, greeting: who ? `Welcome ${firstNameOf(who)}` : null });
    // Their own first visit, not the centre's: a resident who has never
    // used Capsule is led through their first day like anybody else.
    if (await maybeRunWalkthrough()) return;
  }

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
  if (!(await maybeRunWalkthrough())) await navigate(cloudConfigured() ? "account" : "home");
});

/**
 * Shows the tour to anyone who has not seen it yet on this device, and hands
 * the app over with the ordinary opening once it is done, so the first run
 * ends where every later one begins. Returns whether it ran.
 */
async function maybeRunWalkthrough() {
  // A care centre's own screen never gets it. The welcome and the tutorial
  // are addressed to the person whose journal it is ("tell Capsule about
  // your day"), which is nobody while a member of staff is looking at a
  // list of residents. Each resident meets it on their own first visit,
  // because having seen it is kept per person. See profiles.js.
  if ((await isCentre()) && !activeProfileId()) return false;
  if (!(await shouldShowWalkthrough())) return false;
  // What Capsule is for, then the ordinary opening to hand the app over,
  // then the first day done for real with the tutorial alongside.
  await startWalkthrough();
  await playIntro();
  await navigate("journal");
  await startGuidedSession({ navigate });
  await navigate("home");
  return true;
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
  // Optional: a page cached from before this note existed has no such element,
  // and a missing loading note must never stop the app from starting.
  document.getElementById("boot-note")?.remove();
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
    // The opening sequence plays before the first paint of the home screen,
    // but it belongs to whoever is journaling: a streak and "let's start
    // today" mean nothing on a care centre's own screen, where the answer
    // to whose streak it is would be nobody's. Staff go straight to the
    // list; a resident gets their own opening when they are launched.
    const staffScreen = (await isCentre()) && !activeProfileId();
    if (!staffScreen) {
      const rhythm = await currentRhythm(await db.allEntries().catch(() => []));
      const streak = await getStreak(rhythm).catch(() => ({ count: 0 }));
      await playIntro({ streak: streak.count || 0, atRisk: streak.atRisk, unit: rhythm.unit, units: rhythm.units });
    }
    await navigate(staffScreen ? "residents" : "home");
    await maybeRunWalkthrough();
  } else {
    // The very first run: the mark assembles under a greeting, the home
    // screen is revealed behind it, and the welcome panel opens over it, so
    // the app is visible from the start rather than hidden behind a form.
    app.hidden = false;
    const opening = playIntro({ welcome: true });
    await navigate("home");
    await opening;
    overlay.hidden = false;
  }
}

boot();
