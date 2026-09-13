import { db } from "./data.js?v=611e55e30f";

const MIN_AGE_DAYS = 2; // an entry must be at least this old before it can be resurfaced

/**
 * Chooses an old journal entry to resurface for recall. Prefers the entry
 * least-recently (or never) recalled, weighted toward older memories.
 */
export async function pickEntryForRecall() {
  const all = await db.allEntries();
  const journals = all.filter((e) => e.type === "journal");
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

/* ---------- Glimpses: hints for a memory visit ----------
   A bare date is a hard place to start remembering from, and single words
   ("church", "Margaret") are not much better. So a visit opens with one or two
   short sentences about the day, taken from the person's own entry and turned
   to speak to them: "You went to church in the morning."

   Only ever their own words, lightly reworded (I -> you, my -> your). A hint
   that summarised in new words could get a detail wrong, and a wrong hint
   would plant a memory rather than bring one back.

   How much the glimpses give away depends on how the person's own recent
   visits have gone. See hintLevelFor(). */

// People are the strongest cue, then places, then things.
const KIN = new Set([
  "mother", "mum", "mom", "mam", "father", "dad", "sister", "brother", "wife", "husband",
  "son", "daughter", "grandson", "granddaughter", "grandchild", "grandchildren", "grandkids",
  "grandma", "grandpa", "nan", "gran", "aunt", "uncle", "niece", "nephew", "cousin",
  "friend", "friends", "neighbour", "neighbor", "neighbours", "neighbors", "family",
  "partner", "children", "kids", "baby", "carer", "caregiver", "doctor", "nurse",
]);
const PLACE_WORDS = new Set([
  "market", "shop", "shops", "store", "supermarket", "bakery", "butcher", "park", "garden",
  "church", "chapel", "beach", "sea", "seaside", "harbour", "harbor", "library", "hospital",
  "surgery", "clinic", "cafe", "café", "restaurant", "pub", "club", "hall", "centre", "center",
  "station", "town", "village", "city", "school", "office", "bank", "kitchen", "lake",
  "river", "woods", "hills", "farm", "pool", "gym", "cinema", "theatre", "theater", "museum",
  "street", "road", "house", "home", "university", "college", "chemist", "pharmacy", "zoo",
]);
// Too general to jog anything.
const VAGUE = new Set([
  "thing", "things", "lot", "bit", "way", "stuff", "something", "anything", "nothing",
  "everything", "one", "ones", "round", "kind", "sort", "time", "times", "day", "days",
  "morning", "afternoon", "evening", "night", "week", "weekend", "today", "yesterday",
]);
const FILLERS = /\b(?:um+|uh+|erm+|er|hmm+|mm+)\b[,.]?\s*/gi;
const LEAD_IN = /^(?:and|then|so|but|also|anyway|well|oh|okay|ok|after that|afterwards)\b[,\s]*/i;
// Where one moment ends and the next begins inside a sentence: "...the
// garden centre and I bought some bulbs" is two glimpses, not one.
const CLAUSE_BREAK = new RegExp([
  ",\\s*(?:and\\s+)?then\\s+", "\\s+and then\\s+", ";\\s*",
  ",?\\s+but\\s+", ",?\\s+so\\s+(?!much|many|good|nice|lovely|long)",
  ",?\\s+and\\s+(?=(?:I|we|he|she|they|my|our|his|her|their|in the|later|afterwards|[A-Z][a-z]+)\\b)",
  ",\\s*(?=(?:afterwards|later on|after that|in the evening|in the afternoon)\\b)",
].join("|"));
const MAX_WORDS = 16;
const NEGATIVE = /\b(?:didn't|did not|don't|not|nothing|never|couldn't|can't|wasn't|no one|nobody)\b/i;

// First person to second person, on whole words.
const TO_YOU = [
  [/\bI'm\b/g, "you're"], [/\bI've\b/g, "you've"], [/\bI'd\b/g, "you'd"], [/\bI'll\b/g, "you'll"],
  [/\bI am\b/g, "you are"], [/\bI was\b/g, "you were"], [/\bwe were\b/gi, "you were"],
  [/\bwe're\b/gi, "you're"], [/\bwe've\b/gi, "you've"], [/\bwe'd\b/gi, "you'd"], [/\bwe'll\b/gi, "you'll"],
  [/\bmyself\b/gi, "yourself"], [/\bourselves\b/gi, "yourselves"],
  [/\bmine\b/gi, "yours"], [/\bours\b/gi, "yours"],
  [/\bmy\b/gi, "your"], [/\bour\b/gi, "your"],
  [/\bI\b/g, "you"], [/\bme\b/gi, "you"], [/\bwe\b/gi, "you"], [/\bus\b/g, "you"],
];

function toSecondPerson(clause) {
  let out = clause;
  for (const [re, to] of TO_YOU) out = out.replace(re, to);
  return out;
}

function tidy(text) {
  return text
    .replace(FILLERS, "")
    .replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1") // "the the shop" -> "the shop"
    .replace(/\s+/g, " ")
    .trim();
}

function finish(sentence) {
  const s = sentence.replace(/[\s,;:]+$/, "").replace(/[.!?]+$/, "");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

/** The terms of a short piece of text, with compromise's tags. */
function termsOf(text) {
  return (window.nlp(text).json({ terms: { tags: true } }) || [])
    .flatMap((sent) => sent.terms || [])
    .map((t) => ({ text: t.text || "", tags: t.tags || [] }));
}

/** How much a clause gives someone to hold on to. */
function specificity(terms, clause) {
  let score = 0;
  for (const t of terms) {
    const lower = t.text.toLowerCase();
    if (!t.text || VAGUE.has(lower)) continue;
    if (t.tags.includes("Person")) score += 3;
    else if (t.tags.includes("Place") || PLACE_WORDS.has(lower)) score += 2;
    else if (KIN.has(lower)) score += 2;
    else if (t.tags.includes("Noun") && !t.tags.includes("Pronoun") && !t.tags.includes("Date")) score += 1;
    else if (t.tags.includes("Value")) score += 0.5;
  }
  if (NEGATIVE.test(clause)) score -= 2;
  if (terms.length < 3) score -= 1;
  // A glimpse is a moment, not a paragraph.
  if (terms.length > MAX_WORDS) score -= 3;
  return score;
}

/**
 * The most telling moments of an entry, as short second-person sentences, in
 * the order they happened.
 */
export function glimpsesFrom(text) {
  if (!text || !window.nlp) return [];
  const sentences = tidy(text).split(/(?<=[.!?])\s+/);
  const candidates = [];
  sentences.forEach((sentence, si) => {
    for (let clause of sentence.split(CLAUSE_BREAK)) {
      clause = clause.replace(LEAD_IN, "").trim();
      if (!clause) continue;
      let terms = termsOf(clause);
      if (terms.length < 2) continue;
      // "Went to church in the morning." has no subject; the person is it.
      // (compromise reads a sentence-opening "Watched" as an adjective.)
      const first = terms[0];
      const opensWithVerb = (first.tags.includes("Verb") && !first.tags.includes("Gerund")) ||
        (first.tags.includes("Adjective") && /ed$/i.test(first.text));
      if (opensWithVerb) {
        clause = "I " + clause.charAt(0).toLowerCase() + clause.slice(1);
      }
      const spoken = toSecondPerson(clause);
      terms = termsOf(spoken);
      const score = specificity(terms, spoken);
      if (score < 1) continue;
      candidates.push({ text: finish(spoken), score, sentence: si, order: candidates.length });
    }
  });
  // A quiet day still gets its one real detail ("You watched TV."), but a
  // weak glimpse is never shown beside a strong one.
  const strong = candidates.filter((c) => c.score >= 2);
  const pool = strong.length ? strong : candidates.slice(0, 1);

  // The best two, from two different sentences when the entry has them, told
  // in the order they happened.
  const ranked = [...pool].sort((a, b) => b.score - a.score || a.order - b.order);
  const picked = [];
  for (const c of ranked) {
    if (picked.length === 2) break;
    const sameSentence = picked.some((p) => p.sentence === c.sentence);
    const otherAvailable = ranked.some((r) => !picked.includes(r) && r !== c && !picked.some((p) => p.sentence === r.sentence));
    if (sameSentence && otherAvailable) continue;
    picked.push(c);
  }
  return picked.sort((a, b) => a.order - b.order).map((c) => c.text);
}

/**
 * Hides the single most telling detail of a glimpse: who, then where, then
 * what. "Margaret came round for lunch." -> "Someone came round for lunch."
 */
export function withDetailHidden(sentence) {
  const phrases = (window.nlp(sentence).nouns().json({ terms: { tags: true } }) || []).map((m) => ({
    text: (m.terms || []).map((t) => t.text).join(" ").replace(/[.,!?]+$/, ""),
    terms: m.terms || [],
  }));
  // Judged by the phrase's main (last) word: "the church fete" is a thing,
  // not a place, even though it mentions a church.
  const kind = (p) => {
    const words = p.terms.filter((t) => t.text);
    const lower = words.map((t) => t.text.toLowerCase().replace(/[.,!?]+$/, ""));
    const tags = words.flatMap((t) => t.tags || []);
    const head = lower[lower.length - 1];
    const headTags = (words[words.length - 1] || {}).tags || [];
    if (tags.includes("Person") || lower.some((w) => KIN.has(w))) return "person";
    if (headTags.includes("Place") || PLACE_WORDS.has(head)) return "place";
    if (tags.includes("Pronoun") || tags.includes("Date") || VAGUE.has(head)) return null;
    return "thing";
  };
  const target = ["person", "place", "thing"]
    .map((k) => phrases.find((p) => p.text && kind(p) === k))
    .find(Boolean);
  if (!target) return null;

  const esc = target.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const k = kind(target);
  let out = sentence;
  if (k === "place") {
    out = sentence.replace(new RegExp(`\\b(?:to|at|in|into|round|around|near|by|over)\\s+${esc}\\b`), "somewhere");
    if (out === sentence) out = sentence.replace(new RegExp(`\\b${esc}\\b`), "somewhere");
  } else if (k === "person") {
    out = sentence.replace(new RegExp(`\\b${esc}\\b`), "someone");
  } else {
    // A list goes as a whole: "apples and fresh bread" -> "something", not
    // "something and fresh bread".
    out = sentence.replace(
      new RegExp(`\\b${esc}(?:,?\\s+(?:and|or)\\s+(?:[\\w'-]+\\s?){1,3}?)?(?=[.!?,]|\\s+(?:at|in|on|for|with|from|to|until|by|about)\\b|$)`),
      "something");
  }
  if (out === sentence) return null;
  return finish(out.replace(/\s+/g, " ").trim());
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
export function recallHints(text, level = HINT_LEVELS) {
  if (level <= 0) return { level: 0, glimpses: [], hidden: false };
  const glimpses = glimpsesFrom(text);
  if (level >= HINT_LEVELS) return { level, glimpses, hidden: false };
  // A plain sentence with nothing to hide ("You watched TV.") is shown as it
  // is: a quiet day should still get its one detail.
  const picked = glimpses.slice(0, level === 2 ? 2 : 1);
  const shown = picked.map((g) => withDetailHidden(g) || g);
  return { level, glimpses: shown, hidden: shown.some((g, i) => g !== picked[i]) };
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
