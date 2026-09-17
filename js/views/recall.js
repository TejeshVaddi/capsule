import { db, newId } from "../data.js?v=2fb457af22";
import { icon } from "../icons.js?v=2fb457af22";
import { compareRecallToOriginal, analyzeText } from "../analysis.js?v=2fb457af22";
import { SpeechInput, speechSupported } from "../speech.js?v=2fb457af22";
import { pickEntryForRecall, formatFriendlyDate, daysBetween, recallHints, hintLevelFor, compareDetails, recalledInEntry, isDayEntry } from "../recall.js?v=2fb457af22";
import { toast, escapeHtml, el, createSpeechComposer, photoUrl, guideHtml, noteAbove, clearNoteAbove } from "../ui.js?v=2fb457af22";
import { nextStepBlock } from "../next-step.js?v=2fb457af22";

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
  const otherDays = everything.filter((e) => isDayEntry(e) && e.id !== target.id).map((e) => e.text);
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

const SHOWN_PER_GROUP = 8;

async function showComparison(container, original, recallEntry, navigate) {
  const c = recallEntry.recallComparison;
  const { shared, onlyThen, onlyNow } = compareDetails(original.text, recallEntry.text, c.hintWords || []);
  const total = shared.length + onlyThen.length + onlyNow.length;
  const byThemselves = shared.filter((d) => !d.fromNotes).length;

  // One bar, three colours: only that day, both, only today. Its widths show
  // the balance at a glance; the chips below say what the details were.
  const segment = (n, cls) => n ? `<span class="detail-bar-part ${cls}" style="flex-grow:${n}">${n}</span>` : "";
  const chips = (list, cls) => {
    const shown = list.slice(0, SHOWN_PER_GROUP);
    const more = list.length - shown.length;
    return `<div class="chip-row">${shown.map((d) => typeof d === "string"
      ? `<span class="detail-chip ${cls}">${escapeHtml(d)}</span>`
      : `<span class="detail-chip ${cls}${d.fromNotes ? " from-notes" : ""}">${escapeHtml(d.label)}</span>`).join("")}${
      more > 0 ? `<span class="detail-chip detail-more">and ${more} more</span>` : ""}</div>`;
  };
  const group = (title, list, cls, empty) => `
    <div class="detail-group">
      <h4><span class="detail-dot ${cls}" aria-hidden="true"></span>${title} <span class="detail-count">${list.length}</span></h4>
      ${list.length ? chips(list, cls) : `<p class="muted">${empty}</p>`}
    </div>`;

  container.innerHTML = `
    <div class="glass-card fade-in">
      <h3>Then and now</h3>
      ${guideHtml(byThemselves
        ? `You brought back ${byThemselves} ${byThemselves === 1 ? "detail" : "details"} from that day by yourself. ${byThemselves === 1 ? "It is" : "They are"} the solid blue ${byThemselves === 1 ? "one" : "ones"} below.`
        : "Here is what you said on the day, and what you said just now. Every visit counts, however much comes back.")}
      ${total ? `
        <div class="detail-bar" role="img" aria-label="${onlyThen.length} only then, ${shared.length} shared, ${onlyNow.length} only now">
          ${segment(onlyThen.length, "is-then")}${segment(shared.length, "is-shared")}${segment(onlyNow.length, "is-now")}
        </div>` : ""}
      ${group("Shared details", shared, "is-shared", "None of the same details came up this time.")}
      ${shared.some((d) => d.fromNotes) ? `<p class="muted detail-key"><span class="detail-chip is-shared from-notes" aria-hidden="true">outlined</span> Details with an outline were in the notes you read.</p>` : ""}
      ${group("Only mentioned then", onlyThen, "is-then", "You mentioned everything from that day.")}
      ${group("Only mentioned now", onlyNow, "is-now", "Nothing new this time.")}
      <h4 class="recalled-title">That day, with what you brought back in blue</h4>
      <p class="recalled-entry">${recalledInEntry(original.text, recallEntry.text)
        .map((part) => (part.recalled ? `<mark class="recalled">${escapeHtml(part.text)}</mark>` : escapeHtml(part.text)))
        .join("")}</p>
      <details class="explain">
        <summary>What you said just now</summary>
        <div class="explain-body">
          <p>${escapeHtml(recallEntry.text)}</p>
        </div>
      </details>
    </div>
  `;
  container.firstElementChild.appendChild(await nextStepBlock(navigate, "Your memory visit is saved."));
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}
