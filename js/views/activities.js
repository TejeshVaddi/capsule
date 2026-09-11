// Renders and runs each activity. See activities.js for what the six kinds are.

import { db, newId } from "../data.js";
import { suggestActivities, logActivityCompletion } from "../activities.js";
import { analyzeText } from "../analysis.js";
import { SpeechInput, speechSupported } from "../speech.js";
import { INTERFERENCE_TASKS, MUSIC_PROMPTS } from "../activities-content.js";
import { toast, escapeHtml, el, createSpeechComposer, photoUrl } from "../ui.js";
import { icon, ICONS } from "../icons.js";

export async function renderActivitiesView(root) {
  root.innerHTML = "";

  const all = await db.allEntries();
  const journals = all.filter((e) => e.type === "journal");
  const latest = journals.length ? journals[journals.length - 1].metrics : null;
  const suggestions = await suggestActivities(latest, all);

  const panel = el(`
    <div class="stack">
      <div class="glass-panel">
        <h2>Activities</h2>
        <p class="muted">Two to try today, and more below if you feel like it. Most take a few minutes.</p>
      </div>
      <div class="stack" data-slot="list"></div>
      <div data-slot="stage"></div>
      <div data-slot="history"></div>
    </div>
  `);
  root.appendChild(panel);

  const list = panel.querySelector('[data-slot="list"]');
  const stage = panel.querySelector('[data-slot="stage"]');

  for (const s of suggestions) {
    const card = el(`
      <div class="glass-card activity-card${s.doneToday ? " activity-done" : ""}">
        <span class="pill ${s.doneToday ? "" : s.tailored ? "pill-yellow" : s.real ? "pill-blue" : ""} activity-tag">
          ${s.doneToday ? "Done today" : escapeHtml(s.tag)}
        </span>
        <strong class="lead">${escapeHtml(s.title)}</strong>
        ${s.because && !s.doneToday ? `<span class="activity-because">${escapeHtml(s.because)}</span>` : ""}
        <span class="muted">${escapeHtml(s.why)}</span>
        ${s.real ? `<button class="btn card-action ${s.doneToday ? "btn-secondary" : "btn-accent"}">${s.doneToday ? "Do it again" : "Start"}</button>` : ``}
      </div>
    `);
    if (s.real) {
      card.querySelector("button").addEventListener("click", () => {
        startActivity(stage, s);
        stage.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    list.appendChild(card);
  }

  renderHistory(panel.querySelector('[data-slot="history"]'));
}

function startActivity(stage, s) {
  if (s.kind === "naming") return namingGame(stage, s);
  if (s.kind === "fluency") return fluencyGame(stage, s);
  if (s.kind === "word-recall") return wordRecallGame(stage, s);
  if (s.kind === "description") return descriptionActivity(stage, s);
  if (s.kind === "photo-story") return photoStoryActivity(stage, s);
  if (s.kind === "music") return musicMomentsActivity(stage, s);
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

function namingGame(stage, suggestion) {
  const items = [...suggestion.data.items].sort(() => Math.random() - 0.5);
  let index = 0;
  let gotten = 0;
  let activeSpeech = null;

  stage.innerHTML = "";
  const card = el(`
    <div class="glass-panel">
      <div class="section-title">
        <h3>Naming game: ${escapeHtml(suggestion.data.theme)}</h3>
        <span class="pill" data-slot="progress"></span>
      </div>
      <p class="clue" data-slot="clue"></p>
      <div class="answer-row">
        <input type="text" data-slot="answer" placeholder="Say or type the word..." autocomplete="off" />
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
  const row = card.querySelector(".answer-row");

  activeSpeech = attachMicToInput(row, answer, {
    onText: () => card.querySelector('[data-slot="check"]').click(),
  });

  function show() {
    if (index >= items.length) {
      if (activeSpeech) activeSpeech.stop();
      card.innerHTML = `
        <h3>Set finished</h3>
        <p class="lead">You found ${gotten} of ${items.length} without help.</p>
        `;
      logActivityCompletion("naming", {
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
    if (found) gotten++;
    index++;
    setTimeout(show, 1100);
  }

  card.querySelector('[data-slot="check"]').addEventListener("click", () => {
    const guess = answer.value.trim().toLowerCase();
    if (!guess) return;
    const target = items[index].word.toLowerCase();
    if (guess === target || guess.includes(target) || target.includes(guess)) {
      feedback.textContent = "Yes, that's it.";
      feedback.style.color = "#2e6b3f";
      advance(true);
    } else {
      feedback.textContent = "Not quite. Have another go, or tap Show me.";
      feedback.style.color = "#8a4a2e";
    }
  });
  answer.addEventListener("keydown", (e) => {
    if (e.key === "Enter") card.querySelector('[data-slot="check"]').click();
  });
  card.querySelector('[data-slot="reveal"]').addEventListener("click", () => {
    feedback.textContent = `It was "${items[index].word}".`;
    feedback.style.color = "var(--purple)";
    advance(false);
  });

  show();
}

/* ---------- Category fluency ---------- */

function fluencyGame(stage, suggestion) {
  const DURATION = 60;
  let remaining = DURATION;
  let timer = null;
  const said = new Set();

  stage.innerHTML = "";
  const card = el(`
    <div class="glass-panel">
      <h3>${escapeHtml(suggestion.data.prompt)}</h3>
      <p class="muted">You have a minute. Stop whenever you like.</p>
      <div data-slot="pre">
        <button class="btn btn-primary btn-large" data-slot="begin">Begin</button>
      </div>
      <div data-slot="live" hidden>
        <div class="fluency-timer" data-slot="timer">1:00</div>
        <div class="answer-row">
          <input type="text" data-slot="entry" placeholder="Say or type one, then add another..." autocomplete="off" />
        </div>
        <button class="btn btn-secondary space-above" data-slot="add">Add it</button>
        <button class="btn btn-secondary space-above" data-slot="stop">I'm finished</button>
        <div class="fluency-list" data-slot="said"></div>
      </div>
      <div data-slot="result"></div>
    </div>
  `);
  stage.appendChild(card);

  const entry = card.querySelector('[data-slot="entry"]');
  const saidWrap = card.querySelector('[data-slot="said"]');
  const timerEl = card.querySelector('[data-slot="timer"]');

  function addWord(raw) {
    const word = (raw || "").trim().toLowerCase();
    if (!word) return;
    if (!said.has(word)) {
      said.add(word);
      saidWrap.innerHTML = [...said]
        .map((w) => `<span class="pill pill-blue">${escapeHtml(w)}</span>`).join(" ");
    }
    entry.value = "";
    entry.focus();
  }

  attachMicToInput(card.querySelector(".answer-row"), entry, { onText: (t) => addWord(t) });

  card.querySelector('[data-slot="add"]').addEventListener("click", () => addWord(entry.value));
  entry.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addWord(entry.value);
  });

  function finish() {
    clearInterval(timer);
    card.querySelector('[data-slot="live"]').hidden = true;
    card.querySelector('[data-slot="result"]').innerHTML = `
      <h3 class="space-above-sm">You named ${said.size}</h3>
      ${said.size ? `<p>${[...said].map((w) => `<span class="pill">${escapeHtml(w)}</span>`).join(" ")}</p>` : ""}
    `;
    logActivityCompletion("fluency", {
      contentKey: suggestion.contentKey,
      category: suggestion.data.category,
      count: said.size,
    });
  }

  card.querySelector('[data-slot="stop"]').addEventListener("click", finish);
  card.querySelector('[data-slot="begin"]').addEventListener("click", () => {
    card.querySelector('[data-slot="pre"]').hidden = true;
    card.querySelector('[data-slot="live"]').hidden = false;
    entry.focus();
    timer = setInterval(() => {
      remaining--;
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, "0");
      timerEl.textContent = `${m}:${s}`;
      if (remaining <= 0) finish();
    }, 1000);
  });
}

/* ---------- Word recall, with a real delay ---------- */

function wordRecallGame(stage, suggestion) {
  const words = suggestion.data.words;
  const distractors = suggestion.data.distractors || [];
  const task = INTERFERENCE_TASKS[Math.floor(Math.random() * INTERFERENCE_TASKS.length)];
  let found = [];
  let missed = [];

  stage.innerHTML = "";
  const card = el(`<div class="glass-panel"></div>`);
  stage.appendChild(card);

  /* Step 1: study the words */
  function study() {
    card.innerHTML = `
      <h3>Five-word memory game</h3>
      <p class="muted">Read these five words slowly, once or twice.</p>
      <div class="chip-row">
        ${words.map((w) => `<span class="pill pill-yellow word-chip">${escapeHtml(w)}</span>`).join("")}
      </div>
      <button class="btn btn-primary btn-large" data-slot="next">I've read them</button>
    `;
    card.querySelector('[data-slot="next"]').addEventListener("click", interference);
  }

  /* Step 2: a short filled delay, so this measures recall and not echo */
  function interference() {
    let left = task.seconds;
    card.innerHTML = `
      <h3>Just a moment first</h3>
      <p class="instruction">${escapeHtml(task.instruction)}</p>
      <p class="muted">This short gap is what makes the next part about remembering rather than repeating.</p>
      <div class="fluency-timer" data-slot="count">${left}</div>
      <button class="btn btn-secondary" data-slot="skip">Skip ahead</button>
    `;
    const countEl = card.querySelector('[data-slot="count"]');
    const tick = setInterval(() => {
      left--;
      countEl.textContent = left;
      if (left <= 0) { clearInterval(tick); recall(); }
    }, 1000);
    card.querySelector('[data-slot="skip"]').addEventListener("click", () => {
      clearInterval(tick);
      recall();
    });
  }

  /* Step 3: free recall */
  function recall() {
    card.innerHTML = `
      <h3>Now, what comes back?</h3>
      <p class="muted">Type or say every word you can remember. Any order is fine.</p>
      <div class="answer-row">
        <input type="text" data-slot="answer" placeholder="e.g. apple, river..." autocomplete="off" />
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

  /* Step 4: recognition for the ones that did not come back freely.
     Recognising a word you could not retrieve is an ordinary difference,
     which is why the wording below stays neutral about what it means. */
  function recognition() {
    const options = [...missed, ...distractors.slice(0, missed.length)].sort(() => Math.random() - 0.5);
    card.innerHTML = `
      <h3>One more look</h3>
      <p class="muted">You recalled ${found.length} on your own. Some words are easier to spot than to summon, so tap any of these you think were on the list.</p>
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
      const recognised = missed.filter((w) => picked.has(w));
      done(recognised);
    });
  }

  function done(recognised = []) {
    card.innerHTML = `
      <h3>How you did</h3>
      <p class="lead result-line">You recalled ${found.length} of ${words.length} on your own${recognised.length ? `, and recognised ${recognised.length} more` : ""}.</p>
      ${found.length ? `<p>Came back to you: ${found.map((w) => `<span class="pill pill-blue">${escapeHtml(w)}</span>`).join(" ")}</p>` : ""}
      ${missed.length ? `<p>The full list was: ${words.map((w) => `<span class="pill">${escapeHtml(w)}</span>`).join(" ")}</p>` : ""}
    `;
    logActivityCompletion("word-recall", {
      contentKey: suggestion.contentKey,
      found: found.length, recognised: recognised.length, total: words.length,
    });
  }

  study();
}

/* ---------- Description prompt ---------- */

function descriptionActivity(stage, suggestion) {
  stage.innerHTML = "";
  const card = el(`
    <div class="glass-panel">
      <h3>${suggestion.data.kind === "procedural" ? "Step by step" : suggestion.data.kind === "reminiscence" ? "Looking back" : "Describe the scene"}</h3>
      <p class="prompt">${escapeHtml(suggestion.data.prompt)}</p>
      <div data-slot="composer"></div>
      <button class="btn btn-primary btn-large" data-slot="done">I'm finished</button>
      <div data-slot="result"></div>
    </div>
  `);
  stage.appendChild(card);

  const composer = createSpeechComposer({
    placeholder: "Take your time: colours, sounds, smells, people, feelings...",
    SpeechInputClass: SpeechInput,
    speechSupported,
  });
  card.querySelector('[data-slot="composer"]').appendChild(composer.root);

  card.querySelector('[data-slot="done"]').addEventListener("click", async () => {
    const text = composer.getText();
    if (!text) {
      toast("Say or type your description first.");
      return;
    }
    const m = analyzeText(text);

    // Compare only to their own previous descriptions, and only when there
    // are enough to say anything. No praise that the text has not earned.
    const past = (await db.allActivityLog())
      .filter((r) => r.kind === "description" && typeof r.detail?.wordCount === "number")
      .slice(0, 5)
      .map((r) => r.detail.wordCount);
    let comparison = "";
    if (past.length >= 2) {
      const avg = past.reduce((a, b) => a + b, 0) / past.length;
      const diff = m.wordCount - avg;
      const pct = Math.abs(diff) / Math.max(avg, 1);
      comparison = pct < 0.2
        ? "That is about the same length as your recent descriptions."
        : diff > 0
          ? "That is longer than your recent descriptions."
          : "That is shorter than your recent descriptions.";
    }

    card.querySelector('[data-slot="result"]').innerHTML = `
      <div class="space-above">
        <div class="metric-row"><span class="metric-name">Words in your description</span><span class="metric-value">${m.wordCount}</span></div>
        <div class="metric-row"><span class="metric-name">Different words used</span><span class="metric-value">${m.uniqueWords}</span></div>
        <div class="metric-row"><span class="metric-name">Naming words</span><span class="metric-value">${m.nounCount}</span></div>
      </div>
      ${comparison ? `<p class="muted">${comparison}</p>` : ""}
      <p class="muted">Saved.</p>
    `;
    card.querySelector('[data-slot="done"]').disabled = true;
    composer.destroy();
    logActivityCompletion("description", {
      contentKey: suggestion.contentKey,
      prompt: suggestion.data.prompt,
      wordCount: m.wordCount,
    });
  });
}

/* ---------- Photo story ---------- */

function photoStoryActivity(stage, suggestion) {
  const { entry, prompt } = suggestion.data;
  const photo = entry.photos[0];
  const when = new Date(entry.date).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  stage.innerHTML = "";
  const card = el(`
    <div class="glass-panel">
      <h3>Photo story</h3>
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
    placeholder: "Whatever comes back to you about this picture...",
    SpeechInputClass: SpeechInput,
    speechSupported,
  });
  card.querySelector('[data-slot="composer"]').appendChild(composer.root);

  card.querySelector('[data-slot="done"]').addEventListener("click", () => {
    const text = composer.getText();
    if (!text) {
      toast("Say or type something about the photo first.");
      return;
    }
    const m = analyzeText(text);
    card.querySelector('[data-slot="result"]').innerHTML = `
      <div class="compare-cols space-above">
        <div class="compare-col">
          <strong>What you wrote that day</strong>
          <p>${escapeHtml(entry.text)}</p>
        </div>
        <div class="compare-col">
          <strong>What you said just now</strong>
          <p>${escapeHtml(text)}</p>
        </div>
      </div>
      <p class="muted">Two tellings of the same day, side by side.</p>
    `;
    card.querySelector('[data-slot="done"]').disabled = true;
    composer.destroy();
    logActivityCompletion("photo-story", {
      contentKey: suggestion.contentKey,
      entryId: entry.id,
      wordCount: m.wordCount,
    });
  });
}

/* ---------- Music moments ---------- */

function musicMomentsActivity(stage, suggestion) {
  const era = suggestion.data;
  const prompt = MUSIC_PROMPTS[Math.floor(Math.random() * MUSIC_PROMPTS.length)];
  let chosenCue = null;

  stage.innerHTML = "";
  const card = el(`<div class="glass-panel"></div>`);
  stage.appendChild(card);

  /* Step 1: pick a cue that means something to them */
  function choose() {
    card.innerHTML = `
      <h3>Music moments: ${escapeHtml(era.era)}</h3>
      <p class="muted">Capsule does not play the music. Pick anything below that stirs something, and tell the story it brings back.</p>
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
      <p class="muted space-above">None of these? Tap any one anyway and talk about whatever it reminds you of instead.</p>
    `;
    card.querySelectorAll(".cue-card").forEach((b) => {
      b.addEventListener("click", () => { chosenCue = b.dataset.cue; tell(); });
    });
  }

  /* Step 2: the reminiscence itself */
  function tell() {
    card.innerHTML = `
      <h3>${escapeHtml(chosenCue)}</h3>
      <p class="prompt">${escapeHtml(prompt)}</p>
      <div data-slot="composer"></div>
      <button class="btn btn-primary btn-large" data-slot="done">I'm finished</button>
      <button class="btn btn-secondary space-above-sm" data-slot="back">Pick something else</button>
      <div data-slot="result"></div>
    `;
    const composer = createSpeechComposer({
      placeholder: "Whatever it brings back, even just a face or a room...",
      SpeechInputClass: SpeechInput,
      speechSupported,
    });
    card.querySelector('[data-slot="composer"]').appendChild(composer.root);
    card.querySelector('[data-slot="back"]').addEventListener("click", () => {
      composer.destroy();
      choose();
    });

    card.querySelector('[data-slot="done"]').addEventListener("click", () => {
      const text = composer.getText();
      if (!text) {
        toast("Say or type what it brings back first.");
        return;
      }
      const m = analyzeText(text);
      card.querySelector('[data-slot="result"]').innerHTML = `
        <div class="space-above">
          <div class="metric-row"><span class="metric-name">Words in your memory</span><span class="metric-value">${m.wordCount}</span></div>
          <div class="metric-row"><span class="metric-name">Different words used</span><span class="metric-value">${m.uniqueWords}</span></div>
        </div>
        <p class="muted">You can save this into your journal.</p>
        <button class="btn btn-accent" data-slot="save">Save this to my journal</button>
      `;
      card.querySelector('[data-slot="done"]').disabled = true;
      composer.destroy();
      logActivityCompletion("music", {
        contentKey: suggestion.contentKey, era: era.era, cue: chosenCue, wordCount: m.wordCount,
      });

      card.querySelector('[data-slot="save"]').addEventListener("click", async (e) => {
        const btn = e.currentTarget;
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
          btn.innerHTML = `${icon("check")} Saved to your journal`;
          toast("Saved to your journal.");
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
    description: "Description prompt",
    "photo-story": "Photo story",
    music: "Music moments",
  };

  const recent = log.slice(0, 8);
  mount.appendChild(el(`
    <div class="glass-card space-above-sm">
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
