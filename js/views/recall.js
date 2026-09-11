import { db, newId } from "../data.js";
import { icon } from "../icons.js";
import { compareRecallToOriginal, analyzeText } from "../analysis.js";
import { SpeechInput, speechSupported } from "../speech.js";
import { pickEntryForRecall, formatFriendlyDate, daysBetween } from "../recall.js";
import { toast, escapeHtml, el, createSpeechComposer, photoUrl } from "../ui.js";

export async function renderRecallView(root, { navigate }) {
  root.innerHTML = "";

  const target = await pickEntryForRecall();
  if (!target) {
    root.appendChild(el(`
      <div class="glass-panel empty-state">
        <div class="empty-icon">${icon("sprout", "icon-lg")}</div>
        <h2>Nothing to look back on yet</h2>
        <p>Recall moments appear once a journal entry is a couple of days old. Keep journaling, and your first memory visit is on its way.</p>
        <button class="btn btn-primary" data-slot="go-journal">Write today's entry</button>
      </div>
    `));
    root.querySelector('[data-slot="go-journal"]').addEventListener("click", () => navigate("journal"));
    return;
  }

  // Only ever that day's own photos. If the day has none, no picture element
  // appears at all: a stand-in image would be worse than nothing, because it
  // would be offered as a memory cue for a day it has nothing to do with.
  const photos = await db.getPhotosForEntry(target.id).catch(() => []) || [];
  const age = daysBetween(target.date, new Date().toISOString());

  const panel = el(`
    <div class="stack">
      <div class="glass-panel">
        <div class="section-title">
          <h2>A memory visit</h2>
          <span class="pill pill-blue">${age} day${age === 1 ? "" : "s"} ago</span>
        </div>
        <p class="prompt">
          ${escapeHtml(formatFriendlyDate(target.date))}
        </p>
        ${photos.length ? `<p class="recall-hint-label">${icon("camera")} A picture from that day, to help</p>` : ""}
        <div class="recall-hint-strip" data-slot="photos"></div>
        <p class="muted space-above">
          Take a moment. What comes back first? Start with that, even if it's small.
        </p>
        <div data-slot="composer"></div>
        <button class="btn btn-primary btn-large" data-slot="save">I've said what I remember</button>
      </div>
      <div data-slot="results"></div>
    </div>
  `);
  root.appendChild(panel);

  const strip = panel.querySelector('[data-slot="photos"]');
  for (const p of photos) {
    const img = el(`<img class="recall-hint-photo" alt="Photo from that day" />`);
    img.src = photoUrl(p.blob);
    strip.appendChild(img);
  }
  if (!photos.length) strip.remove();

  const composer = createSpeechComposer({
    placeholder: "Whatever comes back to you about that day, big or small.",
    SpeechInputClass: SpeechInput,
    speechSupported,
  });
  panel.querySelector('[data-slot="composer"]').appendChild(composer.root);

  const saveBtn = panel.querySelector('[data-slot="save"]');
  saveBtn.addEventListener("click", async () => {
    const text = composer.getText();
    if (!text) {
      toast("Say or type what you remember first. Even a little is fine.");
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      const comparison = compareRecallToOriginal(text, target.text);
      const entry = {
        id: newId(),
        type: "recall",
        recallOf: target.id,
        date: new Date().toISOString(),
        text,
        metrics: analyzeText(text),
        recallComparison: {
          recallWordCount: comparison.recallWordCount,
          originalWordCount: comparison.originalWordCount,
          recallDistinctContentWords: comparison.recallDistinctContentWords,
          originalDistinctContentWords: comparison.originalDistinctContentWords,
          overlapCount: comparison.overlapCount,
          overlapRatio: comparison.overlapRatio,
        },
      };
      await db.putEntry(entry);
      composer.destroy();
      toast("Recall saved.");
      showComparison(panel.querySelector('[data-slot="results"]'), target, entry);
      saveBtn.remove();
    } catch (err) {
      console.error(err);
      toast("Something went wrong saving. Your words are still in the box.");
      saveBtn.disabled = false;
      saveBtn.textContent = "I've said what I remember";
    }
  });
}

function showComparison(container, original, recallEntry) {
  const c = recallEntry.recallComparison;
  container.innerHTML = `
    <div class="glass-card fade-in">
      <h3>Then and now</h3>
      <p class="muted">Here's what you said on the day, next to what you remembered just now.</p>
      <div class="compare-cols">
        <div class="compare-col">
          <span class="pill">On the day</span>
          <p>${escapeHtml(original.text)}</p>
        </div>
        <div class="compare-col">
          <span class="pill pill-yellow">Today's memory</span>
          <p>${escapeHtml(recallEntry.text)}</p>
        </div>
      </div>
      <div class="space-above">
        <div class="metric-row"><span class="metric-name">Details mentioned then</span><span class="metric-value">${c.originalDistinctContentWords}</span></div>
        <div class="metric-row"><span class="metric-name">Details remembered now</span><span class="metric-value">${c.recallDistinctContentWords}</span></div>
        <div class="metric-row"><span class="metric-name">Shared details</span><span class="metric-value">${c.overlapCount}</span></div>
      </div>
      <p class="muted space-above">This becomes part of your own recall trend over time. You can see it on the Trends page.</p>
    </div>
  `;
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}
