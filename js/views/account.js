import { cloudConfigured } from "../config.js?v=e81ccc62e1";
import { currentUser, sendSignInCode, verifySignInCode, signOut, getReminderPref, setReminderPref } from "../cloud.js?v=e81ccc62e1";
import { refreshDataMode, localEntryCount, db } from "../data.js?v=e81ccc62e1";
import { toast, escapeHtml, el, guideHtml, noteAbove, clearNoteAbove } from "../ui.js?v=e81ccc62e1";
import { icon } from "../icons.js?v=e81ccc62e1";
import { deleteCloudAccount, wipeLocalData, STEPS } from "../deletion.js?v=e81ccc62e1";
import { startWalkthrough } from "../walkthrough.js?v=e81ccc62e1";
import { getRhythmSetting, setRhythmSetting, rhythmFrom } from "../rhythm.js?v=e81ccc62e1";
import { openPrivacyPolicy, POLICY_VERSION } from "../privacy.js?v=e81ccc62e1";
import { openTerms, TERMS_VERSION } from "../terms.js?v=e81ccc62e1";

export async function renderAccountView(root, { navigate }) {
  root.innerHTML = "";

  if (!cloudConfigured()) {
    root.appendChild(el(`
      <div class="glass-panel">
        <div class="section-title"><h2>Account</h2><span class="pill">${icon("device")} Device-only mode</span></div>
        <p>Capsule is currently keeping everything <strong>privately on this device</strong>. No account needed, nothing leaves your browser.</p>
        <p class="muted">Accounts and cloud sync are available once the app is connected to its cloud service. If you're the person running this app, see the "Going live" section of the README to switch it on.</p>
      </div>
    `));
    appendRhythmCard(root);
    appendTourCard(root, navigate);
    appendLocalDangerZone(root, navigate);
    return;
  }

  const user = await currentUser();
  if (user) {
    renderSignedIn(root, user, navigate);
  } else {
    renderSignIn(root, navigate);
  }
}

function renderSignedIn(root, user, navigate) {
  const panel = el(`
    <div class="stack">
      <div class="glass-panel">
        <div class="section-title"><h2>Account</h2><span class="pill pill-blue">${icon("cloud")} Signed in</span></div>
        <p class="lead"><strong>${escapeHtml(user.email)}</strong></p>
        <p class="muted">Your journal is saved to your account, so it's there even if you change devices.</p>
        <div class="button-row">
          <button class="btn btn-secondary" data-slot="signout">${icon("signOut")} Sign out</button>
        </div>
      </div>
    </div>
  `);
  root.appendChild(panel);

  panel.querySelector('[data-slot="signout"]').addEventListener("click", async () => {
    await signOut();
    await refreshDataMode();
    toast("Signed out. Capsule is back to device-only mode.");
    navigate("account");
  });

  appendReminderCard(root);
  appendRhythmCard(root);
  appendTourCard(root, navigate);
  appendCloudDangerZone(root, navigate);
}

/* ---------- Evening reminder ---------- */

function appendReminderCard(root) {
  const card = el(`
    <div class="glass-card space-above">
      <h3>Evening reminder</h3>
      <p class="muted">If you have not finished the day's list by 7pm, Capsule can send you a short email. Off unless you turn it on.</p>
      <label class="ack-row compact">
        <input type="checkbox" data-slot="reminder" />
        <span data-slot="reminder-label">Email me a reminder at 7pm</span>
      </label>
    </div>
  `);
  root.appendChild(card);

  const box = card.querySelector('[data-slot="reminder"]');
  const label = card.querySelector('[data-slot="reminder-label"]');

  getReminderPref().then((pref) => {
    box.checked = Boolean(pref?.enabled);
  }).catch(() => {});

  box.addEventListener("change", async () => {
    const wanted = box.checked;
    box.disabled = true;
    try {
      await setReminderPref(wanted);
      label.textContent = wanted ? "Reminders are on" : "Email me a reminder at 7pm";
      toast(wanted ? "Reminders are on." : "Reminders are off.");
    } catch (err) {
      console.error(err);
      box.checked = !wanted;
      toast("Could not save that. Please try again.");
    } finally {
      box.disabled = false;
    }
  });
}

/* ---------- Replayable tour ---------- */

/**
 * How often Capsule is used. Everything that counts time follows this: the
 * streak, how soon an activity comes round again, and the wording. Capsule
 * works it out from the entries by itself; this is for saying so outright.
 */
const RHYTHM_CHOICES = [
  { value: "auto", label: "Let Capsule work it out" },
  { value: "daily", label: "Most days" },
  { value: "weekly", label: "Once a week" },
];

async function appendRhythmCard(root) {
  const setting = await getRhythmSetting();
  const detected = rhythmFrom(await db.allEntries().catch(() => []), "auto");
  const card = el(`
    <div class="glass-card space-above">
      <h3>How often you use Capsule</h3>
      <p class="muted">Capsule fits itself around this. Once a week is a perfectly good way to use it, and the streak then counts weeks instead of days.</p>
      <div class="button-row" data-slot="choices"></div>
      <p class="muted" data-slot="note"></p>
    </div>
  `);
  const note = card.querySelector('[data-slot="note"]');
  const choices = card.querySelector('[data-slot="choices"]');

  const paint = (value) => {
    choices.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.value === value;
      b.className = `btn ${on ? "btn-primary" : "btn-secondary"}`;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    note.textContent = value === "auto"
      ? `Capsule is going by your entries, and right now it reads them as ${detected.unit === "week" ? "about once a week" : "most days"}.`
      : "";
  };

  for (const c of RHYTHM_CHOICES) {
    const b = el(`<button class="btn btn-secondary" type="button" data-value="${c.value}">${escapeHtml(c.label)}</button>`);
    b.addEventListener("click", async () => {
      await setRhythmSetting(c.value);
      paint(c.value);
      toast(c.value === "weekly" ? "Capsule will count weeks." : c.value === "daily" ? "Capsule will count days." : "Capsule will work it out from your entries.");
    });
    choices.appendChild(b);
  }
  paint(setting);
  root.appendChild(card);
}

function appendTourCard(root, navigate) {
  const card = el(`
    <div class="glass-card space-above">
      <h3>Show me around again</h3>
      <p class="muted">A short tour of what each part of Capsule does.</p>
      <button class="btn btn-secondary" data-slot="tour">Start the tour</button>
    </div>
  `);
  card.querySelector('[data-slot="tour"]').addEventListener("click", () => {
    startWalkthrough({ navigate });
  });
  root.appendChild(card);
}

/* ---------- Danger zone ---------- */

function dangerZone(title, bodyHtml) {
  return el(`
    <div class="danger-zone">
      <hr class="danger-rule" />
      <h3 class="danger-title">${title}</h3>
      ${bodyHtml}
      <hr class="danger-rule" />
    </div>
  `);
}

function appendCloudDangerZone(root, navigate) {
  const zone = dangerZone("Delete my account", `
    <p class="muted">This permanently deletes your account, all journal entries, all photos, and all speech metrics. This cannot be undone.</p>
    <button class="btn btn-danger" data-slot="delete">Delete my account</button>
  `);
  zone.querySelector('[data-slot="delete"]').addEventListener("click", () => {
    openDeleteFlow({ mode: "cloud", navigate });
  });
  root.appendChild(zone);
}

function appendLocalDangerZone(root, navigate) {
  const zone = dangerZone("Delete my data", `
    <p class="muted">This permanently deletes every journal entry, photo, and metric stored on this device. This cannot be undone.</p>
    <button class="btn btn-danger" data-slot="delete">Delete my data</button>
  `);
  zone.querySelector('[data-slot="delete"]').addEventListener("click", () => {
    openDeleteFlow({ mode: "local", navigate });
  });
  root.appendChild(zone);
}

/* ---------- Multi-step deletion flow ---------- */

export function openDeleteFlow({ mode, navigate }) {
  const isLocal = mode === "local";
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  /* Step 1: what will be removed */
  function stepWarn() {
    overlay.innerHTML = `
      <div class="glass-panel delete-panel">
        <h2>${isLocal ? "Delete all your Capsule data?" : "Delete your Capsule account?"}</h2>
        <p>This will permanently delete:</p>
        <ul class="delete-list">
          <li>All your journal entries</li>
          <li>All your uploaded photos</li>
          <li>All your speech and memory trends</li>
          ${isLocal ? "" : "<li>Your account and sign-in</li>"}
        </ul>
        <p class="delete-warn">This cannot be undone. We recommend this only if you're sure. There is no way to recover this data afterward.</p>
        <div class="delete-actions">
          <button class="btn btn-secondary btn-large" data-slot="cancel">Cancel</button>
          <button class="btn btn-danger btn-large" data-slot="continue">Continue</button>
        </div>
      </div>`;
    overlay.querySelector('[data-slot="cancel"]').addEventListener("click", close);
    overlay.querySelector('[data-slot="continue"]').addEventListener("click", stepConfirm);
  }

  /* Step 2: type DELETE */
  function stepConfirm() {
    overlay.innerHTML = `
      <div class="glass-panel delete-panel">
        <h2>Are you certain?</h2>
        <p>To confirm, type <strong>DELETE</strong> below.</p>
        <input class="confirm-input" type="text" data-slot="confirm" autocomplete="off" autocapitalize="characters"
               spellcheck="false" aria-label="Type DELETE to confirm"
               />
        <div class="delete-actions">
          <button class="btn btn-secondary btn-large" data-slot="cancel">Cancel</button>
          <button class="btn btn-danger btn-large" data-slot="go" disabled>
            ${isLocal ? "Permanently delete my data" : "Permanently delete my account"}
          </button>
        </div>
      </div>`;
    const input = overlay.querySelector('[data-slot="confirm"]');
    const go = overlay.querySelector('[data-slot="go"]');
    input.addEventListener("input", () => {
      go.disabled = input.value !== "DELETE";
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !go.disabled) go.click();
    });
    overlay.querySelector('[data-slot="cancel"]').addEventListener("click", close);
    go.addEventListener("click", stepRun);
    input.focus();
  }

  /* Step 3: run it, showing each step honestly */
  async function stepRun() {
    const steps = isLocal ? [{ key: "local", label: "Removing your data" }] : STEPS;
    overlay.innerHTML = `
      <div class="glass-panel delete-panel">
        <h2>${isLocal ? "Deleting your data..." : "Deleting your account..."}</h2>
        <ul class="delete-progress" data-slot="progress">
          ${steps.map((s) => `<li data-step="${s.key}"><span class="step-mark"></span> ${s.label}</li>`).join("")}
        </ul>
        <p class="muted">Please keep this window open.</p>
      </div>`;

    const paint = (state) => {
      for (const [key, info] of Object.entries(state)) {
        const li = overlay.querySelector(`[data-step="${key}"]`);
        if (!li) continue;
        li.classList.remove("running", "done", "failed");
        li.classList.add(info.status);
        const mark = li.querySelector(".step-mark");
        mark.textContent = info.status === "done" ? "✓" : info.status === "failed" ? "×" : "";
      }
    };

    if (isLocal) {
      paint({ local: { status: "running" } });
      try {
        await wipeLocalData();
        paint({ local: { status: "done" } });
        stepDone({ ok: true, steps: {} });
      } catch (err) {
        console.error(err);
        const message = String(err?.message || "");
        const detail = message.startsWith("blocked")
          ? "Capsule is open in another tab or window. Please close it, then try again."
          : message.startsWith("wipe-incomplete")
            ? "some entries could not be removed"
            : "could not clear this device";
        paint({ local: { status: "failed" } });
        stepDone({ ok: false, steps: { local: { status: "failed", detail } } });
      }
      return;
    }

    const result = await deleteCloudAccount(paint);
    stepDone(result);
  }

  /* Step 4: outcome, told truthfully */
  function stepDone(result) {
    if (result.ok) {
      overlay.innerHTML = `
        <div class="glass-panel delete-panel is-done">
          <div class="delete-done-mark">${icon("check")}</div>
          <h2>${isLocal ? "Your data has been deleted." : "Your account and all data have been deleted."}</h2>
          <p>Thank you for using Capsule.</p>
          <button class="btn btn-primary btn-large" data-slot="finish">
            ${isLocal ? "Start again" : "Return to sign-in"}
          </button>
        </div>`;
      overlay.querySelector('[data-slot="finish"]').addEventListener("click", async () => {
        close();
        await refreshDataMode();
        // "Start again" begins at Home, the first step of a day; a deleted
        // account goes back to signing in.
        navigate(isLocal ? "home" : "account");
      });
      return;
    }

    const failed = Object.entries(result.steps || {}).filter(([, s]) => s.status === "failed");
    const done = Object.entries(result.steps || {}).filter(([, s]) => s.status === "done");
    overlay.innerHTML = `
      <div class="glass-panel delete-panel">
        <h2>Deletion did not fully finish</h2>
        <p>We do not want to tell you your data is gone when some of it is not. Here is exactly what happened:</p>
        <ul class="delete-progress">
          ${done.map(([k]) => `<li class="done"><span class="step-mark">✓</span> ${labelFor(k)}: removed</li>`).join("")}
          ${failed.map(([k, s]) => `<li class="failed"><span class="step-mark">×</span> ${labelFor(k)}: ${escapeHtml(s.detail || "did not complete")}</li>`).join("")}
        </ul>
        <p class="muted">This is usually a connection problem. Trying again is safe: anything already removed stays removed.</p>
        <div class="delete-actions">
          <button class="btn btn-secondary btn-large" data-slot="cancel">Close</button>
          <button class="btn btn-danger btn-large" data-slot="retry">Try again</button>
        </div>
      </div>`;
    overlay.querySelector('[data-slot="cancel"]').addEventListener("click", async () => {
      close();
      await refreshDataMode();
      navigate("account");
    });
    overlay.querySelector('[data-slot="retry"]').addEventListener("click", stepRun);
  }

  function labelFor(key) {
    const found = STEPS.find((s) => s.key === key);
    if (found) return found.label;
    return key === "local" ? "Removing your data" : key;
  }

  stepWarn();
}

function renderSignIn(root, navigate) {
  const panel = el(`
    <div class="glass-panel narrow-panel">
      <h2>Sign in to Capsule</h2>
      ${guideHtml("You do not have to sign in. If you want to, type your email address, tick the box, and tap Email me a code. Then type the 6 numbers from the email.")}

      <div data-step="email">
        <label class="field-label" for="signin-email">Your email address</label>
        <input id="signin-email" type="text" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false"
               data-slot="email" placeholder="you@example.com" />

        <div class="policy-consent">
          <label class="ack-row">
            <input type="checkbox" data-slot="accept" />
            <span>I have read and accept the <button type="button" class="btn-link" data-slot="open-policy">Privacy Policy</button> and the <button type="button" class="btn-link" data-slot="open-terms">Terms of Service</button>. I understand Capsule stores my journal entries, photos, and speech measurements, and that it does not diagnose any condition.</span>
          </label>
        </div>

        <button class="btn btn-primary btn-large space-above-sm" data-slot="send" disabled>${icon("mail")} Email me a code</button>
      </div>

      <div data-step="code" hidden>
        <p class="sub-label">We emailed a 6-digit code to <span data-slot="sent-to"></span>.</p>
        <label class="field-label" for="signin-code">Enter the code</label>
        <input id="signin-code" class="code-input" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" data-slot="code"
               placeholder="123456" />
        <button class="btn btn-primary btn-large space-above" data-slot="verify">${icon("check")} Sign in</button>
        <button class="btn btn-secondary btn-large space-above-sm" data-slot="back">Use a different email</button>
      </div>

      <p class="muted space-above">Prefer not to have an account? Your journal simply stays on this device, and everything still works.</p>
    </div>
  `);
  root.appendChild(panel);

  const emailStep = panel.querySelector('[data-step="email"]');
  const codeStep = panel.querySelector('[data-step="code"]');
  const emailInput = panel.querySelector('[data-slot="email"]');
  const codeInput = panel.querySelector('[data-slot="code"]');
  const acceptBox = panel.querySelector('[data-slot="accept"]');
  const sendBtn = panel.querySelector('[data-slot="send"]');

  // No account can be created without accepting the policy first.
  acceptBox.addEventListener("change", () => {
    sendBtn.disabled = !acceptBox.checked;
  });
  panel.querySelector('[data-slot="open-policy"]').addEventListener("click", (e) => {
    e.preventDefault();
    openPrivacyPolicy();
  });
  panel.querySelector('[data-slot="open-terms"]').addEventListener("click", (e) => {
    e.preventDefault();
    openTerms();
  });

  sendBtn.addEventListener("click", async (e) => {
    const email = emailInput.value.trim().toLowerCase();
    const btn = e.currentTarget;
    if (!acceptBox.checked) {
      noteAbove(btn, "Please read and accept the Privacy Policy and Terms of Service first.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      noteAbove(btn, email ? "That doesn't look like an email address. Please check it." : "Type your email address in the box first.");
      return;
    }
    clearNoteAbove(btn);
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
      const acceptedAt = new Date().toISOString();
      await sendSignInCode(email, {
        privacy_policy_version: POLICY_VERSION,
        terms_version: TERMS_VERSION,
        legal_accepted_at: acceptedAt,
      });
      await db.setMeta("legalAccepted", {
        privacyVersion: POLICY_VERSION, termsVersion: TERMS_VERSION, at: acceptedAt, email,
      });
      panel.querySelector('[data-slot="sent-to"]').textContent = email;
      emailStep.hidden = true;
      codeStep.hidden = false;
      codeInput.focus();
    } catch (err) {
      console.error(err);
      noteAbove(btn, "Couldn't send the code. Please try again in a moment.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon("mail")} Email me a code`;
    }
  });

  panel.querySelector('[data-slot="verify"]').addEventListener("click", async (e) => {
    const email = emailInput.value.trim().toLowerCase();
    const token = codeInput.value.trim();
    const btn = e.currentTarget;
    if (token.length < 6) {
      noteAbove(btn, "Please type the 6-digit code from your email.");
      return;
    }
    clearNoteAbove(btn);
    btn.disabled = true;
    btn.textContent = "Checking...";
    try {
      await verifySignInCode(email, token);
      await refreshDataMode();
      toast("You're signed in.");
      navigate("journal");
    } catch (err) {
      console.error(err);
      noteAbove(btn, "That code didn't work. Check it, or tap Use a different email to get a new one.");
      btn.disabled = false;
      btn.innerHTML = `${icon("check")} Sign in`;
    }
  });

  panel.querySelector('[data-slot="back"]').addEventListener("click", () => {
    codeStep.hidden = true;
    emailStep.hidden = false;
    emailInput.focus();
  });

  appendRhythmCard(root);
  appendTourCard(root, navigate);

  // Someone signed out can still have journal entries on this device. Without
  // this, they would have no way to erase them, so offer it whenever data exists.
  localEntryCount().then((count) => {
    if (count > 0) appendLocalDangerZone(root, navigate);
  });
}
