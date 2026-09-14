import { db, newId } from "../data.js?v=f5fa412c13";
import { icon } from "../icons.js?v=f5fa412c13";
import { compareRecallToOriginal, analyzeText } from "../analysis.js?v=f5fa412c13";
import { SpeechInput, speechSupported } from "../speech.js?v=f5fa412c13";
import { pickEntryForRecall, formatFriendlyDate, daysBetween, recallHints, hintLevelFor } from "../recall.js?v=f5fa412c13";
import { toast, escapeHtml, el, createSpeechComposer, photoUrl, guideHtml, noteAbove, clearNoteAbove } from "../ui.js?v=f5fa412c13";
import { nextStepBlock } from "../next-step.js?v=f5fa412c13";

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
  // How much of the day to reveal follows the person's own recent visits.
  const everything = await db.allEntries();
  const level = hintLevelFor(everything);
  // The person's other days, so the notes pick what was unusual about this one.
  const otherDays = everything.filter((e) => e.type === "journal" && e.id !== target.id).map((e) => e.text);
  const { glimpses, hidden } = recallHints(target.text, level, otherDays);
  const notes = glimpses.length === 1 ? "the note" : `the ${glimpses.length} notes`;
  const guide = !glimpses.length
    ? "Think back to this day. Tap the microphone and say anything you remember, or type it in the box. Then tap I've said what I remember."
    : hidden
      ? `Read ${notes} below. In ${glimpses.length === 1 ? "it" : "each one"}, one detail is left out on purpose, marked someone, somewhere or something. Say or type what you think it was, and anything else you remember. Then tap I've said what I remember.`
      : `Read ${notes} below. ${glimpses.length === 1 ? "It is" : "They are"} from what you said that day. Then say or type what else you remember, and tap I've said what I remember.`;

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
        ${guideHtml(guide)}
        ${photos.length ? `<p class="recall-hint-label">${icon("camera")} A picture from that day, to help</p>` : ""}
        <div class="recall-hint-strip" data-slot="photos"></div>
        ${glimpses.length ? `
          <p class="recall-hint-label">${icon("book")} From your journal that day</p>
          <ul class="recall-cues">
            ${glimpses.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}
          </ul>` : ""}
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
      noteAbove(saveBtn, "Say or type what you remember first. Even a little is fine. Then tap I've said what I remember.");
      return;
    }
    clearNoteAbove(saveBtn);
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      // Saying a hint back is not remembering it, so the words shown are
      // not counted. A detail left out of a hint is not shown, so it counts.
      const hintWords = glimpses.length ? analyzeText(glimpses.join(" ")).distinctContentWords : [];
      const comparison = compareRecallToOriginal(text, target.text, hintWords);
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
          hintLevel: level,
          hints: glimpses,
          hintWords,
          hintCount: glimpses.length,
        },
      };
      await db.putEntry(entry);
      composer.destroy();
      await showComparison(panel.querySelector('[data-slot="results"]'), target, entry, navigate);
      saveBtn.remove();
    } catch (err) {
      console.error(err);
      toast("Something went wrong saving. Your words are still in the box.");
      saveBtn.disabled = false;
      saveBtn.textContent = "I've said what I remember";
    }
  });
}

async function showComparison(container, original, recallEntry, navigate) {
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
      ${c.hintCount ? `<p class="muted space-above">Words from the ${c.hintCount === 1 ? "hint" : "hints"} aren't counted here, only what you brought back yourself.</p>` : ""}
      <p class="muted space-above">This becomes part of your own recall trend over time. You can see it on the Trends page.</p>
    </div>
  `;
  container.firstElementChild.appendChild(await nextStepBlock(navigate, "Your memory visit is saved."));
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}
