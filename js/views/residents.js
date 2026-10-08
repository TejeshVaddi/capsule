// The residents list, and one resident's page: a care centre's whole screen.
//
// A centre signs up once and keeps a house in that account. Everything a
// member of staff does here is about picking the right person and handing
// the screen to them, so the list is the first thing and the biggest thing:
// names in the order a paper list keeps them, a search box for a long
// corridor, and one button that opens a resident's own Capsule.
//
// What this page deliberately does not do is show anybody's writing. Staff
// need to know who still has their day to do, not what was in it. So a
// resident's page shows their streak, how their own measures have moved,
// and nothing of what they actually said. Their words are for them, and for
// whoever they choose to show them to.

import { db } from "../data.js?v=c44468da07";
import { el, escapeHtml, guideHtml, toast, photoUrl } from "../ui.js?v=c44468da07";
import { icon } from "../icons.js?v=c44468da07";
import {
  listProfiles, getProfile, saveProfile, deleteProfile,
  openProfile, firstNameOf, ageFrom, dateOfBirth, STAFF_ACCESS, staffAccessOf,
} from "../profiles.js?v=c44468da07";
import { db as localDb, newId } from "../db.js?v=c44468da07";
import { getStreak, getDailyPlan } from "../daily.js?v=c44468da07";
import { currentRhythm } from "../rhythm.js?v=c44468da07";
import { generateTrendNotes } from "../charts.js?v=c44468da07";
import { TONE_WORDS } from "../meaning.js?v=c44468da07";

/**
 * The streak and what is left today, for one resident. Every read says
 * whose it is, so the whole list can be worked out at once without the
 * open resident ever changing. See data.js.
 */
async function summaryOf(id) {
  const entries = await db.allEntries(id).catch(() => []);
  const rhythm = await currentRhythm(entries, id);
  const [streak, plan] = await Promise.all([
    getStreak(rhythm, id).catch(() => ({ count: 0, unit: "day" })),
    getDailyPlan(id).catch(() => null),
  ]);
  return {
    streak: streak.count || 0,
    unit: streak.unit || rhythm.unit,
    done: plan ? plan.doneCount : 0,
    total: plan ? plan.totalCount : 0,
    allDone: plan ? plan.allDone : false,
    entries: entries.filter((e) => e.type === "journal").length,
  };
}

export async function renderResidentsView(root, { navigate } = {}) {
  root.innerHTML = "";
  const page = el(`<div class="stack"></div>`);
  root.appendChild(page);

  const profiles = await listProfiles();

  const panel = el(`
    <div class="glass-panel">
      <div class="section-title"><h2>Residents</h2><span class="pill">${profiles.length}</span></div>
      ${guideHtml("Tap a name to open that person's Capsule. Tap the plus button to add someone new.")}
      <div class="resident-search">
        <input type="search" data-slot="search" placeholder="Search by name" aria-label="Search residents" autocomplete="off" />
        <button class="btn btn-primary resident-add" type="button" data-slot="add" aria-label="Add a resident" title="Add a resident">+</button>
      </div>
      <div data-slot="list" class="resident-list"></div>
    </div>`);
  page.appendChild(panel);

  const listWrap = panel.querySelector('[data-slot="list"]');
  const search = panel.querySelector('[data-slot="search"]');

  function paint(filter = "") {
    const needle = filter.trim().toLowerCase();
    const shown = needle
      ? profiles.filter((p) => p.name.toLowerCase().includes(needle))
      : profiles;

    if (!profiles.length) {
      listWrap.innerHTML = `<p class="muted">Nobody has been added yet. Tap the plus button to add your first resident.</p>`;
      return;
    }
    if (!shown.length) {
      listWrap.innerHTML = `<p class="muted">No resident matches "${escapeHtml(filter)}".</p>`;
      return;
    }

    listWrap.innerHTML = "";
    for (const p of shown) {
      const row = el(`
        <button class="resident-row" type="button" data-id="${escapeHtml(p.id)}">
          <span class="resident-face" data-slot="face" aria-hidden="true">${escapeHtml(initialsOf(p.name))}</span>
          <span class="resident-name">${escapeHtml(p.name)}</span>
          <span class="resident-streak" data-slot="streak" aria-hidden="true">
            ${icon("star", "icon resident-star")}<span class="resident-streak-num">·</span>
          </span>
        </button>`);
      row.addEventListener("click", () => openResident(root, p.id, navigate));
      listWrap.appendChild(row);
      paintFace(row.querySelector('[data-slot="face"]'), p);
      // The streak needs that resident's own records, so it is filled in
      // after the row is on screen rather than holding the whole list up.
      summaryOf(p.id).then((s) => {
        const num = row.querySelector(".resident-streak-num");
        if (num) num.textContent = String(s.streak);
        row.querySelector('[data-slot="streak"]')
          ?.setAttribute("title", `${s.streak} ${s.streak === 1 ? s.unit : s.unit + "s"} in a row`);
        if (!s.allDone && s.total) row.classList.add("resident-pending");
      }).catch(() => {});
    }
  }

  search.addEventListener("input", () => paint(search.value));
  panel.querySelector('[data-slot="add"]').addEventListener("click", () => openEditor(root, null, navigate));
  paint();
}

function initialsOf(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** A resident's own photo in the circle, when they have one. */
async function paintFace(node, profile) {
  if (!node || !profile?.photoId) return;
  const photo = await localDb.getPhoto(profile.photoId).catch(() => null);
  if (!photo?.blob) return;
  node.innerHTML = `<img src="${photoUrl(photo.blob)}" alt="" />`;
  node.classList.add("has-photo");
}

/* ---------------- One resident ---------------- */

async function openResident(root, id, navigate) {
  const profile = await getProfile(id);
  if (!profile) return;

  root.innerHTML = "";
  const page = el(`<div class="stack"></div>`);
  root.appendChild(page);

  const age = ageFrom(profile.dob);
  const card = el(`
    <div class="glass-panel">
      <button class="btn-text" type="button" data-slot="back">${icon("arrowRight", "icon back-arrow")} All residents</button>
      <div class="resident-head">
        <span class="resident-face resident-face-lg" data-slot="face" aria-hidden="true">${escapeHtml(initialsOf(profile.name))}</span>
        <div class="resident-id">
          <h2>${escapeHtml(profile.name)}</h2>
          <p class="muted">${profile.dob ? `${escapeHtml(formatDob(profile.dob))}${age !== null ? `, age ${age}` : ""}` : "No date of birth on file"}</p>
        </div>
      </div>
      <button class="btn btn-primary btn-large launch-btn" type="button" data-slot="launch">
        ${icon("arrowRight")} Launch Capsule
      </button>
      <div data-slot="summary" class="resident-summary"><p class="muted">Looking at their record...</p></div>
      <div class="button-row space-above">
        <button class="btn btn-secondary" type="button" data-slot="edit">Edit details</button>
      </div>
    </div>`);
  page.appendChild(card);
  paintFace(card.querySelector('[data-slot="face"]'), profile);

  card.querySelector('[data-slot="back"]').addEventListener("click", () => renderResidentsView(root, { navigate }));
  card.querySelector('[data-slot="edit"]').addEventListener("click", () => openEditor(root, profile, navigate));
  card.querySelector('[data-slot="launch"]').addEventListener("click", () => {
    openProfile(profile.id);
    if (navigate) navigate("home", { launched: true });
  });

  const summary = card.querySelector('[data-slot="summary"]');
  const s = await summaryOf(profile.id);
  // Only read for someone who has agreed that staff may see it. Not fetched
  // and then hidden: not fetched. See STAFF_ACCESS in profiles.js.
  const access = staffAccessOf(profile);
  let notes = [];
  if (access === "shared") {
    const all = await db.allEntries(profile.id).catch(() => []);
    const journals = all.filter((e) => e.type === "journal");
    if (journals.length >= 2) {
      try {
        notes = generateTrendNotes(journals, all.filter((e) => e.type === "recall")).notes || [];
      } catch {
        notes = [];
      }
    }
  }

  summary.innerHTML = `
    <div class="resident-stats">
      <div><strong>${s.streak}</strong><span>${s.streak === 1 ? s.unit : s.unit + "s"} in a row</span></div>
      <div><strong>${s.entries}</strong><span>${s.entries === 1 ? "entry" : "entries"}</span></div>
      <div><strong>${s.done} of ${s.total}</strong><span>done today</span></div>
    </div>
    ${s.allDone
      ? `<p class="resident-done">${icon("check")} Everything is done for today.</p>`
      : `<p class="muted">Still to do today: ${escapeHtml(stillToDo(s))}.</p>`}
    ${access !== "shared"
      ? `<p class="muted space-above-sm">${icon("device")} How ${escapeHtml(firstNameOf(profile))}'s patterns are moving is kept for ${escapeHtml(firstNameOf(profile))}. You can change that under Edit details if they have agreed to it.</p>`
      : notes.length
        ? `<h3 class="space-above-sm">How their own patterns have moved</h3>
           <!-- Spelled out rather than tucked into a dropdown. A member of
                staff reading this has not spent weeks with the measures and
                should not have to guess what one means, so each change says
                what it is, what it affects, and why it is worth attention.
                The sentences themselves stay in the second person: they are
                what ${firstNameOf(profile)} reads on their own Trends page,
                and turning a line written to somebody into a line about
                them is the thing this app is meant not to do. -->
           <p class="muted">Word for word, these are the lines ${escapeHtml(firstNameOf(profile))} sees on their own Trends page.</p>
           <div class="stack stack-tight">
             ${notes.slice(0, 4).map((n) => `
               <div class="trend-note trend-${escapeHtml(n.tone || "steady")}">
                 <span class="trend-verdict">${escapeHtml(TONE_WORDS[n.tone] || TONE_WORDS.steady)}</span>
                 <p class="trend-what">${escapeHtml(n.text)}</p>
                 ${n.whatIs ? `<p class="resident-part"><span class="explain-tag">What it is</span>${escapeHtml(n.whatIs)}</p>` : ""}
                 ${n.means ? `<p class="resident-part"><span class="explain-tag">What it affects</span>${escapeHtml(n.means)}</p>` : ""}
                 ${n.helps ? `<p class="resident-part"><span class="explain-tag">Why it matters</span>${escapeHtml(n.helps)}</p>` : ""}
               </div>`).join("")}
           </div>
           <p class="muted chart-note">Compared only with this person's own earlier weeks, never with anyone else. Nothing here diagnoses anything, and none of it is a reason to change anybody's care.</p>`
        : `<p class="muted space-above-sm">Their patterns appear here after a few entries spread over time.</p>`}
    <p class="muted chart-note">Opening someone's Capsule shows their whole journal, whatever this is set to. That is what it is for, so do it with them rather than instead of them.</p>`;
}

function stillToDo(s) {
  const left = Math.max(0, s.total - s.done);
  return left === s.total ? "the whole list" : `${left} of ${s.total}`;
}

function formatDob(dob) {
  const d = dateOfBirth(dob);
  if (!d) return dob;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/* ---------------- Adding and editing ---------------- */

function openEditor(root, profile, navigate) {
  root.innerHTML = "";
  const page = el(`<div class="stack"></div>`);
  root.appendChild(page);

  const card = el(`
    <div class="glass-panel">
      <h2>${profile ? "Edit details" : "Add a resident"}</h2>
      ${guideHtml(profile
        ? "Change anything that is not right, then tap Save."
        : "Type their name. The date of birth and photograph are optional, and can be added later.")}

      <label class="field-label" for="resident-name">Name</label>
      <input id="resident-name" type="text" data-slot="name" autocomplete="off"
             placeholder="Margaret Hughes" value="${profile ? escapeHtml(profile.name) : ""}" />

      <label class="field-label space-above-sm" for="resident-dob">Date of birth</label>
      <input id="resident-dob" type="date" data-slot="dob" value="${profile?.dob ? escapeHtml(profile.dob) : ""}" />

      <label class="field-label space-above-sm">Photograph</label>
      <div class="resident-photo-row">
        <span class="resident-face resident-face-lg" data-slot="face" aria-hidden="true">${escapeHtml(initialsOf(profile?.name || ""))}</span>
        <label class="upload-label">
          ${icon("camera")} ${profile?.photoId ? "Change photo" : "Add a photo"}
          <input type="file" accept="image/*" data-slot="photo" />
        </label>
      </div>

      ${profile ? "" : `
        <label class="ack-row compact space-above-sm">
          <input type="checkbox" data-slot="consent" />
          <span>I have this person's agreement, or the agreement of whoever decides for them, and they have been told what Capsule records and that staff who can sign in can read it.</span>
        </label>`}

      <label class="field-label space-above-sm">What staff can see without them here</label>
      <div class="access-choice" data-slot="access">
        ${Object.values(STAFF_ACCESS).map((opt) => `
          <button class="glass-card access-card" type="button" data-access="${escapeHtml(opt.key)}">
            <strong>${escapeHtml(opt.label)}</strong>
            <span class="muted">${escapeHtml(opt.detail)}</span>
          </button>`).join("")}
      </div>

      <button class="btn btn-primary btn-large space-above" type="button" data-slot="save">Save</button>
      <div class="button-row space-above-sm">
        <button class="btn btn-secondary" type="button" data-slot="cancel">Cancel</button>
        ${profile ? `<button class="btn btn-danger" type="button" data-slot="remove">Remove resident</button>` : ""}
      </div>
    </div>`);
  page.appendChild(card);
  if (profile) paintFace(card.querySelector('[data-slot="face"]'), profile);

  let access = staffAccessOf(profile);
  const accessWrap = card.querySelector('[data-slot="access"]');
  const paintAccess = () => {
    for (const b of accessWrap.querySelectorAll(".access-card")) {
      const on = b.dataset.access === access;
      b.classList.toggle("access-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    }
  };
  for (const b of accessWrap.querySelectorAll(".access-card")) {
    b.addEventListener("click", () => { access = b.dataset.access; paintAccess(); });
  }
  paintAccess();

  let pickedPhoto = null;
  const face = card.querySelector('[data-slot="face"]');
  card.querySelector('[data-slot="photo"]').addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pickedPhoto = file;
    face.innerHTML = `<img src="${photoUrl(file)}" alt="" />`;
    face.classList.add("has-photo");
  });

  const back = () => renderResidentsView(root, { navigate });
  card.querySelector('[data-slot="cancel"]').addEventListener("click", back);

  card.querySelector('[data-slot="save"]').addEventListener("click", async (e) => {
    const name = card.querySelector('[data-slot="name"]').value.trim();
    const dob = card.querySelector('[data-slot="dob"]').value;
    if (!name) {
      toast("Please type their name first.");
      return;
    }
    // Asked once, when a real person's journal is about to start being
    // kept. The words in it will be theirs, not the centre's, and this is
    // the moment that is actually true of somebody. See the Terms.
    const consent = card.querySelector('[data-slot="consent"]');
    if (consent && !consent.checked) {
      toast("Please confirm you have their agreement first.");
      consent.focus();
      return;
    }
    e.currentTarget.disabled = true;
    try {
      let photoId = profile?.photoId || null;
      if (pickedPhoto) {
        photoId = newId();
        // Stored like a journal photo, but tied to the person rather than
        // to a day, so it survives whatever happens to their entries.
        await localDb.putPhoto({ id: photoId, entryId: `profile:${profile?.id || "new"}`, blob: pickedPhoto, name: pickedPhoto.name || "photo" });
      }
      const saved = await saveProfile({ id: profile?.id, name, dob, photoId, staffAccess: access });
      toast(profile ? "Saved." : `${firstNameOf(saved)} has been added.`);
      openResident(root, saved.id, navigate);
    } catch (err) {
      console.error(err);
      toast("That could not be saved. Please try again.");
      e.currentTarget.disabled = false;
    }
  });

  card.querySelector('[data-slot="remove"]')?.addEventListener("click", async () => {
    const sure = window.confirm(
      `Remove ${profile.name}? This permanently deletes their entries, photographs, activities and streak. This cannot be undone.`
    );
    if (!sure) return;
    await deleteProfile(profile.id);
    toast(`${firstNameOf(profile)} has been removed.`);
    back();
  });
}
