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

import { db, newId } from "./data.js";
import {
  NAMING_SETS,
  FLUENCY_CATEGORIES,
  WORD_LISTS,
  DESCRIPTION_PROMPTS,
  PHOTO_PROMPTS,
  MUSIC_ERAS,
  OPEN_PROMPTS,
  pickFresh,
} from "./activities-content.js";
import { daySeed, dateKey } from "./daily.js";
import { detectSignals, scoreForSignals } from "./signals.js";

/** Recent activity keys, so the same content is not served twice running. */
async function recentKeys(limit = 14) {
  try {
    const log = await db.allActivityLog();
    return log.slice(0, limit).map((r) => r.detail?.contentKey).filter(Boolean);
  } catch {
    return [];
  }
}

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
  suggestions.push({
    id: "naming",
    kind: "naming",
    title: `Naming game: ${namingSet.theme}`,
    tag: reasons.has("naming") ? "Picked for you" : "Word finding",
    tailored: reasons.has("naming"),
    why: reasons.has("naming")
      ? "Your last entry used fewer specific naming words than your recent ones."
      : "Read a description, name the thing it describes. Six of them, speech or typing.",
    contentKey: `naming:${namingSet.theme}`,
    data: namingSet,
    real: true,
  });

  const fluency = pickFresh(FLUENCY_CATEGORIES, seen, (f) => `fluency:${f.category}`, seed + 1);
  suggestions.push({
    id: "fluency",
    kind: "fluency",
    title: `How many can you name: ${fluency.category}`,
    tag: reasons.has("variety") ? "Picked for you" : "Word finding",
    tailored: reasons.has("variety"),
    why: reasons.has("variety")
      ? "Your recent entries have drawn on a narrower set of words than usual for you."
      : "Name as many things in one category as you can in a minute.",
    contentKey: `fluency:${fluency.category}`,
    data: fluency,
    real: true,
  });

  /* --- Memory family --- */

  const list = pickFresh(WORD_LISTS, seen, (l) => `words:${l.words[0]}`, seed + 2);
  suggestions.push({
    id: "word-recall",
    kind: "word-recall",
    title: "Five-word memory game",
    tag: "Memory",
    tailored: false,
    why: "Read five words, do a short task, then recall as many as you can.",
    contentKey: `words:${list.words[0]}`,
    data: list,
    real: true,
  });

  /* --- Description family --- */

  const prompt = pickFresh(DESCRIPTION_PROMPTS, seen, (p) => `desc:${p.prompt}`, seed + 3);
  const descTailored = reasons.has("detail") || reasons.has("variety");
  suggestions.push({
    id: "description",
    kind: "description",
    title: prompt.kind === "procedural" ? "Step by step" : prompt.kind === "reminiscence" ? "Looking back" : "Describe the scene",
    tag: descTailored ? "Picked for you" : prompt.kind === "reminiscence" ? "Memories" : "Storytelling",
    tailored: descTailored,
    why: reasons.has("detail")
      ? "Your recent entries have been shorter than usual for you."
      : prompt.kind === "procedural"
        ? "Describe a familiar routine in order, step by step."
        : prompt.kind === "reminiscence"
          ? "A question about your own past. Answer out loud or type it."
          : "Describe a scene in as much detail as you like.",
    contentKey: `desc:${prompt.prompt}`,
    data: { prompt: prompt.prompt, kind: prompt.kind },
    real: true,
  });

  /* --- Photo story: only offered when they actually have a photo --- */

  const photoEntry = await findEntryWithPhoto(recentEntries);
  if (photoEntry) {
    const photoPrompt = PHOTO_PROMPTS[Math.abs(Math.floor(seed / 60000)) % PHOTO_PROMPTS.length];
    suggestions.push({
      id: "photo-story",
      kind: "photo-story",
      title: "Photo story",
      tag: "Memories",
      tailored: false,
      why: "A photo from your journal, and the story behind it. Shows what you wrote that day afterwards.",
      contentKey: `photo:${photoEntry.id}`,
      data: { entry: photoEntry, prompt: photoPrompt },
      real: true,
    });
  }

  /* --- Music moments --- */

  const era = pickFresh(MUSIC_ERAS, seen, (e) => `music:${e.era}`, seed + 4);
  suggestions.push({
    id: "music-moments",
    kind: "music",
    title: `Music moments: ${era.era}`,
    tag: "Memories",
    tailored: false,
    why: "Pick a song title or a place from a decade, and say what it brings back. No audio.",
    contentKey: `music:${era.era}`,
    data: era,
    real: true,
  });

  /* --- An open question, with no right answer --- */

  const open = pickFresh(OPEN_PROMPTS, seen, (p) => `open:${p.prompt}`, seed + 5);
  suggestions.push({
    id: "open",
    kind: "description",
    title: "A question for you",
    tag: "Just talking",
    tailored: false,
    why: "An open question about your life. Say as much or as little as you like.",
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
      s.why = s.pendingReason.invite;
      s.because = s.pendingReason.because;
      s.signalKey = s.pendingReason.key;
    });

  suggestions.sort((a, b) => {
    if (a.doneToday !== b.doneToday) return a.doneToday ? 1 : -1;
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return (b.tailored ? 1 : 0) - (a.tailored ? 1 : 0);
  });
  return suggestions;
}

/** Finds a past entry that actually has a photo attached. */
async function findEntryWithPhoto(entries) {
  const candidates = [...entries].filter((e) => e.type === "journal").reverse();
  for (const entry of candidates.slice(0, 25)) {
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
