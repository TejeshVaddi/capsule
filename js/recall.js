import { db } from "./data.js?v=f5fa412c13";

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
   A bare date is a hard place to start remembering from. So a visit opens
   with a few short notes about the day: the things that made that day
   different from the others. "Your 80th birthday". "Peter flew back from
   Australia". "Fish and chips on the pier".

   Each note is the person's own words, cut down to the part that matters:
   time words, softeners and side clauses are dropped, and "I" is left off so
   it reads like a note. A note is never reworded: new wording could get a
   detail wrong, and a wrong hint would plant a memory rather than bring one
   back.

   Which moments: the ones that carry the most (people, places, events such
   as a birthday or a fall), and that were unusual for this person. If
   Margaret comes round every day, tea with Margaret says little about one
   particular day; the evening Peter rang from Australia says a lot.

   How much the notes give away depends on how the person's own recent visits
   have gone. See hintLevelFor(). */

// People are the strongest cue, then places and events, then things.
const KIN = new Set([
  "mother", "mum", "mom", "mam", "father", "dad", "sister", "brother", "wife", "husband",
  "son", "daughter", "grandson", "granddaughter", "grandchild", "grandchildren", "grandkids",
  "grandma", "grandpa", "nan", "gran", "aunt", "uncle", "niece", "nephew", "cousin",
  "friend", "friends", "neighbour", "neighbor", "neighbours", "neighbors", "family",
  "partner", "children", "kids", "baby", "carer", "caregiver", "doctor", "nurse", "vicar",
]);
const PLACE_WORDS = new Set([
  "market", "shop", "shops", "store", "supermarket", "bakery", "butcher", "park", "garden",
  "church", "chapel", "beach", "sea", "seaside", "harbour", "harbor", "library", "hospital",
  "surgery", "clinic", "cafe", "café", "restaurant", "pub", "club", "hall", "centre", "center",
  "station", "town", "village", "city", "school", "office", "bank", "lake", "river", "woods",
  "hills", "farm", "pool", "gym", "cinema", "theatre", "theater", "museum", "street", "road",
  "university", "college", "chemist", "pharmacy", "zoo", "pier", "abbey", "cathedral", "castle",
  "promenade", "coast", "countryside", "airport", "hotel", "doctor's", "dentist", "hairdresser's",
]);
// What makes a day stand out from the ones around it.
const EVENT_WORDS = new Set([
  "birthday", "anniversary", "wedding", "married", "marry", "engaged", "engagement", "funeral",
  "christening", "party", "holiday", "holidays", "trip", "outing", "hospital", "appointment",
  "operation", "fall", "fell", "broke", "broken", "won", "prize", "raffle", "surprise",
  "surprised", "born", "baby", "died", "retired", "retirement", "graduation", "concert",
  "fete", "festival", "show", "match", "reunion", "celebration", "christmas", "easter",
  "check", "checkup", "scan", "results", "moved", "flew", "flying", "bingo", "service",
]);
// Too general, or too everyday, to tell one day from another.
const VAGUE = new Set([
  "thing", "things", "lot", "bit", "way", "stuff", "something", "anything", "nothing",
  "everything", "one", "ones", "round", "kind", "sort", "time", "times", "day", "days",
  "morning", "afternoon", "evening", "night", "week", "weekend", "today", "yesterday",
]);
const ROUTINE = new Set([
  "breakfast", "lunch", "dinner", "tea", "supper", "nap", "bed", "television", "tv", "telly",
  "house", "home", "bath", "shower", "cup", "coffee", "biscuits", "biscuit",
]);

const FILLERS = /\b(?:um+|uh+|erm+|er|hmm+|mm+)\b[,.]?\s*/gi;
const LEAD_IN = /^(?:and|then|so|but|also|anyway|well|oh|okay|ok|after that|afterwards)\b[,\s]*/i;
// Where one moment may end and the next begin inside a sentence. Split
// generously here; a piece with no verb of its own is joined back to the
// one before it, so "fish and chips" and "her husband Frank" stay whole.
const MOMENT_BREAK = /(,\s*|;\s*|\s+and then\s+|\s+then\s+|\s+and\s+|\s+but\s+|\s+so\s+(?!much|many|good|nice|lovely|long))/i;
// Parts of a sentence a note can do without.
const TIME_WORDS = /\b(?:in the (?:morning|afternoon|evening)|this (?:morning|afternoon|evening)|(?:early|late) (?:morning|afternoon|evening)|today|tonight|yesterday|last night|later on|later|after that|afterwards|first thing|all day|on the way (?:home|back|there)|by the evening|in the end|at the end of the day|for (?:about |nearly |almost |over )?(?:a|an|one|two|three|four|a few|several|\d+) (?:minutes?|hours?|days?|weeks?|while|bit)|(?:at )?about (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?: o'clock)?)\b,?/gi;
// Words left dangling at the end once the rest is cut: "a film with Audrey
// Hepburn in it".
const DANGLING = /\s+(?:in it|on it|there|as well|too|again|and)$/i;
const SOFTENERS = /\b(?:really|very|quite|just|also|actually|basically|finally|nearly|almost|a bit|a little|kind of|sort of|so much|some)\s+/gi;
const SIDE_CLAUSE = /,?\s+(?:which|because|since|until|till|while|whilst|although|though|so that|as soon as|when)\b.*$/i;
const OPENERS = /^(?:it was|it's|there was|there were|that was)\s+/i;
const NEGATIVE = /\b(?:didn't|did not|don't|not|nothing|never|couldn't|can't|wasn't|no one|nobody)\b/i;
// A note splits into pieces at these words; the least telling pieces go first.
const PIECE_BREAK = /\s+(?=(?:with|to|at|for|in|on|from|about|by|into|near|past|after|before|around|over)\s)/i;
const MAX_NOTE_WORDS = 9;
const MAX_NOTES = 3;

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

/** A note as shown: first letter capital, no full stop. */
function asNote(text) {
  const s = text.replace(/^[\s,;:]+|[\s,;:.!?]+$/g, "").replace(/\s+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// A month straight after one of these is a date ("in June"); after anything
// else, capitalised, it is a name ("bumped into June from next door").
const DATE_LEAD = new Set(["in", "on", "of", "since", "until", "till", "by", "last", "next", "early", "late", "mid", "this", "every", "for", "during"]);

/** The terms of a short piece of text, with compromise's tags. */
function termsOf(text) {
  const terms = (window.nlp(text).json({ terms: { tags: true } }) || [])
    .flatMap((sent) => sent.terms || [])
    .map((t) => ({ text: t.text || "", tags: [...(t.tags || [])] }));
  terms.forEach((t, i) => {
    const prev = i ? bare(terms[i - 1].text) : "";
    if (t.tags.includes("Month") && /^[A-Z]/.test(t.text) && i > 0 && !DATE_LEAD.has(prev)) {
      t.tags = t.tags.filter((x) => x !== "Date" && x !== "Month").concat("Person");
    }
  });
  return terms;
}

/**
 * Whether a piece of a sentence is a moment of its own, and who it is about.
 * It needs a verb ("fish and chips on the pier" has none). A piece that
 * starts with its verb takes its subject from the piece before: fine when
 * that is the person themselves ("went to the garden centre and bought
 * bulbs"), but "Ann has had a fall and broken her wrist" has to stay
 * together, or the note would say "Broken her wrist".
 * Returns the subject word when it stands alone, or null.
 */
function subjectIfAlone(piece, previousSubject) {
  const terms = termsOf(piece.replace(SIDE_CLAUSE, ""));
  if (!terms.some((t) => t.tags.includes("Verb"))) return null;
  const opensWithVerb = terms[0] && terms[0].tags.includes("Verb") && !terms[0].tags.includes("Gerund");
  if (opensWithVerb) return previousSubject === null || /^(?:i|we|me|you)$/i.test(previousSubject) ? "i" : null;
  const lead = piece.replace(LEAD_IN, "").replace(TIME_WORDS, " ").trim();
  return (lead.split(/\s+/)[0] || "").toLowerCase();
}

/** The last person named in a piece of text ("Ann" in "my sister Ann"). */
function lastPersonIn(text) {
  const names = [];
  let run = [];
  for (const t of termsOf(text)) {
    const word = t.text.replace(/[.,!?;:]+$/, "");
    if (t.tags.includes("Person") && /^[A-Z]/.test(word) && !KIN.has(word.toLowerCase())) run.push(word);
    else { if (run.length) names.push(run.join(" ")); run = []; }
  }
  if (run.length) names.push(run.join(" "));
  return names.length ? names[names.length - 1] : null;
}

const bare = (w) => w.toLowerCase().replace(/[^a-z0-9'é]/g, "").replace(/'s$/, "");
const stem = (w) => bare(w).replace(/(?<=[a-z]{3})(?:es|s)$/, "");

/**
 * How unusual each word is for this person: 1 for a word none of their other
 * entries use, near 0 for one nearly all of them do. With only a few other
 * entries there is nothing to compare, so every word counts the same.
 */
function rarityAmong(otherTexts) {
  const docs = otherTexts.filter(Boolean).map((t) => new Set((t.match(/[A-Za-z0-9'é]+/g) || []).map(stem)));
  if (docs.length < 3) return () => 0.5;
  const df = new Map();
  for (const d of docs) for (const w of d) df.set(w, (df.get(w) || 0) + 1);
  return (word) => 1 - (df.get(stem(word)) || 0) / docs.length;
}

/** How much one word tells about the day. */
function weightOf(term, rarity) {
  const lower = bare(term.text);
  if (!lower || VAGUE.has(lower)) return 0;
  const tags = term.tags;
  let w = 0;
  if (tags.includes("Person")) w = 3;
  else if (EVENT_WORDS.has(lower)) w = 3;
  else if (tags.includes("Place") || (tags.includes("ProperNoun") && !tags.includes("Pronoun"))) w = 2.5;
  else if (KIN.has(lower)) w = 2;
  else if (PLACE_WORDS.has(lower)) w = 1.5;
  else if (tags.includes("Value") || tags.includes("Ordinal")) w = 1.5;
  else if (tags.includes("Noun") && !tags.includes("Pronoun") && !tags.includes("Date")) w = ROUTINE.has(lower) ? 0.3 : 1;
  // Common for this person counts for half; unusual counts for half again.
  return w * (0.5 + rarity(lower));
}

/**
 * One moment cut down to a short note, with how much it tells.
 * Returns null when nothing in it is worth showing.
 */
function noteFrom(clause, rarity) {
  let c = clause.replace(LEAD_IN, "")
    .replace(TIME_WORDS, " ")
    .replace(SOFTENERS, "")
    .replace(SIDE_CLAUSE, "")
    .replace(/\s+/g, " ").trim()
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(OPENERS, "");
  if (!c) return null;

  c = c.replace(/\s+(?:me|I) and\s+(?=[A-Z]|my\s|our\s)/g, " with ");
  c = toSecondPerson(c)
    // "You went to church" reads as a note without the "you".
    .replace(/^you\s+(?!(?:and|were|are|had been)\b)/i, "")
    .replace(/[\s,;:.!?]+$/, "")
    .replace(DANGLING, "");
  const terms = termsOf(c);
  if (terms.length < 2) return null;
  const weights = new Map();
  const isName = (t) => t && (t.tags.includes("Person") || t.tags.includes("ProperNoun")) && /^[A-Z]/.test(t.text);
  terms.forEach((t, i) => {
    const key = bare(t.text);
    // A name of two words ("Agatha Christie") is one detail, not two.
    const w = weightOf(t, rarity) * (isName(t) && isName(terms[i - 1]) ? 0.25 : 1);
    weights.set(key, Math.max(weights.get(key) || 0, w));
  });
  const valueOf = (piece) => piece.split(/\s+/).reduce((sum, w) => sum + (weights.get(bare(w)) || 0), 0);

  // Too long: keep the start (what happened) and as many of the pieces after
  // it as fit. Only ever cut from the end. Taking a piece out of the middle
  // can join two parts that did not belong together ("had soup ... with
  // Audrey Hepburn"), and a hint must never say something that did not happen.
  let words = c.split(/\s+/);
  let penalty = 0;
  if (words.length > MAX_NOTE_WORDS) {
    const pieces = c.split(PIECE_BREAK);
    let head = pieces[0];
    // A long list keeps its first two items: "apples and fresh bread".
    // What came after a shortened list belonged to the whole list, or to
    // its last item ("daffodils for the kitchen table"), so it goes too.
    const items = head.split(/\s+and\s+/);
    const listCut = items.length > 2;
    if (listCut) head = items.slice(0, 2).join(" and ");
    const out = [head];
    let length = head.split(/\s+/).length;
    for (const piece of listCut ? [] : pieces.slice(1)) {
      const n = piece.split(/\s+/).length;
      if (length + n > MAX_NOTE_WORDS) break;
      out.push(piece);
      length += n;
    }
    c = out.join(" ").replace(DANGLING, "");
    words = c.split(/\s+/);
    if (words.length > MAX_NOTE_WORDS + 3) return null;
    if (words.length > MAX_NOTE_WORDS) penalty += 1;
  }

  const kept = [...new Set(words.map(bare))];
  let score = kept.reduce((sum, w) => sum + (weights.get(w) || 0), 0) - penalty;
  if (NEGATIVE.test(c)) score -= 2;
  // "She told you" needs to know who she is.
  if (/^(?:he|she|they|it|this|that)\b/i.test(c)) score -= 1.5;
  if (words.length < 2) score -= 1;
  // The word that carries the note, so two notes never lean on the same one.
  const main = kept.reduce((best, w) => ((weights.get(w) || 0) > (weights.get(best) || 0) ? w : best), kept[0]);
  return { text: asNote(c), score, main };
}

/**
 * The most telling moments of an entry, as short notes in the order they
 * happened: up to three for a full day, one for a quiet one.
 * `otherTexts` are the person's other entries, to tell what was unusual.
 */
export function glimpsesFrom(text, otherTexts = [], max = MAX_NOTES) {
  return pickNotes(text, otherTexts, max).sort((a, b) => a.order - b.order).map((c) => c.text);
}

/** The chosen notes, most telling first: [{ text, score, order }]. */
function pickNotes(text, otherTexts, max) {
  if (!text || !window.nlp) return [];
  const rarity = rarityAmong(otherTexts);
  const sentences = tidy(text).split(/(?<=[.!?])\s+/);
  const candidates = [];
  let lastName = null;
  sentences.forEach((sentence, si) => {
    const parts = sentence.split(MOMENT_BREAK);
    const moments = [];
    let subject = null;
    for (let i = 0; i < parts.length; i += 2) {
      const piece = (parts[i] || "").trim();
      if (!piece) continue;
      const joiner = i > 0 ? parts[i - 1] : "";
      const own = moments.length ? subjectIfAlone(piece, subject) : "first";
      if (own === null) moments[moments.length - 1] += joiner + piece;
      else {
        moments.push(piece);
        subject = own === "first" ? subjectIfAlone(piece, null) || "i" : own;
      }
    }
    for (let moment of moments) {
      moment = moment.replace(LEAD_IN, "").trim();
      // "She has had a fall": say who, when the moment before named someone.
      if (lastName) moment = moment.replace(/^(?:she|he)\b/i, lastName);
      lastName = lastPersonIn(moment) || lastName;
      const note = noteFrom(moment, rarity);
      if (note && note.score > 0) candidates.push({ ...note, sentence: si, order: candidates.length });
    }
  });
  if (!candidates.length) return [];

  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.order - b.order);
  const top = ranked[0].score;
  // Only notes that tell something next to the best one; a quiet day keeps
  // its one real detail.
  const pool = ranked.filter((c, i) => i === 0 || (c.score >= 2 && c.score >= top * 0.25));
  const picked = [];
  for (const c of pool) {
    if (picked.length === max) break;
    if (picked.some((p) => p.main === c.main || p.text === c.text)) continue;
    // Spread over the day: a second note from the same sentence only when
    // no other sentence has one to offer.
    const sameSentence = picked.some((p) => p.sentence === c.sentence);
    const otherAvailable = pool.some((r) => r !== c && !picked.includes(r) && !picked.some((p) => p.sentence === r.sentence));
    if (sameSentence && otherAvailable) continue;
    picked.push(c);
  }
  return picked;
}

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
  if (level >= HINT_LEVELS) return { level, glimpses: glimpsesFrom(text, otherTexts), hidden: false };

  // Fewer notes, each with one detail left out: the most telling notes that
  // still leave something real once a detail is gone.
  const want = level === 2 ? 2 : 1;
  const notes = pickNotes(text, otherTexts, MAX_NOTES);
  const chosen = [];
  for (const n of notes) {
    if (chosen.length === want) break;
    const hiddenText = withDetailHidden(n.text);
    if (hiddenText) chosen.push({ text: hiddenText, order: n.order });
  }
  // A quiet day with nothing to leave out still gets its one detail.
  if (!chosen.length && notes.length) chosen.push({ text: notes[0].text, order: notes[0].order, plain: true });
  return {
    level,
    glimpses: chosen.sort((a, b) => a.order - b.order).map((c) => c.text),
    hidden: chosen.some((c) => !c.plain),
  };
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
