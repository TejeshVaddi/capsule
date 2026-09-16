// Shared language helpers: the word lists, the tidying, and the small
// measurements that both the memory-visit notes (recall.js) and the day
// summaries (summary.js) are built from.
//
// Everything here works on the person's own words. Nothing invents wording,
// because a summary in new words could put a detail in a day that never held
// it, and a wrong memory is worse than no memory.

// People are the strongest cue, then places and events, then things.
export const KIN = new Set([
  "mother", "mum", "mom", "mam", "father", "dad", "sister", "brother", "wife", "husband",
  "son", "daughter", "grandson", "granddaughter", "grandchild", "grandchildren", "grandkids",
  "grandma", "grandpa", "nan", "gran", "aunt", "uncle", "niece", "nephew", "cousin",
  "friend", "friends", "neighbour", "neighbor", "neighbours", "neighbors", "family",
  "partner", "children", "kids", "baby", "carer", "caregiver", "doctor", "nurse", "vicar",
]);
export const PLACE_WORDS = new Set([
  "market", "shop", "shops", "store", "supermarket", "bakery", "butcher", "park", "garden",
  "church", "chapel", "beach", "sea", "seaside", "harbour", "harbor", "library", "hospital",
  "surgery", "clinic", "cafe", "café", "restaurant", "pub", "club", "hall", "centre", "center",
  "station", "town", "village", "city", "school", "office", "bank", "lake", "river", "woods",
  "hills", "farm", "pool", "gym", "cinema", "theatre", "theater", "museum", "street", "road",
  "university", "college", "chemist", "pharmacy", "zoo", "pier", "abbey", "cathedral", "castle",
  "promenade", "coast", "countryside", "airport", "hotel", "doctor's", "dentist", "hairdresser's",
]);
// What makes a day stand out from the ones around it.
export const EVENT_WORDS = new Set([
  "birthday", "anniversary", "wedding", "married", "marry", "engaged", "engagement", "funeral",
  "christening", "party", "holiday", "holidays", "trip", "outing", "hospital", "appointment",
  "operation", "fall", "fell", "broke", "broken", "won", "prize", "raffle", "surprise",
  "surprised", "born", "baby", "died", "retired", "retirement", "graduation", "concert",
  "fete", "festival", "show", "match", "reunion", "celebration", "christmas", "easter",
  "check", "checkup", "scan", "results", "moved", "flew", "flying", "bingo", "service",
]);
// Too general, or too everyday, to tell one day from another.
export const VAGUE = new Set([
  "thing", "things", "lot", "bit", "way", "stuff", "something", "anything", "nothing",
  "everything", "one", "ones", "round", "kind", "sort", "time", "times", "day", "days",
  "morning", "afternoon", "evening", "night", "week", "weekend", "today", "yesterday",
]);
export const ROUTINE = new Set([
  "breakfast", "lunch", "dinner", "tea", "supper", "nap", "bed", "television", "tv", "telly",
  "house", "home", "bath", "shower", "cup", "coffee", "biscuits", "biscuit",
]);

export const FILLERS = /\b(?:um+|uh+|erm+|er|hmm+|mm+)\b[,.]?\s*/gi;
export const LEAD_IN = /^(?:and|then|so|but|also|anyway|well|oh|okay|ok|after that|afterwards)\b[,\s]*/i;
// Where one moment may end and the next begin inside a sentence. Split
// generously here; a piece with no verb of its own is joined back to the
// one before it, so "fish and chips" and "her husband Frank" stay whole.
export const MOMENT_BREAK = /(,\s*|;\s*|\s+and then\s+|\s+then\s+|\s+and\s+|\s+but\s+|\s+so\s+(?!much|many|good|nice|lovely|long))/i;
// Parts of a sentence a note can do without.
export const TIME_WORDS = /\b(?:in the (?:morning|afternoon|evening)|this (?:morning|afternoon|evening)|(?:early|late) (?:morning|afternoon|evening)|today|tonight|yesterday|last night|later on|later|after that|afterwards|first thing|all day|on the way (?:home|back|there)|by the evening|in the end|at the end of the day|for (?:about |nearly |almost |over )?(?:a|an|one|two|three|four|a few|several|\d+) (?:minutes?|hours?|days?|weeks?|while|bit)|(?:at )?about (?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?: o'clock)?)\b,?/gi;
// Words left dangling at the end once the rest is cut: "a film with Audrey
// Hepburn in it".
export const DANGLING = /\s+(?:in it|on it|there|as well|too|again|and)$/i;
// Words that only soften. "Nearly" and "a bit" are not here on purpose:
// dropping them turns "nearly killed me" into "killed me" and "a bit high"
// into "high", which is not what the person said.
export const SOFTENERS = /\b(?:really|very|quite|just|also|actually|basically|kind of|sort of|so much|some)\s+/gi;
export const SIDE_CLAUSE = /,?\s+(?:which|because|since|until|till|while|whilst|although|though|so that|as soon as|when)\b.*$/i;
export const OPENERS = /^(?:it was|it's|there was|there were|that was)\s+/i;
export const NEGATIVE = /\b(?:didn't|did not|don't|not|nothing|never|couldn't|can't|wasn't|no one|nobody)\b/i;
// A note splits into pieces at these words; the least telling pieces go first.
export const PIECE_BREAK = /\s+(?=(?:with|to|at|for|in|on|from|about|by|into|near|past|after|before|around|over)\s)/i;
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

export function toSecondPerson(clause) {
  let out = clause;
  for (const [re, to] of TO_YOU) out = out.replace(re, to);
  return out;
}

export function tidy(text) {
  return text
    .replace(FILLERS, "")
    .replace(/\b(\w+)(?:\s+\1\b)+/gi, "$1") // "the the shop" -> "the shop"
    .replace(/\s+/g, " ")
    .trim();
}

/** A note as shown: first letter capital, no full stop. */
export function asNote(text) {
  const s = text.replace(/^[\s,;:]+|[\s,;:.!?]+$/g, "").replace(/\s+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// A month straight after one of these is a date ("in June"); after anything
// else, capitalised, it is a name ("bumped into June from next door").
const DATE_LEAD = new Set(["in", "on", "of", "since", "until", "till", "by", "last", "next", "early", "late", "mid", "this", "every", "for", "during"]);

/** The terms of a short piece of text, with compromise's tags. */
export function termsOf(text) {
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
export function subjectIfAlone(piece, previousSubject) {
  const terms = termsOf(piece.replace(SIDE_CLAUSE, ""));
  if (!terms.some((t) => t.tags.includes("Verb"))) return null;
  const opensWithVerb = terms[0] && terms[0].tags.includes("Verb") && !terms[0].tags.includes("Gerund");
  if (opensWithVerb) return previousSubject === null || /^(?:i|we|me|you)$/i.test(previousSubject) ? "i" : null;
  const lead = piece.replace(LEAD_IN, "").replace(TIME_WORDS, " ").trim();
  return (lead.split(/\s+/)[0] || "").toLowerCase();
}

/** The last person named in a piece of text ("Ann" in "my sister Ann"). */
export function lastPersonIn(text) {
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

export const bare = (w) => w.toLowerCase().replace(/[^a-z0-9'é]/g, "").replace(/'s$/, "");
export const stem = (w) => bare(w).replace(/(?<=[a-z]{3})(?:es|s)$/, "");

/**
 * How unusual each word is for this person: 1 for a word none of their other
 * entries use, near 0 for one nearly all of them do. With only a few other
 * entries there is nothing to compare, so every word counts the same.
 */
export function rarityAmong(otherTexts) {
  const docs = otherTexts.filter(Boolean).map((t) => new Set((t.match(/[A-Za-z0-9'é]+/g) || []).map(stem)));
  if (docs.length < 3) return () => 0.5;
  const df = new Map();
  for (const d of docs) for (const w of d) df.set(w, (df.get(w) || 0) + 1);
  return (word) => 1 - (df.get(stem(word)) || 0) / docs.length;
}

/** How much one word tells about the day. */
export function weightOf(term, rarity) {
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
