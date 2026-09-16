// Summarising a day into bullet points, for a memory visit.
//
// The first version of this cut single clauses out of the entry ("After the
// service you had tea and biscuits"). For someone with memory trouble that
// is the wrong thing to hand back: a clipped fragment of a sentence they
// said days ago is hard to place, and a piece taken out of the middle can
// even read as something that did not happen.
//
// So a day is summarised instead of clipped:
//   1. the entry is split into its episodes, one per thing that happened,
//      with sentences that carry on the same episode joined together
//   2. each episode is compressed into one bullet that keeps who, what and
//      where, dropping only side clauses, softeners and repeated time words
//   3. the number of bullets follows how much was said that day, so a long
//      day gets more bullets and a quiet one gets one or two
//
// Every bullet is still the person's own words, lightly reworded from "I" to
// "you". Nothing is invented: a summary in new words could put a detail in a
// day that never held it, and a wrong memory is worse than no memory.

import {
  LEAD_IN, TIME_WORDS, DANGLING, SOFTENERS, PIECE_BREAK, MOMENT_BREAK,
  toSecondPerson, tidy, asNote, termsOf, subjectIfAlone, bare, stem, rarityAmong, weightOf,
} from "./text.js?v=e81ccc62e1";

// A bullet is a whole thought, not a fragment: long enough to be recognised,
// short enough to read at a glance.
const MAX_BULLET_WORDS = 18;
// About one bullet per this many words of the entry, so a day someone
// talked about at length gets more of it back than a quiet one.
const WORDS_PER_BULLET = 18;
const MIN_BULLETS = 1;
const MAX_BULLETS = 6;

const wordsIn = (s) => (s.match(/[A-Za-z0-9']+/g) || []).length;

/** Time words are worth keeping once, at the front ("In the morning..."). */
function keepLeadingTime(sentence) {
  const lead = sentence.match(/^(in the (?:morning|afternoon|evening)|this (?:morning|afternoon|evening)|today|yesterday|last night|first thing|all day)\b[,\s]*/i);
  return lead ? lead[1].toLowerCase() : null;
}

/** One sentence, cut down to what it is about. */
function compress(sentence) {
  const lead = keepLeadingTime(sentence);
  let s = sentence.replace(LEAD_IN, "");
  // "me and Margaret" is company, not a second subject.
  s = s.replace(/\s+(?:me|I) and\s+(?=[A-Z]|my\s|our\s)/g, " with ");
  // Side clauses are kept. "because it was Peter's birthday" is the reason
  // the day happened at all; if the bullet runs long, fit() stops at a
  // clause end instead, which never loses the front of the thought.
  s = s.replace(TIME_WORDS, " ").replace(SOFTENERS, "").replace(/\s+/g, " ").trim();
  s = s.replace(/^[,\s]+|[\s,;:.!?]+$/g, "");
  if (!s) return null;
  s = toSecondPerson(s).replace(DANGLING, "");
  if (lead) s = `${lead} ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
  return s.trim();
}

// Where a bullet may end: between clauses first, then between phrases.
const CLAUSE_CUT = /(,\s*(?:and\s+|then\s+)?|\s+and then\s+|\s+and\s+|\s+then\s+|\s+but\s+|\s+because\s+|\s+which\s+)/i;
const TRAILING_JOINER = /[\s,]+(?:and|then|but|so|with|to|for|at|in|on|from|about|by)$/i;

/**
 * Trims a bullet from the end only, never from the middle, and only at a
 * place where a sentence can stop. "...for your eye appointment" is a
 * bullet; "...for your eye appointment and they put drops" is a broken one.
 */
function fit(text, max = MAX_BULLET_WORDS) {
  if (wordsIn(text) <= max) return text;
  const parts = text.split(CLAUSE_CUT);
  let out = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    const joiner = parts[i];
    const clause = parts[i + 1] || "";
    if (wordsIn(out) + wordsIn(clause) > max) break;
    out += joiner + clause;
  }
  // A first clause that is itself too long loses its last phrases.
  if (wordsIn(out) > max) {
    const pieces = out.split(PIECE_BREAK);
    let kept = pieces[0];
    for (const piece of pieces.slice(1)) {
      if (wordsIn(kept) + wordsIn(piece) > max) break;
      kept += " " + piece;
    }
    out = kept;
  }
  return out.replace(TRAILING_JOINER, "").replace(DANGLING, "");
}

/** The content words of a piece of text, for telling episodes apart. */
function keyWordsOf(text) {
  return new Set(
    termsOf(text)
      .filter((t) => (t.tags.includes("Noun") || t.tags.includes("Verb")) && !t.tags.includes("Pronoun"))
      .map((t) => stem(t.text))
      .filter((w) => w.length > 2)
  );
}

// A sentence starting this way carries on the one before it.
const CONTINUES = /^(?:then|afterwards|after that|later|we|she|he|they|it|that|this|there|he's|she's|they're)\b/i;

/**
 * The day's episodes, in order: [{ text, score, keyWords }].
 * Sentences that carry on the same episode are joined, so a bullet is a
 * whole thing that happened rather than half of one.
 */
// A spoken entry often arrives as one long sentence with no full stops. It
// still holds several things that happened, so a long one is split at its
// own joins ("and then I...") before anything else.
const LONG_RUN = 26;

function sentencesOf(text) {
  const out = [];
  for (const sentence of tidy(text).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)) {
    if (wordsIn(sentence) <= LONG_RUN) { out.push(sentence); continue; }
    const parts = sentence.split(MOMENT_BREAK);
    let subject = null;
    const moments = [];
    for (let i = 0; i < parts.length; i += 2) {
      const piece = (parts[i] || "").trim();
      if (!piece) continue;
      const joiner = i > 0 ? parts[i - 1] : "";
      const own = moments.length ? subjectIfAlone(piece, subject) : "first";
      // A piece with no verb of its own belongs to the piece before it.
      if (own === null) moments[moments.length - 1] += joiner + piece;
      else {
        moments.push(piece);
        subject = own === "first" ? subjectIfAlone(piece, null) || "i" : own;
      }
    }
    out.push(...moments);
  }
  return out;
}

function episodesOf(text, rarity) {
  const sentences = sentencesOf(text);
  const episodes = [];
  for (const sentence of sentences) {
    const body = compress(sentence);
    if (!body) continue;
    const keyWords = keyWordsOf(body);
    const previous = episodes[episodes.length - 1];
    const shares = previous && [...keyWords].some((w) => previous.keyWords.has(w));
    const carriesOn = previous && CONTINUES.test(sentence) && !shares && keyWords.size <= 3;
    if (previous && (shares || carriesOn) && wordsIn(previous.text) + wordsIn(body) <= MAX_BULLET_WORDS + 8) {
      // The same episode: join, and do not repeat the subject.
      previous.text = `${previous.text.replace(/[.\s]+$/, "")}, ${body.replace(/^you\s+/i, "").charAt(0).toLowerCase()}${body.replace(/^you\s+/i, "").slice(1)}`;
      for (const w of keyWords) previous.keyWords.add(w);
      continue;
    }
    episodes.push({ text: body, keyWords, order: episodes.length });
  }

  for (const e of episodes) {
    const terms = termsOf(e.text);
    const seen = new Set();
    e.score = terms.reduce((sum, t) => {
      const key = bare(t.text);
      if (seen.has(key)) return sum;
      seen.add(key);
      return sum + weightOf(t, rarity);
    }, 0);
    e.main = [...e.keyWords][0] || e.text;
  }
  return episodes;
}

/**
 * How many separate things an entry moves between, per 100 words. Speech
 * that stays on one subject has fewer; speech that crosses from one to
 * another has more. Length is divided out, so a long entry does not score
 * higher for being long.
 */
export function topicsPer100Words(text) {
  if (!text || !window.nlp) return null;
  const words = wordsIn(text);
  if (words < 20) return null;
  return (episodesOf(text, () => 0.5).length / words) * 100;
}

/** How many bullets a day of this length deserves. */
export function bulletCountFor(text, cap = MAX_BULLETS) {
  const words = wordsIn(text || "");
  return Math.max(MIN_BULLETS, Math.min(cap, MAX_BULLETS, Math.round(words / WORDS_PER_BULLET)));
}

/**
 * A day as bullet points, in the order things happened.
 * `max` caps how many are returned (the memory visit lowers it as less help
 * is needed); `otherTexts` are the person's other days, so what was unusual
 * about this one is picked first.
 */
export function summarizeDay(text, { max = MAX_BULLETS, otherTexts = [] } = {}) {
  if (!text || !window.nlp) return [];
  const rarity = rarityAmong(otherTexts);
  const episodes = episodesOf(text, rarity);
  if (!episodes.length) return [];

  const want = Math.min(max, bulletCountFor(text, max));
  // A bullet has to carry something. "Today was a nice day" is true and
  // says nothing, so it only appears when the day held nothing else.
  const WORTH_SHOWING = 2;
  const ranked = [...episodes].sort((a, b) => b.score - a.score || a.order - b.order);
  const pool = ranked.filter((e) => e.score >= WORTH_SHOWING);
  const picked = [];
  for (const e of (pool.length ? pool : ranked)) {
    if (picked.length >= want) break;
    // Two bullets about the same thing say the same thing twice.
    if (picked.some((p) => p.main === e.main)) continue;
    picked.push(e);
  }
  return picked
    .sort((a, b) => a.order - b.order)
    .map((e) => asNote(fit(e.text)));
}
