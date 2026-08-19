import { db } from "../data.js";
import { suggestActivities, logActivityCompletion } from "../activities.js";
import { analyzeText } from "../analysis.js";
import { SpeechInput, speechSupported } from "../speech.js";
import { toast, escapeHtml, el, createSpeechComposer } from "../ui.js";

export async function renderActivitiesView(root) {
  root.innerHTML = "";

  const all = await db.allEntries();
  const journals = all.filter((e) => e.type === "journal");
  const latest = journals.length ? journals[journals.length - 1].metrics : null;
  const suggestions = suggestActivities(latest, all);

  const panel = el(`
    <div class="stack">
      <div class="glass-panel">
        <h2>Activities</h2>
        <p class="muted">Gentle ways to spend time with words and memories.</p>
      </div>
      <div class="stack" data-slot="list"></div>
      <div data-slot="stage"></div>
    </div>
  `);
  root.appendChild(panel);

  const list = panel.querySelector('[data-slot="list"]');
  const stage = panel.querySelector('[data-slot="stage"]');

  for (const s of suggestions) {
    const card = el(`
      <div class="glass-card activity-card">
        <span class="pill ${s.tailored ? "pill-yellow" : s.real ? "pill-blue" : ""} activity-tag">${escapeHtml(s.tag)}</span>
        <strong style="font-size:1.15rem;">${escapeHtml(s.title)}</strong>
        <span class="muted">${escapeHtml(s.why)}</span>
        ${s.real ? `<button class="btn btn-accent" style="align-self:flex-start;">Start</button>` : ``}
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
}

function startActivity(stage, suggestion) {
  if (suggestion.kind === "naming") return namingGame(stage, suggestion);
  if (suggestion.kind === "word-recall") return wordRecallGame(stage, suggestion);
  if (suggestion.kind === "description") return descriptionActivity(stage, suggestion);
}

/* ---------- Naming game ---------- */

const NAMING_CLUES = {
  kettle: "You boil water in it for tea.",
  spoon: "You stir your tea with it.",
  oven: "You bake bread or roast dinner in it.",
  plate: "You serve food on it.",
  cup: "You drink tea or coffee from it.",
  pan: "You fry eggs in it.",
  rose: "A classic red flower with thorns.",
  shovel: "You dig holes in the garden with it.",
  soil: "Plants grow in this dark, crumbly stuff.",
  seed: "You plant this tiny thing and it grows.",
  leaf: "It's green and grows on branches.",
  fence: "It marks the edge of a garden or yard.",
  rain: "Water falling from the sky.",
  cloud: "White or gray, floating in the sky.",
  wind: "You can't see it, but it moves the trees.",
  snow: "Cold, white, and falls in winter.",
  sunshine: "Warm light on a clear day.",
  storm: "Thunder, lightning, and heavy rain together.",
  birthday: "A yearly celebration with cake and candles.",
  wedding: "Two people getting married.",
  picnic: "Eating a packed meal outdoors on a blanket.",
  holiday: "Time away from routine, often traveling.",
  dinner: "The main evening meal.",
  visit: "When someone comes to see you.",
  library: "A quiet building full of books to borrow.",
  market: "Stalls selling fruit, vegetables, and goods.",
  church: "A building with a steeple where people worship.",
  park: "Green public space with benches and paths.",
  bakery: "The shop that sells fresh bread and cakes.",
  station: "Where you catch a train.",
};

function namingGame(stage, suggestion) {
  const items = [...suggestion.data.items].sort(() => Math.random() - 0.5);
  let index = 0;
  let gotten = 0;

  stage.innerHTML = "";
  const card = el(`
    <div class="glass-panel">
      <div class="section-title">
        <h3>Naming game: ${escapeHtml(suggestion.data.theme)}</h3>
        <span class="pill" data-slot="progress"></span>
      </div>
      <p style="font-size:1.25rem; font-weight:600;" data-slot="clue"></p>
      <input type="text" data-slot="answer" placeholder="Type the word..." autocomplete="off" />
      <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
        <button class="btn btn-primary" data-slot="check">Check</button>
        <button class="btn btn-secondary" data-slot="reveal">Show me</button>
      </div>
      <p data-slot="feedback" style="min-height:1.5em; font-weight:600;"></p>
    </div>
  `);
  stage.appendChild(card);

  const clue = card.querySelector('[data-slot="clue"]');
  const answer = card.querySelector('[data-slot="answer"]');
  const feedback = card.querySelector('[data-slot="feedback"]');
  const progress = card.querySelector('[data-slot="progress"]');

  function show() {
    if (index >= items.length) {
      card.innerHTML = `
        <h3>Lovely work</h3>
        <p style="font-size:1.15rem;">You found ${gotten} of ${items.length} words. Thanks for playing. Every bit of word-reaching counts.</p>
      `;
      logActivityCompletion("naming", { theme: suggestion.data.theme, gotten, total: items.length });
      return;
    }
    progress.textContent = `${index + 1} of ${items.length}`;
    clue.textContent = NAMING_CLUES[items[index]] || `Something to do with ${suggestion.data.theme.toLowerCase()}.`;
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
    if (guess === items[index] || guess.includes(items[index])) {
      feedback.textContent = "Yes! That's it.";
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
    feedback.textContent = `It was "${items[index]}".`;
    feedback.style.color = "var(--purple)";
    advance(false);
  });

  show();
}

/* ---------- Word recall game ---------- */

function wordRecallGame(stage, suggestion) {
  const words = suggestion.data.words;
  stage.innerHTML = "";

  const card = el(`
    <div class="glass-panel">
      <h3>Five-word memory game</h3>
      <p class="muted">Read these five words slowly. When you're ready, hide them and see how many come back.</p>
      <div data-slot="words" style="display:flex; gap:12px; flex-wrap:wrap; margin:16px 0;">
        ${words.map((w) => `<span class="pill pill-yellow" style="font-size:1.15rem; padding:10px 20px;">${escapeHtml(w)}</span>`).join("")}
      </div>
      <button class="btn btn-primary" data-slot="hide">I've read them. Hide the words</button>
      <div data-slot="recall-area" hidden>
        <p style="font-weight:600; margin-top:16px;">Type every word you can remember, separated by spaces or commas:</p>
        <input type="text" data-slot="answer" placeholder="e.g. apple, river..." autocomplete="off" />
        <button class="btn btn-primary" style="margin-top:12px;" data-slot="check">See how I did</button>
      </div>
      <div data-slot="result"></div>
    </div>
  `);
  stage.appendChild(card);

  card.querySelector('[data-slot="hide"]').addEventListener("click", () => {
    card.querySelector('[data-slot="words"]').style.visibility = "hidden";
    card.querySelector('[data-slot="hide"]').hidden = true;
    card.querySelector('[data-slot="recall-area"]').hidden = false;
    card.querySelector('[data-slot="answer"]').focus();
  });

  card.querySelector('[data-slot="check"]').addEventListener("click", () => {
    const typed = (card.querySelector('[data-slot="answer"]').value.toLowerCase().match(/[a-z']+/g) || []);
    const found = words.filter((w) => typed.includes(w));
    const missed = words.filter((w) => !typed.includes(w));
    card.querySelector('[data-slot="result"]').innerHTML = `
      <p style="font-size:1.15rem; font-weight:600; margin-top:16px;">You remembered ${found.length} of ${words.length}.</p>
      ${found.length ? `<p>Came back to you: ${found.map((w) => `<span class="pill pill-blue">${escapeHtml(w)}</span>`).join(" ")}</p>` : ""}
      ${missed.length ? `<p>The others were: ${missed.map((w) => `<span class="pill">${escapeHtml(w)}</span>`).join(" ")}</p>` : ""}
      <p class="muted">However many came back, taking the time is what matters.</p>
    `;
    card.querySelector('[data-slot="check"]').disabled = true;
    logActivityCompletion("word-recall", { found: found.length, total: words.length });
  });
}

/* ---------- Description prompt ---------- */

function descriptionActivity(stage, suggestion) {
  stage.innerHTML = "";
  const card = el(`
    <div class="glass-panel">
      <h3>Description prompt</h3>
      <p style="font-size:1.2rem; font-weight:600; color: var(--purple);">${escapeHtml(suggestion.data.prompt)}</p>
      <div data-slot="composer"></div>
      <button class="btn btn-primary btn-large" data-slot="done">I'm finished</button>
      <div data-slot="result"></div>
    </div>
  `);
  stage.appendChild(card);

  const composer = createSpeechComposer({
    placeholder: "Take your time: colors, sounds, smells, people, feelings...",
    SpeechInputClass: SpeechInput,
    speechSupported,
  });
  card.querySelector('[data-slot="composer"]').appendChild(composer.root);

  card.querySelector('[data-slot="done"]').addEventListener("click", () => {
    const text = composer.getText();
    if (!text) {
      toast("Say or type your description first.");
      return;
    }
    const m = analyzeText(text);
    card.querySelector('[data-slot="result"]').innerHTML = `
      <div style="margin-top:16px;">
        <div class="metric-row"><span class="metric-name">Words in your description</span><span class="metric-value">${m.wordCount}</span></div>
        <div class="metric-row"><span class="metric-name">Different words used</span><span class="metric-value">${m.uniqueWords}</span></div>
        <div class="metric-row"><span class="metric-name">Naming words</span><span class="metric-value">${m.nounCount}</span></div>
      </div>
      <p class="muted">A rich description! Thanks for taking the time.</p>
    `;
    card.querySelector('[data-slot="done"]').disabled = true;
    composer.destroy();
    logActivityCompletion("description", { prompt: suggestion.data.prompt, wordCount: m.wordCount });
  });
}
