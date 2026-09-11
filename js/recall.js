import { db } from "./data.js";

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

/* ---------- Hints for a memory visit ----------
   A bare date is a hard place to start remembering from. So the visit shows a
   few things the person mentioned that day, in their own words, to branch off
   from. Only ever phrases lifted from the entry: a hint that paraphrased could
   be wrong, and a wrong hint would plant a memory rather than cue one. */

// People are the strongest cue, then places, then things.
const KIN = new Set([
  "mother", "mum", "mom", "mam", "father", "dad", "sister", "brother", "wife", "husband",
  "son", "daughter", "grandson", "granddaughter", "grandchild", "grandchildren", "grandkids",
  "grandma", "grandpa", "nan", "gran", "aunt", "uncle", "niece", "nephew", "cousin",
  "friend", "friends", "neighbour", "neighbor", "neighbours", "neighbors", "family",
  "partner", "children", "kids", "baby", "carer", "caregiver",
]);
const PLACE_WORDS = new Set([
  "market", "shop", "shops", "store", "supermarket", "bakery", "butcher", "park", "garden",
  "church", "chapel", "beach", "sea", "seaside", "harbour", "harbor", "library", "hospital",
  "surgery", "clinic", "cafe", "café", "restaurant", "pub", "club", "hall", "centre", "center",
  "station", "town", "village", "city", "school", "office", "bank", "post", "kitchen", "lake",
  "river", "woods", "hills", "farm", "pool", "gym", "cinema", "theatre", "theater", "museum",
]);
// Too general to jog anything: "the day", "a lot", "something".
const TOO_VAGUE = new Set([
  "thing", "things", "lot", "bit", "way", "stuff", "something", "anything", "nothing",
  "everything", "one", "ones", "round", "kind", "sort", "time", "times", "day", "days",
  "morning", "afternoon", "evening", "night", "week", "weekend",
]);
const OWNER = { my: "your", our: "your", mine: "yours", this: "the", that: "the", these: "the", those: "the" };

/** How many hints a day earns: more detail on the day, more to branch from. */
export function hintCountFor(text) {
  const words = (String(text || "").match(/[A-Za-z']+/g) || []).length;
  if (words < 25) return 1;
  if (words < 60) return 2;
  return 3;
}

/**
 * Picks one to three short phrases from an entry to cue a memory of that day.
 * Returns [{ text, words }] in the order they came up in the entry, where
 * `words` are the phrase's own content words, so the recall can be scored
 * without crediting the person for repeating a hint back.
 */
export function recallHints(text, count = hintCountFor(text)) {
  if (!text || !window.nlp) return [];

  const candidates = [];
  const seenHeads = new Set();
  const doc = window.nlp(text);
  const matches = doc.nouns().json({ terms: { tags: true } }) || [];
  // Every word of the entry in order, to see what follows each phrase.
  const all = (doc.json({ terms: { tags: true } }) || []).flatMap((s) => s.terms || []);
  let cursor = 0;

  for (const m of matches) {
    const mTerms = m.terms || [];
    if (!mTerms.length) continue;
    let at = cursor;
    while (at < all.length && all[at].text !== mTerms[0].text) at++;
    const after = all[at + mTerms.length];
    cursor = at + mTerms.length;
    // "baked a chocolate cake" comes back as "a chocolate" with "cake" read as
    // a verb. A phrase running straight into a bare verb is probably cut
    // short, and half a phrase is a confusing hint, so it is left out.
    const lastPost = mTerms[mTerms.length - 1].post || "";
    if (after && !/[.,;:!?]/.test(lastPost) && (after.tags || []).includes("Infinitive")) continue;

    // A phrase like "my daughter Susan in Canada" holds two cues, not one.
    const parts = [[]];
    for (const t of mTerms) {
      const tags = t.tags || [];
      if (tags.includes("Preposition") || tags.includes("Conjunction")) parts.push([]);
      else parts[parts.length - 1].push({ text: t.text || "", tags });
    }

    for (const part of parts) {
      // Dates ("today", "this morning") and pronouns ("I", "we") cue nothing,
      // but a possessive ("her grandson") is part of who is meant. A spoken
      // stumble ("the the shop") is said once.
      let terms = part.filter((t, i) => t.text && !t.tags.includes("Date") &&
        (!t.tags.includes("Pronoun") || t.tags.includes("Possessive")) &&
        !(i > 0 && part[i - 1].text.toLowerCase() === t.text.toLowerCase()));
      // compromise tags a sentence-opening past verb ("Watched TV") as an adjective.
      while (terms.length > 1 && terms[0].tags.includes("Adjective") && /ed$/i.test(terms[0].text)) terms.shift();
      const nouns = terms.filter((t) => t.tags.includes("Noun") && !t.tags.includes("Possessive"));
      if (!nouns.length || terms.length > 5) continue;

      const head = nouns[nouns.length - 1].text.toLowerCase();
      if (TOO_VAGUE.has(head) || head.length < 2 || seenHeads.has(head)) continue;

      const isNamed = terms.some((t) => t.tags.includes("Person"));
      const isKin = nouns.some((t) => KIN.has(t.text.toLowerCase()));
      const isRole = nouns.some((t) => t.tags.includes("Actor"));
      const isPlace = terms.some((t) => t.tags.includes("Place")) || nouns.some((t) => PLACE_WORDS.has(t.text.toLowerCase()));
      const kind = isNamed || isKin || isRole ? "person" : isPlace ? "place" : "thing";
      // A name is the clearest person cue; "her grandson" leaves you asking whose.
      // For places and things, a longer phrase ("the garden centre") is more specific.
      const score = isNamed ? 3.2 : isKin ? 3 : isRole ? 2.5
        : (isPlace ? 2 : 1) + (terms.length > 1 ? 0.3 : 0);

      const phrase = terms
        .map((t, i) => {
          const lower = t.text.toLowerCase();
          if (i === 0 && OWNER[lower]) return OWNER[lower];
          // Names and short capitals ("TV", "NHS") keep their case.
          return t.tags.includes("ProperNoun") || /^[A-Z]{2,}$/.test(t.text) ? t.text : lower;
        })
        .join(" ");
      const words = terms
        .filter((t) => !t.tags.includes("Determiner") && !t.tags.includes("Possessive"))
        .map((t) => t.text.toLowerCase());

      seenHeads.add(head);
      candidates.push({ text: phrase, words, kind, score, order: candidates.length });
    }
  }

  // One of each kind first (who, where, what), so the hints open different
  // ways into the day instead of listing three people. Then the rest by score.
  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.order - b.order);
  const picked = [];
  for (const kind of ["person", "place", "thing"]) {
    const best = ranked.find((c) => c.kind === kind);
    if (best) picked.push(best);
  }
  for (const c of ranked) if (!picked.includes(c)) picked.push(c);

  return picked
    .slice(0, count)
    .sort((a, b) => a.order - b.order)
    .map(({ text: hint, words }) => ({ text: hint, words }));
}

/**
 * Visits with hints are easier than visits without, so the two are never
 * compared: a change would show the format, not the person. Keeps only the
 * visits of the same kind as the most recent one.
 */
export function comparableRecalls(recalls) {
  const hinted = (e) => (e.recallComparison?.hintCount || 0) > 0;
  const latest = recalls.reduce((a, b) => (!a || new Date(b.date) > new Date(a.date) ? b : a), null);
  return latest ? recalls.filter((e) => hinted(e) === hinted(latest)) : recalls;
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
