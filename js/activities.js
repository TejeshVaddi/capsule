// Tailored cognitive-engagement activities. These are supportive engagement,
// NOT treatment, nothing here claims to improve or slow anything.

import { db, newId } from "./data.js";

const NAMING_SETS = [
  { theme: "Kitchen", items: ["kettle", "spoon", "oven", "plate", "cup", "pan"] },
  { theme: "Garden", items: ["rose", "shovel", "soil", "seed", "leaf", "fence"] },
  { theme: "Weather", items: ["rain", "cloud", "wind", "snow", "sunshine", "storm"] },
  { theme: "Family occasions", items: ["birthday", "wedding", "picnic", "holiday", "dinner", "visit"] },
  { theme: "Around town", items: ["library", "market", "church", "park", "bakery", "station"] },
];

const DESCRIPTION_PROMPTS = [
  "Describe your favorite room in the house you grew up in.",
  "Describe a meal you love to cook or eat. What goes in it?",
  "Describe a place you've been on holiday. What did it look like?",
  "Describe your oldest friend. How did you meet?",
  "Describe what you can see out of your window right now.",
  "Describe a job you had, and what a normal day was like.",
];

const WORD_RECALL_LISTS = [
  ["apple", "table", "penny", "river", "candle"],
  ["garden", "mirror", "letter", "orange", "bridge"],
  ["window", "basket", "silver", "meadow", "button"],
  ["blanket", "lantern", "cherry", "harbor", "pillow"],
];

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

/**
 * Suggests activities tailored to the person's own recent patterns.
 * Tailoring compares their latest entry to their own recent average, never
 * to any external benchmark.
 */
export function suggestActivities(latestMetrics, recentEntries) {
  const suggestions = [];
  const seed = Date.now() >> 16;

  const priorJournal = recentEntries.filter((e) => e.type === "journal" && e.metrics);
  const avg = (key) => {
    const vals = priorJournal.slice(-10, -1).map((e) => e.metrics[key]).filter((v) => typeof v === "number");
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const reasons = [];

  const avgNoun = avg("nounRate");
  if (latestMetrics && avgNoun !== null && latestMetrics.nounRate < avgNoun * 0.85) {
    reasons.push("naming");
  }
  const avgVocab = avg("vocabRichness");
  if (latestMetrics && avgVocab !== null && latestMetrics.vocabRichness < avgVocab * 0.85) {
    reasons.push("variety");
  }
  const avgWords = avg("wordCount");
  if (latestMetrics && avgWords !== null && latestMetrics.wordCount < avgWords * 0.7) {
    reasons.push("detail");
  }

  // Naming exercise, prioritized when noun rate dipped vs. their own average
  const namingSet = pick(NAMING_SETS, seed);
  suggestions.push({
    id: "naming",
    kind: "naming",
    title: `Naming game: ${namingSet.theme}`,
    tag: reasons.includes("naming") ? "Picked for you" : "Word practice",
    tailored: reasons.includes("naming"),
    why: reasons.includes("naming")
      ? "Your last entry used fewer specific object words than your recent entries. This is a gentle way to reach for exact words."
      : "A relaxed exercise in finding exact words.",
    data: namingSet,
    real: true,
  });

  // Word recall game
  const recallList = pick(WORD_RECALL_LISTS, seed + 1);
  suggestions.push({
    id: "word-recall",
    kind: "word-recall",
    title: "Five-word memory game",
    tag: "Memory practice",
    tailored: false,
    why: "Read five words, let them settle, then see how many come back to you.",
    data: { words: recallList },
    real: true,
  });

  // Description prompt, prioritized when entries are getting shorter or vocabulary narrower
  const prompt = pick(DESCRIPTION_PROMPTS, seed + 2);
  suggestions.push({
    id: "description",
    kind: "description",
    title: "Description prompt",
    tag: reasons.includes("detail") || reasons.includes("variety") ? "Picked for you" : "Storytelling",
    tailored: reasons.includes("detail") || reasons.includes("variety"),
    why: reasons.includes("detail")
      ? "Your recent entries have been shorter than usual for you. This prompt invites a longer, detail-rich description."
      : reasons.includes("variety")
        ? "This prompt invites a wide range of words: colors, textures, places, feelings."
        : "An open prompt to describe something you know well.",
    data: { prompt },
    real: true,
  });

  // Well-designed placeholders (clearly marked as coming soon)
  suggestions.push({
    id: "photo-story",
    kind: "placeholder",
    title: "Photo story",
    tag: "Coming soon",
    tailored: false,
    why: "Pick one of your own photos and tell the story behind it: who was there, what happened before and after.",
    real: false,
  });

  suggestions.push({
    id: "music-moments",
    kind: "placeholder",
    title: "Music moments",
    tag: "Coming soon",
    tailored: false,
    why: "Listen to a song from a decade you choose and describe where it takes you.",
    real: false,
  });

  // Tailored ones first
  suggestions.sort((a, b) => (b.tailored ? 1 : 0) - (a.tailored ? 1 : 0));
  return suggestions;
}

export async function logActivityCompletion(kind, detail) {
  await db.logActivity({
    id: newId(),
    date: new Date().toISOString(),
    kind,
    detail: detail || {},
  });
}
