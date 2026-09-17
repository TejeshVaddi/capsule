import { db } from "./data.js?v=3193749e7d";
import { MUSIC_ERAS } from "./activities-content.js?v=3193749e7d";
import { summarizeDay, bulletCountFor } from "./summary.js?v=3193749e7d";
import {
  KIN, PLACE_WORDS, VAGUE, LEAD_IN, MOMENT_BREAK, TIME_WORDS, DANGLING, SOFTENERS, SIDE_CLAUSE,
  OPENERS, NEGATIVE, PIECE_BREAK, toSecondPerson, tidy, asNote, termsOf, subjectIfAlone,
  lastPersonIn, bare, stem, rarityAmong, weightOf,
} from "./text.js?v=3193749e7d";


const MIN_AGE_DAYS = 2; // an entry must be at least this old before it can be resurfaced

/**
 * Whether an entry is an account of a day, rather than an answer saved from
 * an activity.
 *
 * A memory visit asks "what do you remember about this day?". Pointing that
 * at "Billie Jean: we danced to it at the church hall" asks something else
 * entirely, and one that cannot really be answered: it was never a day, it
 * was a song, a film or a meal described on request. Those entries still
 * belong in the journal and in the export; they are simply not days to
 * revisit.
 *
 * Entries written before this was marked are recognised by their shape: an
 * activity answer opens with one of Capsule's own music cues followed by a
 * colon, and nothing else does.
 */
export function isDayEntry(entry) {
  if (!entry || entry.type !== "journal") return false;
  if (entry.source && entry.source !== "day") return false;
  return !looksLikeMusicAnswer(entry.text);
}

let musicCues = null;
function looksLikeMusicAnswer(text) {
  const head = String(text || "").split(":")[0].trim();
  if (!head || head.length > 60) return false;
  if (!musicCues) {
    musicCues = new Set();
    for (const era of MUSIC_ERAS) {
      for (const song of era.songs || []) musicCues.add(`${song.title} by ${song.artist}`.toLowerCase());
      for (const scene of era.scenes || []) musicCues.add(scene.toLowerCase());
    }
  }
  return musicCues.has(head.toLowerCase());
}

/**
 * Chooses an old journal entry to resurface for recall. Prefers the entry
 * least-recently (or never) recalled, weighted toward older memories.
 */
export async function pickEntryForRecall() {
  const all = await db.allEntries();
  const journals = all.filter(isDayEntry);
  const recalls = all.filter((e) => e.type === "recall");

  const now = Date.now();
  const eligible = journals.filter(
    (e) => now - new Date(e.date).getTime() >= MIN_AGE_DAYS * 24 * 60 * 60 * 1000
  );
  if (!eligible.length) return null;

  const lastRecalled = new Map();
  for (const r of recalls) {
    const prev = lastRecalled.get(r.recallOf);
    const t = new Date(r.date).getTime();
    if (!prev || t > prev) lastRecalled.set(r.recallOf, t);
  }

  eligible.sort((a, b) => {
    const aRecalled = lastRecalled.get(a.id) || 0;
    const bRecalled = lastRecalled.get(b.id) || 0;
    if (aRecalled !== bRecalled) return aRecalled - bRecalled; // never/least-recently recalled first
    return new Date(a.date) - new Date(b.date); // then oldest first
  });

  return eligible[0];
}

/* ---------- The bullets a memory visit opens with ----------
   A bare date is a hard place to start remembering from, so a visit opens
   with the day summarised as bullet points (see summary.js): one per thing
   that happened, each keeping who, what and where. A long day gets more
   bullets than a quiet one.

   How much they give away follows the person's own recent visits. At full
   help every bullet is whole; below that there are fewer of them, and each
   has one detail left out on purpose for the person to bring back. See
   hintLevelFor() and withDetailHidden(). */

const HIDE_PREPS = "(?:to|at|in|into|on|from|near|by|round|around|over|up|past)";
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Something real is still left to hold on to once a detail is hidden. */
function hasConcreteWord(note) {
  return termsOf(note).some((t) => {
    const w = bare(t.text);
    return t.tags.includes("Noun") && !t.tags.includes("Pronoun") &&
      !["someone", "somewhere", "something"].includes(w) && !VAGUE.has(w);
  });
}

/**
 * Leaves out one detail of a note, for the person to bring back: who, then
 * where, then what.
 *   "Went to church with Margaret"       -> "Went to church with someone"
 *   "Rang your sister Ann in Scotland"   -> "Rang your sister in Scotland"
 *   "Did a jigsaw puzzle of a lighthouse" -> "Did a jigsaw puzzle of something"
 * What is left must still hold something real to go on: "Did something" is
 * no help at all, so a note that would end up like that is not used.
 * Returns null when no detail can be left out that way.
 */
export function withDetailHidden(note) {
  const terms = termsOf(note);
  const options = [];

  // Who. "your sister Ann" keeps "your sister": the name is what is missing.
  const names = [];
  let run = [];
  const flushName = () => { if (run.length) names.push(run.join(" ")); run = []; };
  for (const t of terms) {
    const word = t.text.replace(/[.,!?;:]+$/, "");
    if (t.tags.includes("Person") && /^[A-Z]/.test(word) && !KIN.has(word.toLowerCase())) run.push(word);
    else flushName();
  }
  flushName();
  for (const name of names) {
    const n = esc(name);
    const kin = note.replace(new RegExp(`\\b(${[...KIN].join("|")})\\s+${n}\\b`, "i"), "$1");
    options.push(kin !== note ? kin : note.replace(new RegExp(`\\b${n}(?='s\\b)`), "someone").replace(new RegExp(`\\b${n}\\b`), "someone"));
  }

  // Where: a named place first ("Whitby"), then a kind of place.
  const places = terms.filter((t) => !t.tags.includes("Person") && /^[A-Z]/.test(t.text) &&
    (t.tags.includes("Place") || t.tags.includes("ProperNoun")) && terms.indexOf(t) > 0);
  for (const t of places) {
    const p = esc(t.text.replace(/[.,!?;:]+$/, ""));
    options.push(note.replace(new RegExp(`\\b${HIDE_PREPS}\\s+(?:the\\s+)?${p}\\b`), "somewhere"));
  }
  for (const t of terms.filter((x) => PLACE_WORDS.has(bare(x.text)))) {
    const p = esc(t.text.replace(/[.,!?;:]+$/, ""));
    options.push(note.replace(new RegExp(`\\b${HIDE_PREPS}\\s+(?:(?:the|a|your|his|her|their)\\s+)?(?:[\\w'-]+\\s+){0,2}?${p}\\b`, "i"), "somewhere"));
  }

  // What: the most telling thing, with the words that describe it. A list
  // goes as a whole ("apples and fresh bread"), never one item of it.
  const things = terms
    .map((t, i) => ({ t, i, w: weightOf(t, () => 0.5) }))
    .filter(({ t, w }) => w > 0 && t.tags.includes("Noun") && !t.tags.includes("Person") && !/^[A-Z]/.test(t.text) && !PLACE_WORDS.has(bare(t.text)))
    // Equal weight: the later one, which is usually the object ("a jigsaw
    // puzzle of a lighthouse" hides the lighthouse).
    .sort((a, b) => b.w - a.w || b.i - a.i);
  const describes = (t) => t && (t.tags.includes("Adjective") || t.tags.includes("Value") || t.tags.includes("Determiner") ||
    t.tags.includes("Possessive") || (t.tags.includes("Noun") && !t.tags.includes("Pronoun") && !/^[A-Z]/.test(t.text)));
  for (const { i } of things) {
    let from = i;
    while (from > 0 && describes(terms[from - 1]) && !terms[from - 1].tags.includes("Verb")) from--;
    let to = i;
    // "jacket potato": both words of a thing go together.
    while (to + 1 < terms.length && terms[to + 1].tags.includes("Noun") && !terms[to + 1].tags.includes("Pronoun") && !/^[A-Z]/.test(terms[to + 1].text)) to++;
    // "apples and fresh bread": the whole list.
    while (to + 2 < terms.length && /^(?:and|or)$/i.test(terms[to + 1].text) && describes(terms[to + 2])) {
      to += 2;
      while (to + 1 < terms.length && describes(terms[to + 1]) && !terms[to + 1].tags.includes("Preposition")) to++;
    }
    const phrase = terms.slice(from, to + 1).map((t) => t.text).join(" ").replace(/[.,!?;:]+$/, "");
    options.push(note.replace(new RegExp(`\\b${esc(phrase)}\\b`), "something"));
  }

  const usable = options.find((o) => o && o !== note && hasConcreteWord(o));
  return usable ? asNote(usable) : null;
}

/**
 * How much help today's visit gives, from 3 (two full sentences) down to 0
 * (the date alone). Everyone starts at 3.
 *
 * It follows the person's own recent visits, never anyone else's: after
 * three visits at a level in which they brought back a good share of the
 * day's other details by themselves, it gives a little less. After three
 * that were hard, it gives more again. Nothing here is shown as a score or
 * a judgement; it only decides how much of the day to reveal.
 */
export const HINT_LEVELS = 3;
// Less help needs more evidence (3 good visits of the last 4); more help
// comes quickly (2 hard visits of the last 3). Slowly, and never leaving
// someone stuck.
const EASIER_WINDOW = 4;
const EASIER_NEEDED = 3;
const HARDER_WINDOW = 3;
const HARDER_NEEDED = 2;
const WENT_WELL = (c) => c.overlapRatio >= 0.4 && c.overlapCount >= 2;
const WAS_HARD = (c) => c.overlapRatio < 0.15;

export function hintLevelFor(entries) {
  let level = HINT_LEVELS;
  let window = [];
  const ordered = entries
    .filter((r) => r.type === "recall" && r.recallComparison)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  for (const r of ordered) {
    window.push(r.recallComparison);
    const hard = window.slice(-HARDER_WINDOW).filter(WAS_HARD).length;
    const well = window.slice(-EASIER_WINDOW).filter(WENT_WELL).length;
    if (window.length >= HARDER_WINDOW && hard >= HARDER_NEEDED && level < HINT_LEVELS) { level++; window = []; }
    else if (window.length >= EASIER_WINDOW && well >= EASIER_NEEDED && level > 0) { level--; window = []; }
  }
  return level;
}

/**
 * The hints for one visit at a given level: { level, glimpses, hidden }, where
 * `hidden` says a detail was left out of each sentence on purpose.
 */
export function recallHints(text, level = HINT_LEVELS, otherTexts = []) {
  if (level <= 0) return { level: 0, glimpses: [], hidden: false };

  // How many bullets this day is worth, then less help means fewer of them.
  const full = bulletCountFor(text);
  const want = level >= HINT_LEVELS ? full : Math.max(1, Math.round(full * (level === 2 ? 0.6 : 0.35)));
  const bullets = summarizeDay(text, { max: want, otherTexts });
  if (level >= HINT_LEVELS) return { level, glimpses: bullets, hidden: false };

  // Below full help, one detail of each bullet is left out for them to fill
  // in. A bullet with nothing that can be left out is shown as it is: a
  // quiet day should still get its detail.
  const shown = bullets.map((b) => withDetailHidden(b) || b);
  return { level, glimpses: shown, hidden: shown.some((b, i) => b !== bullets[i]) };
}

/**
 * Visits are only compared with visits that had the same amount of help:
 * a change would otherwise show the hints, not the person. Keeps the visits
 * of the same kind as the most recent one.
 */
export function comparableRecalls(recalls) {
  const kindOf = (e) => {
    const c = e.recallComparison || {};
    if (typeof c.hintLevel === "number") return `level-${c.hintLevel}`;
    return (c.hintCount || 0) > 0 ? "words" : "none";
  };
  const latest = recalls.reduce((a, b) => (!a || new Date(b.date) > new Date(a.date) ? b : a), null);
  return latest ? recalls.filter((e) => kindOf(e) === kindOf(latest)) : recalls;
}

/* ---------- After a visit: which details came back ----------
   The things named on the day (people, places, things), set beside the
   things named in the visit. Only for showing the person; the recall trend
   is measured separately, in analysis.js, and is not changed by this. */

// Said on almost any day, so never shown as a detail of one.
const NOT_A_DETAIL = new Set([...VAGUE, "i", "home", "house", "lots", "loads", "bits", "thanks", "place", "places", "people", "person", "someone", "somewhere", "something", "while", "hours", "hour", "minutes", "minute"]);

/**
 * The details named in a piece of text: [{ key, label }]. Words that name
 * one thing together stay together ("garden centre", "Agatha Christie").
 */
export function detailsOf(text) {
  if (!text || !window.nlp) return [];
  // Ways of saying where, not things that were there.
  text = text.replace(/\b(?:on the way (?:home|back|there)|next door|at home|back home)\b/gi, " ");
  const out = [];
  const seen = new Set();
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const label = run.map((t) => t.text.replace(/[.,!?;:]+$/, "")).join(" ").replace(/_/g, " ");
    const proper = /^[A-Z]/.test(label);
    const head = stem(run[run.length - 1].text);
    const key = proper ? label.toLowerCase() : head;
    if (head && !NOT_A_DETAIL.has(bare(run[run.length - 1].text)) && !seen.has(key)) {
      seen.add(key);
      out.push({ key, label: proper ? label : label.toLowerCase(), words: run.map((t) => bare(t.text)) });
    }
    run = [];
  };
  // Things whose last word is also a verb, so they would lose it: "watering can".
  text = text.replace(/\b(watering|tin|oil) can\b/gi, "$1_can");
  for (const t of termsOf(text)) {
    const isNoun = t.tags.includes("Noun") && !t.tags.includes("Pronoun") && !t.tags.includes("Date") &&
      !t.tags.includes("Possessive") && bare(t.text).length > 1 && !/^(?:there|here)$/i.test(bare(t.text));
    const capital = /^[A-Z]/.test(t.text) && t.text !== "I";
    // A name and a common word next to each other are two details:
    // "daughter" and "Susan", not "daughter Susan".
    if (isNoun && (!run.length || /^[A-Z]/.test(run[0].text) === capital) && !/[.,!?;:]$/.test(run[run.length - 1]?.text || "")) run.push(t);
    else { flush(); if (isNoun) run.push(t); }
  }
  flush();
  return out;
}

/**
 * Details from the day set beside details from the visit:
 *   shared    [{ label, fromNotes }] named both times. `fromNotes` marks the
 *             ones the notes had shown: saying a hint back is fine, but it is
 *             not the same as bringing a detail back unprompted.
 *   onlyThen  [label] named on the day but not now
 *   onlyNow   [label] named now but not on the day
 */
export function compareDetails(originalText, recallText, hintWords = []) {
  const hinted = new Set(hintWords.map((w) => stem(w)));
  const given = (d) => d.words.some((w) => hinted.has(stem(w)));
  const then = detailsOf(originalText);
  const now = detailsOf(recallText);
  // One detail matches another when their main words match ("the market"
  // and "market"), or when one is part of the other ("blood pressure" and
  // "blood pressure check").
  const stems = (d) => d.words.map(stem);
  const within = (a, b) => stems(a).every((w) => stems(b).includes(w));
  const matches = (a, b) => a.key === b.key || stem(a.words[a.words.length - 1]) === stem(b.words[b.words.length - 1]) ||
    within(a, b) || within(b, a);
  const shared = then.filter((d) => now.some((n) => matches(d, n)));
  return {
    // What they brought back by themselves first.
    shared: shared.map((d) => ({ label: d.label, fromNotes: given(d) })).sort((a, b) => a.fromNotes - b.fromNotes),
    onlyThen: then.filter((d) => !shared.includes(d)).map((d) => d.label),
    onlyNow: now.filter((n) => !then.some((d) => matches(d, n))).map((d) => d.label),
  };
}

/**
 * The day's own entry, split into the parts that came back today and the
 * parts that did not: [{ text, recalled }].
 *
 * Anything mentioned again is marked, however briefly and however few times
 * it came up. A detail that surfaced once is still a detail that surfaced,
 * and the point of showing the entry this way is to let someone see what
 * they brought back inside the day they wrote, rather than as a list of
 * words beside it.
 */
export function recalledInEntry(originalText, recallText) {
  const text = String(originalText || "");
  if (!text || !window.nlp) return [{ text, recalled: false }];

  const now = detailsOf(recallText);
  if (!now.length) return [{ text, recalled: false }];
  const stems = (d) => d.words.map(stem);
  const within = (a, b) => stems(a).every((w) => stems(b).includes(w));
  const matches = (a, b) => a.key === b.key || stem(a.words[a.words.length - 1]) === stem(b.words[b.words.length - 1]) ||
    within(a, b) || within(b, a);

  // The phrases to mark: every detail of that day that came up again today.
  const phrases = detailsOf(text)
    .filter((d) => now.some((n) => matches(d, n)))
    .map((d) => d.label)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!phrases.length) return [{ text, recalled: false }];

  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Also catch the plural or possessive form the entry happens to use.
  const finder = new RegExp(`\\b(?:${escaped.join("|")})(?:'s|s|es)?\\b`, "gi");
  const parts = [];
  let at = 0;
  for (const hit of text.matchAll(finder)) {
    if (hit.index > at) parts.push({ text: text.slice(at, hit.index), recalled: false });
    parts.push({ text: hit[0], recalled: true });
    at = hit.index + hit[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), recalled: false });
  return parts;
}

export function daysBetween(isoA, isoB) {
  return Math.round(Math.abs(new Date(isoA) - new Date(isoB)) / (24 * 60 * 60 * 1000));
}

export function formatFriendlyDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
