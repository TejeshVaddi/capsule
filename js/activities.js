// Builds the day's activity list.
//
// Six kinds, all speech-or-typing:
//   naming      read a clue, name the thing (6 per set)
//   fluency     name as many things in a category as you can in 60s
//   word-recall read 5 words, do a filler task, recall them, then recognise
//   description a prompt to describe something, out loud or typed
//   photo-story one of your own photos, and the story behind it
//   music       a song title or era cue, and what it brings back (no audio)
//   bridge      the steps from one word to another (a path through meaning)
//   switching   one from each of two categories, turn about
//   chain       one everyday thing told in order, start to finish
//
// The set is seeded by the calendar date so it is stable through the day and
// changes at midnight. Ordering is influenced by detectSignals(), which
// compares recent entries to earlier ones.

import { db, newId } from "./data.js?v=6fe1a667df";
import {
  NAMING_SETS,
  FLUENCY_CATEGORIES,
  WORD_LISTS,
  DESCRIPTION_PROMPTS,
  PHOTO_PROMPTS,
  MUSIC_ERAS,
  OPEN_PROMPTS,
  BRIDGE_PAIRS,
  SWITCH_PAIRS,
  CHAIN_PROMPTS,
  pickFresh,
} from "./activities-content.js?v=6fe1a667df";
import { daySeed, dateKey, REQUIRED_META } from "./daily.js?v=6fe1a667df";
import { detectSignals, scoreForSignals } from "./signals.js?v=6fe1a667df";
import { buildFocus, weightFor } from "./focus.js?v=6fe1a667df";
import { currentRhythm } from "./rhythm.js?v=6fe1a667df";

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
const FAMILY = { naming: "words", fluency: "words", switching: "words", bridge: "words", "word-recall": "memory", description: "talk", "photo-story": "talk", music: "talk", chain: "talk" };

export async function suggestActivities(latestMetrics, recentEntries) {
  const seen = await recentKeys();
  // Seeded by the calendar day, so today's set is the same every time it is
  // opened and genuinely changes at midnight rather than on every render.
  const seed = daySeed() * 60000;
  const suggestions = [];

  // What has already been finished today, so it can be shown as done.
  const today = dateKey();
  const activityLog = await db.allActivityLog().catch(() => []);
  const doneToday = new Set(
    activityLog
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

  // How strongly each kind should come up for this person, from their own
  // speech, word graphs, memory visits and game scores. See focus.js.
  const rhythm = await currentRhythm(recentEntries);
  const focus = buildFocus(recentEntries, activityLog, { rhythm });

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

  // The kind of question (step by step, describe a scene, looking back) that
  // fits this person best right now, among the ones not asked lately.
  const freshPrompts = DESCRIPTION_PROMPTS.filter((p) => !seen.includes(`desc:${p.prompt}`));
  // Ties go round by day, so with nothing to lean on every kind takes turns.
  const kinds = [...new Set(freshPrompts.map((p) => p.kind))];
  const turn = daySeed() % Math.max(1, kinds.length);
  const bestKind = [...kinds.slice(turn), ...kinds.slice(0, turn)]
    .map((kind) => ({ kind, w: weightFor({ kind: "description", data: { kind } }, focus).weight }))
    .sort((a, b) => b.w - a.w)[0]?.kind;
  const prompt = pickFresh(freshPrompts.filter((p) => p.kind === bestKind), seen, (p) => `desc:${p.prompt}`, seed + 3);
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

  /* --- Word bridges: the way from one word to another --- */

  const bridge = pickFresh(BRIDGE_PAIRS, seen, (b) => `bridge:${b.from}-${b.to}`, seed + 6);
  if (bridge) suggestions.push({
    id: "bridge",
    kind: "bridge",
    title: `Word bridges: ${bridge.from} to ${bridge.to}`,
    tag: "Word finding",
    tailored: false,
    why: `Get from ${bridge.from} to ${bridge.to}, a step at a time.`,
    contentKey: `bridge:${bridge.from}-${bridge.to}`,
    data: bridge,
    real: true,
  });

  /* --- Two at a time: crossing between two kinds of thing --- */

  const pair = pickFresh(SWITCH_PAIRS, seen, (p) => `switch:${p.a}|${p.b}`, seed + 7);
  if (pair) suggestions.push({
    id: "switching",
    kind: "switching",
    title: "Two at a time",
    tag: "Word finding",
    tailored: false,
    why: `Name ${pair.a} and ${pair.b}, turn about, for 1 minute.`,
    contentKey: `switch:${pair.a}|${pair.b}`,
    data: pair,
    real: true,
  });

  /* --- Start to finish: one thing told in order --- */

  const chain = pickFresh(CHAIN_PROMPTS, seen, (c) => `chain:${c.prompt}`, seed + 8);
  if (chain) suggestions.push({
    id: "chain",
    kind: "chain",
    title: "Start to finish",
    tag: "Storytelling",
    tailored: false,
    why: `Tell how it goes, in order: ${chain.prompt.toLowerCase()}.`,
    contentKey: `chain:${chain.prompt}`,
    data: chain,
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

  // This is what orders the list and picks today's two.
  for (const s of suggestions) {
    s.doneToday = doneToday.has(s.contentKey);
    const { weight, area } = weightFor(s, focus);
    s.matchScore = weight;
    s.focusArea = area;
    // A clear shift also carries the reason, stated as a change in the
    // person's own patterns (kept for the record; the list does not show it).
    if (ready && signals.length && s.real) {
      const { score, reason } = scoreForSignals(s.kind, signals);
      s.pendingReason = score > 0 ? reason : null;
    }
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
