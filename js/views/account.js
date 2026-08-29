import { cloudConfigured } from "../config.js";
import { currentUser, sendSignInCode, verifySignInCode, signOut, getReminderPref, setReminderPref } from "../cloud.js";
import { refreshDataMode, migrateLocalToCloud, localEntryCount, db } from "../data.js";
import { toast, escapeHtml, el } from "../ui.js";
import { icon } from "../icons.js";
import { deleteCloudAccount, wipeLocalData, STEPS } from "../deletion.js";
import { startWalkthrough } from "../walkthrough.js";
import { openPrivacyPolicy, POLICY_VERSION } from "../privacy.js";
import { openTerms, TERMS_VERSION } from "../terms.js";

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
        <p style="font-size:1.1rem;"><strong>${escapeHtml(user.email)}</strong></p>
        <p class="muted">Your journal is saved to your account, so it's there even if you change devices.</p>
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:10px;">
          <button class="btn btn-secondary" data-slot="signout">${icon("signOut")} Sign out</button>
        </div>
      </div>
      <div class="glass-card" data-slot="migrate-card" hidden>
        <h3>Entries on this device</h3>
        <p class="muted" data-slot="migrate-text"></p>
        <button class="btn btn-accent" data-slot="migrate">${icon("upload")} Copy them to my account</button>
      </div>
    </div>
  `);
  root.appendChild(panel);

  localEntryCount().then((count) => {
    if (count > 0) {
      panel.querySelector('[data-slot="migrate-card"]').hidden = false;
      panel.querySelector('[data-slot="migrate-text"]').textContent =
        `This device has ${count} entr${count === 1 ? "y" : "ies"} saved from before you signed in. You can copy them into your account.`;
    }
  });

  panel.querySelector('[data-slot="signout"]').addEventListener("click", async () => {
    await signOut();
    await refreshDataMode();
    toast("Signed out. Capsule is back to device-only mode.");
    navigate("account");
  });

  panel.querySelector('[data-slot="migrate"]').addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Copying...";
    try {
      const moved = await migrateLocalToCloud((done, total) => {
        btn.textContent = `Copying... ${done} of ${total}`;
      });
      toast(`Copied ${moved} entr${moved === 1 ? "y" : "ies"} to your account.`);
      panel.querySelector('[data-slot="migrate-card"]').hidden = true;
    } catch (err) {
      console.error(err);
      toast("Copying didn't finish. You can try again.");
      btn.disabled = false;
      btn.innerHTML = `${icon("upload")} Copy them to my account`;
    }
  });

  appendReminderCard(root);
  appendTourCard(root, navigate);
  appendCloudDangerZone(root, navigate);
}

/* ---------- Evening reminder ---------- */

function appendReminderCard(root) {
  const card = el(`
    <div class="glass-card" style="margin-top:16px;">
      <h3>Evening reminder</h3>
      <p class="muted">If you have not finished the day's list by 7pm, Capsule can send you a short email. Off unless you turn it on.</p>
      <label class="ack-row" style="margin:12px 4px;">
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

function appendTourCard(root, navigate) {
  const card = el(`
    <div class="glass-card" style="margin-top:16px;">
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
        <input type="text" data-slot="confirm" autocomplete="off" autocapitalize="characters"
               spellcheck="false" aria-label="Type DELETE to confirm"
               style="font-size:1.4rem; letter-spacing:0.15em; text-align:center;" />
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
        navigate("account");
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
    <div class="glass-panel" style="max-width:560px; margin:0 auto;">
      <h2>Sign in to Capsule</h2>
      <p class="muted">Enter your email and we'll send you a 6-digit code. No password to remember.</p>

      <div data-step="email">
        <label style="font-weight:600; display:block; margin:14px 0 6px;">Your email address</label>
        <input type="text" inputmode="email" autocomplete="email" data-slot="email" placeholder="you@example.com" />

        <div class="policy-consent">
          <label class="ack-row">
            <input type="checkbox" data-slot="accept" />
            <span>I have read and accept the <button type="button" class="btn-link" data-slot="open-policy">Privacy Policy</button> and the <button type="button" class="btn-link" data-slot="open-terms">Terms of Service</button>. I understand Capsule stores my journal entries, photos, and speech measurements, and that it does not diagnose any condition.</span>
          </label>
        </div>

        <button class="btn btn-primary btn-large" style="margin-top:4px;" data-slot="send" disabled>${icon("mail")} Email me a code</button>
      </div>

      <div data-step="code" hidden>
        <p style="font-weight:600; margin-top:14px;">We emailed a 6-digit code to <span data-slot="sent-to"></span>.</p>
        <label style="font-weight:600; display:block; margin:14px 0 6px;">Enter the code</label>
        <input type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" data-slot="code"
               placeholder="123456" style="font-size:1.6rem; letter-spacing:0.3em; text-align:center;" />
        <button class="btn btn-primary btn-large" style="margin-top:14px;" data-slot="verify">${icon("check")} Sign in</button>
        <button class="btn btn-secondary btn-large" style="margin-top:10px;" data-slot="back">Use a different email</button>
      </div>

      <p class="muted" style="margin-top:18px;">Prefer not to have an account? Your journal simply stays on this device, and everything still works.</p>
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
    if (!acceptBox.checked) {
      toast("Please read and accept the Privacy Policy and Terms of Service first.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast("That doesn't look like an email address. Please check it.");
      return;
    }
    const btn = e.currentTarget;
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
      toast("Couldn't send the code. Please try again in a moment.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon("mail")} Email me a code`;
    }
  });

  panel.querySelector('[data-slot="verify"]').addEventListener("click", async (e) => {
    const email = emailInput.value.trim().toLowerCase();
    const token = codeInput.value.trim();
    if (token.length < 6) {
      toast("Please enter the 6-digit code from your email.");
      return;
    }
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = "Checking...";
    try {
      await verifySignInCode(email, token);
      await refreshDataMode();
      toast("You're signed in.");
      navigate("journal");
    } catch (err) {
      console.error(err);
      toast("That code didn't work. Check it, or request a new one.");
      btn.disabled = false;
      btn.innerHTML = `${icon("check")} Sign in`;
    }
  });

  panel.querySelector('[data-slot="back"]').addEventListener("click", () => {
    codeStep.hidden = true;
    emailStep.hidden = false;
    emailInput.focus();
  });

  appendTourCard(root, navigate);

  // Someone signed out can still have journal entries on this device. Without
  // this, they would have no way to erase them, so offer it whenever data exists.
  localEntryCount().then((count) => {
    if (count > 0) appendLocalDangerZone(root, navigate);
  });
}
