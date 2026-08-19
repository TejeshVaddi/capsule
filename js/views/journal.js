import { db, newId } from "../data.js";
import { analyzeText } from "../analysis.js";
import { SpeechInput, speechSupported } from "../speech.js";
import { renderWordGraphSVG, wordGraphLegendHTML } from "../graph.js";
import { suggestActivities } from "../activities.js";
import { toast, escapeHtml, el, createSpeechComposer, photoUrl } from "../ui.js";
import { icon } from "../icons.js";

export async function renderJournalView(root, { navigate }) {
  const today = new Date();
  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });

  root.innerHTML = "";
  const panel = el(`
    <div class="stack">
      <div class="glass-panel">
        <div class="section-title">
          <h2>Today's journal</h2>
          <span class="pill">${escapeHtml(todayLabel)}</span>
        </div>
        <p class="muted">Tell Capsule about your day: what you did, who you saw, what you noticed. There's no wrong way to do it.</p>
        <div data-slot="composer"></div>
        <div class="photo-strip" data-slot="photos"></div>
        <div style="margin-top:14px; display:flex; gap:12px; flex-wrap:wrap;">
          <label class="upload-label">
            ${icon("camera")} Add photos from today
            <input type="file" accept="image/*" multiple hidden data-slot="file-input" />
          </label>
        </div>
        <div style="margin-top:18px;">
          <button class="btn btn-primary btn-large" data-slot="save">Save today's entry</button>
        </div>
      </div>
      <div data-slot="results"></div>
    </div>
  `);
  root.appendChild(panel);

  const composer = createSpeechComposer({
    placeholder: "For example: This morning I walked to the bakery with Ruth and we bought cinnamon rolls...",
    SpeechInputClass: SpeechInput,
    speechSupported,
  });
  panel.querySelector('[data-slot="composer"]').appendChild(composer.root);

  const photoStrip = panel.querySelector('[data-slot="photos"]');
  const fileInput = panel.querySelector('[data-slot="file-input"]');
  const pendingPhotos = [];

  fileInput.addEventListener("change", () => {
    for (const file of fileInput.files) {
      if (!file.type.startsWith("image/")) continue;
      const photo = { id: newId(), file };
      pendingPhotos.push(photo);
      const wrapEl = el(`
        <div class="photo-thumb-wrap">
          <img class="photo-thumb" alt="Photo from today" />
          <button class="photo-remove" aria-label="Remove photo">&times;</button>
        </div>
      `);
      wrapEl.querySelector("img").src = photoUrl(file);
      wrapEl.querySelector(".photo-remove").addEventListener("click", () => {
        const idx = pendingPhotos.indexOf(photo);
        if (idx >= 0) pendingPhotos.splice(idx, 1);
        wrapEl.remove();
      });
      photoStrip.appendChild(wrapEl);
    }
    fileInput.value = "";
  });

  const saveBtn = panel.querySelector('[data-slot="save"]');
  saveBtn.addEventListener("click", async () => {
    const text = composer.getText();
    if (!text) {
      toast("Say or type a little about your day first.");
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      const metrics = analyzeText(text);
      const entry = {
        id: newId(),
        type: "journal",
        date: new Date().toISOString(),
        text,
        metrics,
        photoIds: pendingPhotos.map((p) => p.id),
      };
      await db.putEntry(entry);
      for (const p of pendingPhotos) {
        await db.putPhoto({ id: p.id, entryId: entry.id, blob: p.file, name: p.file.name });
      }
      composer.destroy();
      toast("Entry saved.");
      await showResults(panel.querySelector('[data-slot="results"]'), entry, navigate);
      saveBtn.innerHTML = `${icon("check")} Saved`;
    } catch (err) {
      console.error(err);
      toast("Something went wrong saving. Your text is still in the box.");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save today's entry";
    }
  });
}

async function showResults(container, entry, navigate) {
  const m = entry.metrics;
  const all = await db.allEntries();
  const suggestions = suggestActivities(m, all).filter((s) => s.real).slice(0, 2);

  container.innerHTML = `
    <div class="glass-card" style="animation: fadeUp 0.4s ease;">
      <h3>Today's word patterns</h3>
      <p class="muted">A snapshot of how you told your story today.</p>
      <div class="grid grid-2">
        <div>
          <div class="metric-row"><span class="metric-name">Words spoken</span><span class="metric-value">${m.wordCount}</span></div>
          <div class="metric-row"><span class="metric-name">Different words used</span><span class="metric-value">${m.uniqueWords}</span></div>
          <div class="metric-row"><span class="metric-name">Naming words (nouns)</span><span class="metric-value">${(m.nounRate * 100).toFixed(0)}%</span></div>
          <div class="metric-row"><span class="metric-name">General words (pronouns)</span><span class="metric-value">${(m.pronounRate * 100).toFixed(0)}%</span></div>
          <div class="metric-row"><span class="metric-name">Hesitations per 100 words</span><span class="metric-value">${m.disfluencyRate.toFixed(1)}</span></div>
        </div>
        <div>
          ${renderWordGraphSVG(m, { size: 260 })}
          ${wordGraphLegendHTML()}
        </div>
      </div>
    </div>
    <div class="glass-card" style="margin-top:16px;">
      <h3>Suggested for you today</h3>
      <div class="grid grid-2" data-slot="suggestions"></div>
      <div style="margin-top:14px;">
        <button class="btn btn-accent" data-slot="go-activities">See all activities</button>
      </div>
    </div>
  `;

  const sugWrap = container.querySelector('[data-slot="suggestions"]');
  for (const s of suggestions) {
    sugWrap.appendChild(el(`
      <div class="glass-card activity-card">
        <span class="pill ${s.tailored ? "pill-yellow" : "pill-blue"} activity-tag">${escapeHtml(s.tag)}</span>
        <strong>${escapeHtml(s.title)}</strong>
        <span class="muted">${escapeHtml(s.why)}</span>
      </div>
    `));
  }

  container.querySelector('[data-slot="go-activities"]').addEventListener("click", () => navigate("activities"));
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}
