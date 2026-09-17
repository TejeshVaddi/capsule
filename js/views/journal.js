import { db, newId } from "../data.js?v=2fb457af22";
import { analyzeText } from "../analysis.js?v=2fb457af22";
import { SpeechInput, speechSupported } from "../speech.js?v=2fb457af22";
import { renderWordGraphSVG, wordGraphLegendHTML } from "../graph.js?v=2fb457af22";
import { nextStepBlock } from "../next-step.js?v=2fb457af22";
import { toast, escapeHtml, el, createSpeechComposer, photoUrl, guideHtml, noteAbove, clearNoteAbove } from "../ui.js?v=2fb457af22";
import { icon } from "../icons.js?v=2fb457af22";

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
        ${guideHtml("Tell Capsule about your day. Tap the purple microphone and talk, or type in the box. When you are done, tap Save today's entry at the bottom.")}
        <div data-slot="composer"></div>
        <div class="photo-strip" data-slot="photos"></div>
        <div class="button-row">
          <label class="upload-label">
            ${icon("camera")} Add photos from today
            <input type="file" accept="image/*" multiple data-slot="file-input" />
          </label>
        </div>
        <div class="space-above">
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
      noteAbove(saveBtn, "Say or type a little about your day first. Then tap Save today's entry.");
      return;
    }
    clearNoteAbove(saveBtn);
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
  // What to do next comes first. The word patterns are there for anyone who
  // wants them, below it.
  container.innerHTML = `
    <div class="glass-panel fade-in" data-slot="next">
      <h2>${icon("check")} Saved</h2>
    </div>
    <div class="glass-card space-above">
      <h3>Today's word patterns</h3>
      <p class="muted">How you told your story today.</p>
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
  `;

  container.querySelector('[data-slot="next"]').appendChild(await nextStepBlock(navigate, "Your entry is saved."));
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}
