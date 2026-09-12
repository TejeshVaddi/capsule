// Renders and runs each activity. See activities.js for what the six kinds are.
//
// Built for someone who may find reading and choosing hard:
//  - Only today's two required activities show until both are done. The
//    extras appear after that, marked plainly as optional.
//  - One activity on screen at a time. Starting one hides the list.
//  - Every step opens with a guide box that says what to do and which
//    button to press.
//  - A timed step ends on its own. It never also has a stop or skip button,
//    so there is never a choice between waiting and pressing.

import { db, newId } from "../data.js?v=c8970c9f30";
import { suggestActivities, logActivityCompletion } from "../activities.js?v=c8970c9f30";
import { analyzeText } from "../analysis.js?v=c8970c9f30";
import { SpeechInput, speechSupported } from "../speech.js?v=c8970c9f30";
import { INTERFERENCE_TASKS, MUSIC_PROMPTS } from "../activities-content.js?v=c8970c9f30";
import { toast, escapeHtml, el, createSpeechComposer, photoUrl, guideHtml, noteAbove, clearNoteAbove } from "../ui.js?v=c8970c9f30";
import { getDailyPlan } from "../daily.js?v=c8970c9f30";
import { nextStepBlock } from "../next-step.js?v=c8970c9f30";
import { icon, ICONS } from "../icons.js?v=c8970c9f30";

export async function renderActivitiesView(root, { navigate } = {}) {
  root.innerHTML = "";

  const all = await db.allEntries();
  const journals = all.filter((e) => e.type === "journal");
  const latest = journals.length ? journals[journals.length - 1].metrics : null;
  const suggestions = (await suggestActivities(latest, all)).filter((s) => s.real);
  const required = suggestions.filter((s) => s.required);
  const extras = suggestions.filter((s) => !s.required);
  const next = required.find((s) => !s.doneToday);

  const page = el(`<div class="stack"></div>`);
  root.appendChild(page);
  // Through the app's own navigation when there is one, so the page comes
  // back whole (footer included) and opens at its top.
  const back = () => (navigate ? navigate("activities") : renderActivitiesView(root, { navigate }));
  const ctx = { back, navigate, required, run };

  if (next) {
    // Today's two, and nothing else to choose from.
    const doneCount = required.filter((s) => s.doneToday).length;
    page.appendChild(el(`
      <div class="glass-panel">
        <h2>Today's 2 activities</h2>
        ${guideHtml(doneCount === 0
          ? "Do these 2 activities. Start with number 1. Tap the Start button under it."
          : "Number 1 is done. Now do number 2. Tap the Start button under it.")}
      </div>`));
    required.forEach((s, i) => page.appendChild(requiredCard(s, i + 1, s === next, () => run(s))));
  } else {
    // Both done: say so first, then offer the extras as extras.
    page.appendChild(el(`
      <div class="glass-panel done-panel">
        <h2>${icon("check")} You're done for today</h2>
        ${guideHtml("You finished both of today's activities. You can stop here. The extra activities below are only if you want more.")}
        <ul class="done-list">
          ${required.map((s) => `<li>${icon("check")} ${escapeHtml(s.title)}</li>`).join("")}
        </ul>
      </div>`));

    if (navigate) {
      const plan = await getDailyPlan();
      if (plan.nextTask) {
        page.firstElementChild.appendChild(await nextStepBlock(navigate, "Both of today's activities are done."));
      }
    }

    const extrasPanel = el(`
      <div class="glass-panel">
        <div class="section-title">
          <h2>Extra activities</h2>
          <span class="pill pill-yellow">Optional</span>
        </div>
        <p class="muted">You do not have to do these. Only if you feel like it.</p>
        <div class="stack" data-slot="extras"></div>
      </div>`);
    const list = extrasPanel.querySelector('[data-slot="extras"]');
    extras.forEach((s) => list.appendChild(extraCard(s, () => run(s))));
    page.appendChild(extrasPanel);

    const history = el(`<div></div>`);
    page.appendChild(history);
    renderHistory(history);
  }

  function run(s) {
    page.innerHTML = "";
    const top = el(`<button class="btn-text back-link" type="button">Back to activities</button>`);
    top.addEventListener("click", back);
    ctx.topLink = top;
    const stage = el(`<div></div>`);
    page.append(top, stage);
    window.scrollTo(0, 0);
    startActivity(stage, s, ctx);
  }
}

function requiredCard(s, number, isNext, onStart) {
  const card = el(`
    <div class="glass-card activity-card${s.doneToday ? " activity-done" : ""}${isNext ? " activity-next" : ""}">
      <div class="activity-head">
        <span class="activity-number" aria-hidden="true">${s.doneToday ? icon("check") : number}</span>
        <strong class="lead">${escapeHtml(s.title)}</strong>
      </div>
      <span class="muted">${escapeHtml(s.why)}</span>
      ${s.doneToday
        ? `<span class="today-progress">Done</span>`
        : `<button class="btn card-action ${isNext ? "btn-primary" : "btn-secondary"}">Start</button>`}
    </div>`);
  const btn = card.querySelector("button");
  if (btn) btn.addEventListener("click", onStart);
  return card;
}

function extraCard(s, onStart) {
  const card = el(`
    <div class="glass-card activity-card${s.doneToday ? " activity-done" : ""}">
      <strong class="lead">${escapeHtml(s.title)}</strong>
      <span class="muted">${escapeHtml(s.why)}</span>
      <button class="btn btn-secondary card-action">${s.doneToday ? "Do it again" : "Start"}</button>
    </div>`);
  card.querySelector("button").addEventListener("click", onStart);
  return card;
}

function startActivity(stage, s, ctx) {
  if (s.kind === "naming") return namingGame(stage, s, ctx);
  if (s.kind === "fluency") return fluencyGame(stage, s, ctx);
  if (s.kind === "word-recall") return wordRecallGame(stage, s, ctx);
  if (s.kind === "description") return descriptionActivity(stage, s, ctx);
  if (s.kind === "photo-story") return photoStoryActivity(stage, s, ctx);
  if (s.kind === "music") return musicMomentsActivity(stage, s, ctx);
}

// The most recent completion being saved. Going back waits for it, so the
// list never reloads a moment too soon and shows a finished game as not done.
let saving = Promise.resolve();
function record(kind, detail) {
  saving = logActivityCompletion(kind, detail).catch((err) => console.error(err));
}

/**
 * The end of every activity: one button, to whatever comes next.
 *  - after the first of today's two: straight into the second
 *  - after the second: the next thing today (a memory visit, or Home)
 *  - after an extra: back to the activities
 */
async function showNext(container, suggestion, ctx) {
  const holder = el(`<div class="next-step space-above"></div>`);
  container.appendChild(holder);
  await saving;
  if (!holder.isConnected) return;
  suggestion.doneToday = true;
  // The small "Back to activities" link at the top would now sit alongside
  // the big button below: two ways out where one is enough.
  ctx.topLink?.remove();

  const button = (label, onClick) => {
    const b = el(`<button class="btn btn-primary btn-large" type="button">${escapeHtml(label)}</button>`);
    b.addEventListener("click", onClick);
    return b;
  };

  if (!suggestion.required || !ctx.navigate) {
    holder.appendChild(button("Back to activities", ctx.back));
    return;
  }
  const nextOne = ctx.required.find((r) => !r.doneToday);
  if (nextOne) {
    const number = ctx.required.indexOf(nextOne) + 1;
    holder.insertAdjacentHTML("beforeend",
      guideHtml(`That one is done. Now do activity ${number}: ${nextOne.title}. Tap the button below.`));
    holder.appendChild(button(`Start activity ${number}`, () => ctx.run(nextOne)));
    return;
  }
  holder.replaceWith(await nextStepBlock(ctx.navigate, "You finished both of today's activities."));
}

/* ---------- Shared: a small speech button that fills a text input ---------- */

function attachMicToInput(container, input, { onText } = {}) {
  if (!speechSupported) return null;
  const btn = el(`<button class="mic-inline" type="button" aria-label="Speak your answer">${ICONS.mic}</button>`);
  container.appendChild(btn);

  const speech = new SpeechInput({
    onFinal: (text) => {
      input.value = text.trim();
      if (onText) onText(input.value);
    },
    onStart: () => btn.classList.add("recording"),
    onEnd: () => btn.classList.remove("recording"),
    onError: () => {
      btn.classList.remove("recording");
      toast("Speech didn't work that time. You can type instead.");
    },
  });

  btn.addEventListener("click", () => {
    if (btn.classList.contains("recording")) speech.stop();
    else speech.start();
  });
  return speech;
}

/* ---------- Naming game ---------- */

function namingGame(stage, suggestion, ctx) {
  const items = [...suggestion.data.items].sort(() => Math.random() - 0.5);
  let index = 0;
  let gotten = 0;
  // Between an answer and the next clue, the buttons do nothing. A second tap
  // in that pause used to skip a clue.
  let waiting = false;

  const card = el(`
    <div class="glass-panel">
      <div class="section-title">
        <h3>Naming game: ${escapeHtml(suggestion.data.theme)}</h3>
        <span class="pill" data-slot="progress"></span>
      </div>
      ${guideHtml("Read the clue. Say or type the word it means. Then tap Check. If you are stuck, tap Show me.")}
      <p class="clue" data-slot="clue"></p>
      <div class="answer-row">
        <input type="text" data-slot="answer" placeholder="Say or type the word" autocomplete="off" />
      </div>
      <div class="button-row">
        <button class="btn btn-primary" data-slot="check">Check</button>
        <button class="btn btn-secondary" data-slot="reveal">Show me</button>
      </div>
      <p class="feedback" data-slot="feedback"></p>
    </div>
  `);
  stage.appendChild(card);

  const clue = card.querySelector('[data-slot="clue"]');
  const answer = card.querySelector('[data-slot="answer"]');
  const feedback = card.querySelector('[data-slot="feedback"]');
  const progress = card.querySelector('[data-slot="progress"]');
  const speech = attachMicToInput(card.querySelector(".answer-row"), answer, {
    onText: () => check(),
  });

  function show() {
    waiting = false;
    if (!card.isConnected) return;
    if (index >= items.length) {
      if (speech) speech.stop();
      card.innerHTML = `
        <h3>All done</h3>
        <p class="lead">You found ${gotten} of ${items.length} words without help.</p>`;
      showNext(card, suggestion, ctx);
      record("naming", {
        contentKey: suggestion.contentKey, theme: suggestion.data.theme,
        gotten, total: items.length,
      });
      return;
    }
    progress.textContent = `${index + 1} of ${items.length}`;
    clue.textContent = items[index].clue;
    answer.value = "";
    feedback.textContent = "";
    answer.focus();
  }

  function advance(found) {
    waiting = true;
    if (found) gotten++;
    index++;
    setTimeout(show, 1100);
  }

  function check() {
    if (waiting) return;
    const guess = answer.value.trim().toLowerCase();
    if (!guess) {
      feedback.textContent = "Say or type a word first, then tap Check.";
      feedback.style.color = "#8a4a2e";
      return;
    }
    const target = items[index].word.toLowerCase();
    if (guess === target || guess.includes(target) || target.includes(guess)) {
      feedback.textContent = "Yes, that's it.";
      feedback.style.color = "#2e6b3f";
      advance(true);
    } else {
      feedback.textContent = "Not quite. Try again, or tap Show me.";
      feedback.style.color = "#8a4a2e";
    }
  }

  card.querySelector('[data-slot="check"]').addEventListener("click", check);
  answer.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
  card.querySelector('[data-slot="reveal"]').addEventListener("click", () => {
    if (waiting) return;
    feedback.textContent = `The word was "${items[index].word}".`;
    feedback.style.color = "var(--purple)";
    advance(false);
  });

  show();
}

/* ---------- Category fluency ----------
   One minute, and the timer is the only way it ends. */

function fluencyGame(stage, suggestion, ctx) {
  const DURATION = 60;
  const category = suggestion.data.category.toLowerCase();
  let remaining = DURATION;
  let timer = null;
  const said = new Set();

  const card = el(`
    <div class="glass-panel">
      <h3>${escapeHtml(suggestion.data.prompt)}</h3>
      <div data-slot="pre">
        ${guideHtml(`You will have 1 minute. Name as many ${category} as you can. Tap Begin when you are ready.`)}
        <button class="btn btn-primary btn-large" data-slot="begin">Begin</button>
      </div>
      <div data-slot="live" hidden>
        ${guideHtml(`Say or type one of them, then tap Add. Keep going until the time runs out. It stops by itself.`)}
        <div class="fluency-timer" data-slot="timer" role="timer" aria-live="off">1:00</div>
        <div class="answer-row has-add">
          <input type="text" data-slot="entry" placeholder="Say or type one" autocomplete="off" />
          <button class="btn btn-primary add-btn" type="button" data-slot="add">Add</button>
        </div>
        <p class="sub-label" data-slot="count">You have named 0 so far.</p>
        <div class="fluency-list" data-slot="said"></div>
      </div>
      <div data-slot="result"></div>
    </div>
  `);
  stage.appendChild(card);

  const entry = card.querySelector('[data-slot="entry"]');
  const saidWrap = card.querySelector('[data-slot="said"]');
  const countEl = card.querySelector('[data-slot="count"]');
  const timerEl = card.querySelector('[data-slot="timer"]');

  function addWord(raw) {
    const word = (raw || "").trim().toLowerCase();
    if (word && !said.has(word)) {
      said.add(word);
      saidWrap.innerHTML = [...said]
        .map((w) => `<span class="pill pill-blue">${escapeHtml(w)}</span>`).join(" ");
      countEl.textContent = `You have named ${said.size} so far.`;
    }
    entry.value = "";
    entry.focus();
  }

  const speech = attachMicToInput(card.querySelector(".answer-row"), entry, { onText: (t) => addWord(t) });
  card.querySelector('[data-slot="add"]').addEventListener("click", () => addWord(entry.value));
  entry.addEventListener("keydown", (e) => { if (e.key === "Enter") addWord(entry.value); });

  function finish() {
    clearInterval(timer);
    if (speech) speech.stop();
    // Whatever is still in the box when time runs out counts too.
    if (entry.value.trim()) addWord(entry.value);
    card.querySelector('[data-slot="live"]').hidden = true;
    const result = card.querySelector('[data-slot="result"]');
    result.innerHTML = `
      <h3 class="space-above-sm">Time is up</h3>
      <p class="lead">You named ${said.size}.</p>
      ${said.size ? `<p>${[...said].map((w) => `<span class="pill">${escapeHtml(w)}</span>`).join(" ")}</p>` : ""}`;
    showNext(result, suggestion, ctx);
    record("fluency", {
      contentKey: suggestion.contentKey,
      category: suggestion.data.category,
      count: said.size,
    });
  }

  card.querySelector('[data-slot="begin"]').addEventListener("click", () => {
    card.querySelector('[data-slot="pre"]').hidden = true;
    card.querySelector('[data-slot="live"]').hidden = false;
    entry.focus();
    timer = setInterval(() => {
      // Left the page mid-game: stop quietly, and do not count it as done.
      if (!card.isConnected) { clearInterval(timer); if (speech) speech.stop(); return; }
      remaining--;
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, "0");
      timerEl.textContent = `${m}:${s}`;
      if (remaining <= 0) finish();
    }, 1000);
  });
}

/* ---------- Word recall, with a real delay ---------- */

function wordRecallGame(stage, suggestion, ctx) {
  const words = suggestion.data.words;
  const distractors = suggestion.data.distractors || [];
  const task = INTERFERENCE_TASKS[Math.floor(Math.random() * INTERFERENCE_TASKS.length)];
  let found = [];
  let missed = [];

  const card = el(`<div class="glass-panel"></div>`);
  stage.appendChild(card);

  /* Step 1: study the words */
  function study() {
    card.innerHTML = `
      <h3>Five-word memory game</h3>
      ${guideHtml("Read these 5 words. Try to remember them. When you are ready, tap I've read them.", "Step 1 of 3")}
      <div class="chip-row">
        ${words.map((w) => `<span class="pill pill-yellow word-chip">${escapeHtml(w)}</span>`).join("")}
      </div>
      <button class="btn btn-primary btn-large" data-slot="next">I've read them</button>
    `;
    card.querySelector('[data-slot="next"]').addEventListener("click", interference);
  }

  /* Step 2: a short filled pause, so the next step is remembering rather
     than repeating. It ends on its own; there is nothing to press. */
  function interference() {
    let left = task.seconds;
    card.innerHTML = `
      <h3>Five-word memory game</h3>
      ${guideHtml(`${task.instruction} The next step starts by itself.`, "Step 2 of 3")}
      <div class="fluency-timer" data-slot="count" role="timer">${left}</div>
    `;
    const countEl = card.querySelector('[data-slot="count"]');
    const tick = setInterval(() => {
      if (!card.isConnected) { clearInterval(tick); return; }
      left--;
      countEl.textContent = left;
      if (left <= 0) { clearInterval(tick); recall(); }
    }, 1000);
  }

  /* Step 3: free recall */
  function recall() {
    card.innerHTML = `
      <h3>Five-word memory game</h3>
      ${guideHtml("Say or type the words you remember. Any order is fine. Then tap See how I did.", "Step 3 of 3")}
      <div class="answer-row">
        <input type="text" data-slot="answer" placeholder="Say or type the words" autocomplete="off" />
      </div>
      <button class="btn btn-primary btn-large space-above" data-slot="check">See how I did</button>
    `;
    const input = card.querySelector('[data-slot="answer"]');
    attachMicToInput(card.querySelector(".answer-row"), input);
    input.focus();

    card.querySelector('[data-slot="check"]').addEventListener("click", () => {
      const typed = (input.value.toLowerCase().match(/[a-z']+/g) || []);
      found = words.filter((w) => typed.includes(w));
      missed = words.filter((w) => !typed.includes(w));
      if (missed.length && distractors.length) recognition();
      else done();
    });
  }

  /* Last step: recognition for the ones that did not come back freely.
     Recognising a word you could not retrieve is an ordinary difference,
     which is why the wording below stays neutral about what it means. */
  function recognition() {
    const options = [...missed, ...distractors.slice(0, missed.length)].sort(() => Math.random() - 0.5);
    card.innerHTML = `
      <h3>Five-word memory game</h3>
      ${guideHtml(`You remembered ${found.length}. Now tap any words below that you think were on the list. Then tap I'm done.`, "Last step")}
      <div class="recognition-grid" data-slot="options">
        ${options.map((w) => `<button class="btn btn-secondary recognition-option" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`).join("")}
      </div>
      <button class="btn btn-primary btn-large space-above" data-slot="finish">I'm done</button>
    `;
    const picked = new Set();
    card.querySelectorAll(".recognition-option").forEach((b) => {
      b.addEventListener("click", () => {
        const w = b.dataset.word;
        if (picked.has(w)) { picked.delete(w); b.classList.remove("picked"); }
        else { picked.add(w); b.classList.add("picked"); }
      });
    });
    card.querySelector('[data-slot="finish"]').addEventListener("click", () => {
      done(missed.filter((w) => picked.has(w)));
    });
  }

  function done(recognised = []) {
    card.innerHTML = `
      <h3>All done</h3>
      <p class="lead result-line">You remembered ${found.length} of ${words.length} on your own${recognised.length ? `, and spotted ${recognised.length} more` : ""}.</p>
      <p>The 5 words were: ${words.map((w) => `<span class="pill">${escapeHtml(w)}</span>`).join(" ")}</p>
    `;
    showNext(card, suggestion, ctx);
    record("word-recall", {
      contentKey: suggestion.contentKey,
      found: found.length, recognised: recognised.length, total: words.length,
    });
  }

  study();
}

/* ---------- Talking activities: a prompt, and an answer ---------- */

function descriptionActivity(stage, suggestion, ctx) {
  const title = suggestion.data.kind === "procedural" ? "Step by step"
    : suggestion.data.kind === "reminiscence" ? "Looking back"
    : suggestion.data.kind === "open" ? "A question for you"
    : "Describe the scene";

  const card = el(`
    <div class="glass-panel">
      <h3>${title}</h3>
      ${guideHtml("Read the question. Tap the microphone and talk, or type your answer in the box. Then tap I'm finished.")}
      <p class="prompt">${escapeHtml(suggestion.data.prompt)}</p>
      <div data-slot="composer"></div>
      <button class="btn btn-primary btn-large" data-slot="done">I'm finished</button>
      <div data-slot="result"></div>
    </div>
  `);
  stage.appendChild(card);

  const composer = createSpeechComposer({
    placeholder: "Your answer",
    SpeechInputClass: SpeechInput,
    speechSupported,
  });
  card.querySelector('[data-slot="composer"]').appendChild(composer.root);

  // Held here, not read from the click event: after the await below the
  // event no longer points at the button, and reading it there threw, so
  // "I'm finished" did nothing at all.
  const doneBtn = card.querySelector('[data-slot="done"]');
  doneBtn.addEventListener("click", async () => {
    const text = composer.getText();
    if (!text) {
      noteAbove(doneBtn, "Say or type your answer first. Then tap I'm finished.");
      return;
    }
    clearNoteAbove(doneBtn);
    doneBtn.disabled = true;
    const m = analyzeText(text);

    // Compare only to their own previous answers, and only when there are
    // enough to say anything. No praise that the text has not earned.
    const past = (await db.allActivityLog().catch(() => []))
      .filter((r) => r.kind === "description" && typeof r.detail?.wordCount === "number")
      .slice(0, 5)
      .map((r) => r.detail.wordCount);
    let comparison = "";
    if (past.length >= 2) {
      const avg = past.reduce((a, b) => a + b, 0) / past.length;
      const diff = m.wordCount - avg;
      const pct = Math.abs(diff) / Math.max(avg, 1);
      comparison = pct < 0.2
        ? "That is about as long as your recent answers."
        : diff > 0
          ? "That is longer than your recent answers."
          : "That is shorter than your recent answers.";
    }

    doneBtn.remove();
    composer.destroy();
    const result = card.querySelector('[data-slot="result"]');
    result.innerHTML = `
      <h3 class="space-above">Saved</h3>
      <p class="lead">You used ${m.wordCount} words.</p>
      ${comparison ? `<p class="muted">${comparison}</p>` : ""}`;
    showNext(result, suggestion, ctx);
    record("description", {
      contentKey: suggestion.contentKey,
      prompt: suggestion.data.prompt,
      wordCount: m.wordCount,
    });
  });
}

/* ---------- Photo story ---------- */

function photoStoryActivity(stage, suggestion, ctx) {
  const { entry, prompt } = suggestion.data;
  const photo = entry.photos[0];
  const when = new Date(entry.date).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const card = el(`
    <div class="glass-panel">
      <h3>Photo story</h3>
      ${guideHtml("Look at the photo. Tap the microphone and say what you remember, or type it in the box. Then tap I'm finished.")}
      <p class="muted">From your journal, ${escapeHtml(when)}.</p>
      <img class="photo-large" src="${photoUrl(photo.blob)}" alt="A photo from your journal" />
      <p class="prompt space-above">${escapeHtml(prompt)}</p>
      <div data-slot="composer"></div>
      <button class="btn btn-primary btn-large" data-slot="done">I'm finished</button>
      <div data-slot="result"></div>
    </div>
  `);
  stage.appendChild(card);

  const composer = createSpeechComposer({
    placeholder: "What you remember about this picture",
    SpeechInputClass: SpeechInput,
    speechSupported,
  });
  card.querySelector('[data-slot="composer"]').appendChild(composer.root);

  const doneBtn = card.querySelector('[data-slot="done"]');
  doneBtn.addEventListener("click", () => {
    const text = composer.getText();
    if (!text) {
      noteAbove(doneBtn, "Say or type something about the photo first. Then tap I'm finished.");
      return;
    }
    const m = analyzeText(text);
    doneBtn.remove();
    composer.destroy();
    const result = card.querySelector('[data-slot="result"]');
    result.innerHTML = `
      <div class="compare-cols space-above">
        <div class="compare-col">
          <strong>What you wrote that day</strong>
          <p>${escapeHtml(entry.text)}</p>
        </div>
        <div class="compare-col">
          <strong>What you said just now</strong>
          <p>${escapeHtml(text)}</p>
        </div>
      </div>`;
    showNext(result, suggestion, ctx);
    record("photo-story", {
      contentKey: suggestion.contentKey,
      entryId: entry.id,
      wordCount: m.wordCount,
    });
  });
}

/* ---------- Music moments ---------- */

function musicMomentsActivity(stage, suggestion, ctx) {
  const era = suggestion.data;
  const prompt = MUSIC_PROMPTS[Math.floor(Math.random() * MUSIC_PROMPTS.length)];
  let chosenCue = null;

  const card = el(`<div class="glass-panel"></div>`);
  stage.appendChild(card);

  /* Step 1: pick a cue that means something to them */
  function choose() {
    card.innerHTML = `
      <h3>Music moments: ${escapeHtml(era.era)}</h3>
      ${guideHtml("Tap one song or place that you remember. If none feel familiar, tap any one.", "Step 1 of 2")}
      <p class="muted">Capsule does not play the music.</p>
      <p class="sub-label">Songs</p>
      <div class="cue-grid">
        ${era.songs.map((s) => `
          <button class="cue-card" data-cue="${escapeHtml(s.title)} by ${escapeHtml(s.artist)}">
            <strong>${escapeHtml(s.title)}</strong>
            <span class="muted">${escapeHtml(s.artist)}</span>
          </button>`).join("")}
      </div>
      <p class="sub-label">Places and moments</p>
      <div class="cue-grid">
        ${era.scenes.map((s) => `
          <button class="cue-card" data-cue="${escapeHtml(s)}">
            <strong>${escapeHtml(s)}</strong>
          </button>`).join("")}
      </div>
    `;
    card.querySelectorAll(".cue-card").forEach((b) => {
      b.addEventListener("click", () => { chosenCue = b.dataset.cue; tell(); });
    });
  }

  /* Step 2: the reminiscence itself */
  function tell() {
    card.innerHTML = `
      <h3>${escapeHtml(chosenCue)}</h3>
      ${guideHtml("Tap the microphone and say what this reminds you of, or type it in the box. Then tap I'm finished.", "Step 2 of 2")}
      <p class="prompt">${escapeHtml(prompt)}</p>
      <div data-slot="composer"></div>
      <button class="btn btn-primary btn-large" data-slot="done">I'm finished</button>
      <button class="btn-text space-above-sm" data-slot="back">Choose a different one</button>
      <div data-slot="result"></div>
    `;
    const composer = createSpeechComposer({
      placeholder: "What it reminds you of",
      SpeechInputClass: SpeechInput,
      speechSupported,
    });
    card.querySelector('[data-slot="composer"]').appendChild(composer.root);
    card.querySelector('[data-slot="back"]').addEventListener("click", () => {
      composer.destroy();
      choose();
    });

    const doneBtn = card.querySelector('[data-slot="done"]');
    doneBtn.addEventListener("click", () => {
      const text = composer.getText();
      if (!text) {
        noteAbove(doneBtn, "Say or type what it reminds you of first. Then tap I'm finished.");
        return;
      }
      const m = analyzeText(text);
      doneBtn.remove();
      card.querySelector('[data-slot="back"]').remove();
      composer.destroy();
      record("music", {
        contentKey: suggestion.contentKey, era: era.era, cue: chosenCue, wordCount: m.wordCount,
      });

      const result = card.querySelector('[data-slot="result"]');
      result.innerHTML = `
        <h3 class="space-above">Saved</h3>
        <p class="muted">If you like, you can also keep this in your journal.</p>
        <button class="btn btn-secondary" data-slot="save">Add it to my journal</button>`;
      showNext(result, suggestion, ctx);

      const btn = result.querySelector('[data-slot="save"]');
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try {
          await db.putEntry({
            id: newId(),
            type: "journal",
            date: new Date().toISOString(),
            text: `${chosenCue}: ${text}`,
            metrics: m,
            photoIds: [],
          });
          btn.innerHTML = `${icon("check")} Added to your journal`;
        } catch (err) {
          console.error(err);
          btn.disabled = false;
          toast("Couldn't save that. You can try again.");
        }
      });
    });
  }

  choose();
}

/* ---------- Gentle history ---------- */

async function renderHistory(mount) {
  let log = [];
  try {
    log = await db.allActivityLog();
  } catch {
    return;
  }
  if (!log.length) return;

  const LABELS = {
    naming: "Naming game",
    fluency: "How many can you name",
    "word-recall": "Five-word memory game",
    description: "A question or description",
    "photo-story": "Photo story",
    music: "Music moments",
  };

  const recent = log.slice(0, 8);
  mount.appendChild(el(`
    <div class="glass-card">
      <h3>What you've done</h3>
      <p class="muted">${log.length} activit${log.length === 1 ? "y" : "ies"} so far.</p>
      <ul class="activity-log-list">
        ${recent.map((r) => `
          <li>
            <span>${escapeHtml(LABELS[r.kind] || r.kind)}</span>
            <span class="muted">${new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
          </li>`).join("")}
      </ul>
    </div>
  `));
}
