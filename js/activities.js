// Builds the day's activity list.
//
// Six kinds, all speech-or-typing:
//   naming      read a clue, name the thing (6 per set)
//   fluency     name as many things in a category as you can in 60s
//   word-recall read 5 words, do a filler task, recall them, then recognise
//   description a prompt to describe something, out loud or typed
//   photo-story one of your own photos, and the story behind it
//   music       a song title or era cue, and what it brings back (no audio)
//
// The set is seeded by the calendar date so it is stable through the day and
// changes at midnight. Ordering is influenced by detectSignals(), which
// compares recent entries to earlier ones.

import { db, newId } from "./data.js?v=c8970c9f30";
import {
  NAMING_SETS,
  FLUENCY_CATEGORIES,
  WORD_LISTS,
  DESCRIPTION_PROMPTS,
  PHOTO_PROMPTS,
  MUSIC_ERAS,
  OPEN_PROMPTS,
  pickFresh,
} from "./activities-content.js?v=c8970c9f30";
import { daySeed, dateKey, REQUIRED_META } from "./daily.js?v=c8970c9f30";
import { detectSignals, scoreForSignals } from "./signals.js?v=c8970c9f30";

// Nothing the person has done comes back within this many days. An activity
// with nothing fresh left is not offered until something is.
export const NO_REPEAT_DAYS = 30;

/**
 * What was done in the last NO_REPEAT_DAYS days. Today's own activities are
 * left out: counting them would swap a finished game for a fresh one the
 * moment it was done, and the done card would vanish.
 */
async function recentKeys() {
  try {
    const today = dateKey();
    const since = Date.now() - NO_REPEAT_DAYS * 86400000;
    const log = await db.allActivityLog();
    return log
      .filter((r) => dateKey(new Date(r.date)) !== today && new Date(r.date).getTime() >= since)
      .map((r) => r.detail?.contentKey)
      .filter(Boolean);
  } catch {
    return [];
  }
}

// Today's two required activities come from different families, so a day is
// never two word games or two questions.
const FAMILY = { naming: "words", fluency: "words", "word-recall": "memory", description: "talk", "photo-story": "talk", music: "talk" };

export async function suggestActivities(latestMetrics, recentEntries) {
  const seen = await recentKeys();
  // Seeded by the calendar day, so today's set is the same every time it is
  // opened and genuinely changes at midnight rather than on every render.
  const seed = daySeed() * 60000;
  const suggestions = [];

  // What has already been finished today, so it can be shown as done.
  const today = dateKey();
  const doneToday = new Set(
    (await db.allActivityLog().catch(() => []))
      .filter((r) => dateKey(new Date(r.date)) === today)
      .map((r) => r.detail?.contentKey)
      .filter(Boolean)
  );

  // Which of the person's own patterns have shifted, measured over windows
  // rather than off a single entry. Empty is the normal result, and until
  // there is enough history nothing is claimed at all.
  const { ready, signals } = detectSignals(recentEntries);

  // Bridge to the older reason names still used in a few copy strings.
  const reasons = new Set();
  for (const s of signals) {
    if (s.key === "wordFinding" || s.key === "specificity") reasons.add("naming");
    if (s.key === "variety" || s.key === "repetition") reasons.add("variety");
    if (s.key === "elaboration") reasons.add("detail");
  }

  /* --- Naming family --- */

  const namingSet = pickFresh(NAMING_SETS, seen, (s) => `naming:${s.theme}`, seed);
  if (namingSet) suggestions.push({
    id: "naming",
    kind: "naming",
    title: `Naming game: ${namingSet.theme}`,
    tag: reasons.has("naming") ? "Picked for you" : "Word finding",
    tailored: reasons.has("naming"),
    why: "Read a clue. Say the word it describes.",
    contentKey: `naming:${namingSet.theme}`,
    data: namingSet,
    real: true,
  });

  const fluency = pickFresh(FLUENCY_CATEGORIES, seen, (f) => `fluency:${f.category}`, seed + 1);
  if (fluency) suggestions.push({
    id: "fluency",
    kind: "fluency",
    title: `How many can you name: ${fluency.category}`,
    tag: reasons.has("variety") ? "Picked for you" : "Word finding",
    tailored: reasons.has("variety"),
    why: `Name as many ${fluency.category.toLowerCase()} as you can in 1 minute.`,
    contentKey: `fluency:${fluency.category}`,
    data: fluency,
    real: true,
  });

  /* --- Memory family --- */

  const list = pickFresh(WORD_LISTS, seen, (l) => `words:${l.words[0]}`, seed + 2);
  if (list) suggestions.push({
    id: "word-recall",
    kind: "word-recall",
    title: "Five-word memory game",
    tag: "Memory",
    tailored: false,
    why: "Read 5 words. A little later, say the ones you remember.",
    contentKey: `words:${list.words[0]}`,
    data: list,
    real: true,
  });

  /* --- Description family --- */

  const prompt = pickFresh(DESCRIPTION_PROMPTS, seen, (p) => `desc:${p.prompt}`, seed + 3);
  const descTailored = reasons.has("detail") || reasons.has("variety");
  if (prompt) suggestions.push({
    id: "description",
    kind: "description",
    title: prompt.kind === "procedural" ? "Step by step" : prompt.kind === "reminiscence" ? "Looking back" : "Describe the scene",
    tag: descTailored ? "Picked for you" : prompt.kind === "reminiscence" ? "Memories" : "Storytelling",
    tailored: descTailored,
    why: prompt.kind === "procedural"
        ? "Say how you do something, one step at a time."
        : prompt.kind === "reminiscence"
          ? "Answer a question about your past."
          : "Describe a place or a scene.",
    contentKey: `desc:${prompt.prompt}`,
    data: { prompt: prompt.prompt, kind: prompt.kind },
    real: true,
  });

  /* --- Photo story: only offered when they actually have a photo --- */

  const photoEntry = await findEntryWithPhoto(recentEntries, seen);
  if (photoEntry) {
    const photoPrompt = PHOTO_PROMPTS[Math.abs(Math.floor(seed / 60000)) % PHOTO_PROMPTS.length];
    suggestions.push({
      id: "photo-story",
      kind: "photo-story",
      title: "Photo story",
      tag: "Memories",
      tailored: false,
      why: "Look at one of your photos. Say what you remember about it.",
      contentKey: `photo:${photoEntry.id}`,
      data: { entry: photoEntry, prompt: photoPrompt },
      real: true,
    });
  }

  /* --- Music moments --- */

  const era = pickFresh(MUSIC_ERAS, seen, (e) => `music:${e.era}`, seed + 4);
  if (era) suggestions.push({
    id: "music-moments",
    kind: "music",
    title: `Music moments: ${era.era}`,
    tag: "Memories",
    tailored: false,
    why: "Pick a song or a place you know. Say what it reminds you of.",
    contentKey: `music:${era.era}`,
    data: era,
    real: true,
  });

  /* --- An open question, with no right answer --- */

  const open = pickFresh(OPEN_PROMPTS, seen, (p) => `open:${p.prompt}`, seed + 5);
  if (open) suggestions.push({
    id: "open",
    kind: "description",
    title: "A question for you",
    tag: "Just talking",
    tailored: false,
    why: "Answer a question about your life.",
    contentKey: `open:${open.prompt}`,
    data: { prompt: open.prompt, kind: "open" },
    real: true,
  });

  // Score every activity against the detected shifts. An activity that
  // addresses the strongest shift rises to the top and carries the reason it
  // was chosen, stated as a change in the person's own patterns.
  for (const s of suggestions) {
    s.doneToday = doneToday.has(s.contentKey);
    if (!ready || !signals.length || !s.real) {
      s.matchScore = 0;
      continue;
    }
    const { score, reason } = scoreForSignals(s.kind, signals);
    s.matchScore = score;
    s.pendingReason = score > 0 ? reason : null;
  }

  // Only the best-matched few are marked as chosen for a reason. Tagging most
  // of the list "Picked for you" would drain the label of meaning and, worse,
  // would surround the person with a wall of things that have changed about
  // them. The rest simply stay ordinary activities.
  const MAX_TAILORED = 2;
  const seenReasons = new Set();
  suggestions
    .filter((s) => s.pendingReason && !s.doneToday)
    .sort((a, b) => b.matchScore - a.matchScore)
    .forEach((s) => {
      // One activity per reason, so the same sentence is not repeated twice.
      if (seenReasons.size >= MAX_TAILORED || seenReasons.has(s.pendingReason.key)) return;
      seenReasons.add(s.pendingReason.key);
      s.tailored = true;
      s.tag = "Picked for you";
      s.because = s.pendingReason.because;
      s.signalKey = s.pendingReason.key;
    });

  // Today's two required activities: the best matched, from two different
  // families, rotating by day when nothing is tailored. Chosen once and then
  // kept for the day, so finishing one never moves another into its place.
  const requiredKeys = await requiredForToday(suggestions, today);
  suggestions.forEach((s) => {
    const at = requiredKeys.indexOf(s.contentKey);
    s.required = at !== -1;
    s.requiredOrder = at;
  });

  suggestions.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    if (a.required) return a.requiredOrder - b.requiredOrder;
    if (a.doneToday !== b.doneToday) return a.doneToday ? 1 : -1;
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return (b.tailored ? 1 : 0) - (a.tailored ? 1 : 0);
  });
  return suggestions;
}

async function requiredForToday(suggestions, today) {
  const saved = await db.getMeta(REQUIRED_META).catch(() => null);
  const available = new Set(suggestions.map((s) => s.contentKey));
  if (saved?.date === today && saved.keys?.length === 2 && saved.keys.every((k) => available.has(k))) {
    return saved.keys;
  }

  if (suggestions.length < 2) return suggestions.map((s) => s.contentKey);

  // The kind of activity done longest ago goes first, so the days rotate
  // through all of them instead of landing on the same kind by chance.
  const log = await db.allActivityLog().catch(() => []);
  const lastDone = new Map();
  for (const r of log) {
    const type = (r.detail?.contentKey || "").split(":")[0];
    const t = new Date(r.date).getTime();
    if (type && (!lastDone.has(type) || t > lastDone.get(type))) lastDone.set(type, t);
  }
  const since = (s) => lastDone.get(s.contentKey.split(":")[0]) ?? -Infinity;

  const rotate = daySeed() % suggestions.length;
  const ranked = suggestions
    .map((s, i) => ({ s, turn: (i - rotate + suggestions.length) % suggestions.length }))
    .sort((a, b) => b.s.matchScore - a.s.matchScore || since(a.s) - since(b.s) || a.turn - b.turn)
    .map(({ s }) => s);
  const first = ranked[0];
  const second = ranked.find((s) => s !== first && FAMILY[s.kind] !== FAMILY[first.kind]) || ranked[1];
  const keys = [first.contentKey, second.contentKey];
  await db.setMeta(REQUIRED_META, { date: today, keys }).catch(() => {});
  return keys;
}

/** Finds a past entry that actually has a photo attached. */
async function findEntryWithPhoto(entries, seen = []) {
  const used = new Set(seen);
  const candidates = [...entries]
    .filter((e) => e.type === "journal" && !used.has(`photo:${e.id}`))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const entry of candidates.slice(0, 40)) {
    try {
      const photos = await db.getPhotosForEntry(entry.id);
      if (photos && photos.length) return { ...entry, photos };
    } catch {
      /* storage unavailable; skip */
    }
  }
  return null;
}

export async function logActivityCompletion(kind, detail) {
  await db.logActivity({
    id: newId(),
    date: new Date().toISOString(),
    kind,
    detail: detail || {},
  });
}
