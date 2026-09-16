// How Capsule leans the day's activities toward what will stretch this
// person the most.
//
// Everything here compares the person only with their own past: their
// entries (including the word-graph measures), their memory visits, and how
// their own games have gone. Nothing is compared with anyone else, nothing
// is a diagnosis, and a lean is never presented as a finding. It only
// decides which activities come up more often.
//
// Four inputs, each read as "has this slipped compared with this person's
// own earlier weeks?", on a 0 to 1 scale:
//   - speech trends from journal entries (naming words, general words,
//     length, variety of words)
//   - the word graph: returning to the same words (repeated edges), and how
//     well words link back to one another (largest strongly connected
//     component and links per word, measured fairly; see analysis.js)
//   - memory visits: how much of the day came back
//   - the games themselves: recent scores against the person's own usual
// Two more keep things stimulating rather than repetitive: a game that has
// become too easy comes up less, and a kind not tried for a while gets a
// turn. With no history yet, every kind gets an equal turn.

import { windowSamples } from "./analysis.js?v=2c10b0dede";
import { topicsPer100Words } from "./summary.js?v=2c10b0dede";
import { comparableRecalls } from "./recall.js?v=2c10b0dede";
import { dateKey } from "./daily.js?v=2c10b0dede";
import { RHYTHMS } from "./rhythm.js?v=2c10b0dede";
import { DESCRIPTION_PROMPTS } from "./activities-content.js?v=2c10b0dede";

/**
 * The areas an activity can give more practice in, and how well each kind
 * of activity fits each one (1 = best fit).
 */
export const FOCUS_AREAS = {
  // Reaching a particular word: the points of the graph.
  naming: {
    label: "Finding the names of things",
    term: "Naming words",
    helps: "finding the exact word for a person, a place or a thing",
    fits: { naming: 1, fluency: 0.5, bridge: 0.5 },
  },
  // How many different words get used, and how often the same ones come
  // back: the spread of the graph, and its repeated steps.
  variety: {
    label: "Using a wide range of words",
    term: "Range of words",
    helps: "using different words instead of the same few over and over",
    fits: { fluency: 1, switching: 0.8, scene: 0.5, open: 0.4, naming: 0.3 },
  },
  // Ideas tied to one another rather than listed: the graph's links back.
  linking: {
    label: "Linking one idea to the next",
    term: "Connections between ideas",
    helps: "telling something in order, so one part leads into the next",
    fits: { chain: 1, procedural: 1, scene: 0.8, "photo-story": 0.7, open: 0.6, reminiscence: 0.5, music: 0.4 },
  },
  // Crossing from one patch of meaning to another, and the distance
  // between two ideas: switching, and the path across the graph.
  crossing: {
    label: "Moving between different subjects",
    term: "Switching between subjects",
    helps: "switching from one subject to a different one and back",
    fits: { switching: 1, bridge: 0.9, fluency: 0.3, procedural: 0.3 },
  },
  detail: {
    label: "Saying more about each thing",
    term: "Detail",
    helps: "describing one thing fully: who was there, where it was, what happened",
    fits: { reminiscence: 0.9, "photo-story": 0.9, music: 0.8, open: 0.7, scene: 0.6, chain: 0.6, procedural: 0.5 },
  },
  memory: {
    label: "Holding on to new things",
    term: "New memory",
    helps: "holding new words in mind for a few minutes, then bringing them back",
    fits: { "word-recall": 1, "photo-story": 0.6, music: 0.3, reminiscence: 0.3 },
  },
};

// Where a lean came from, in words a person would use. Shown so nobody has
// to take Capsule's word for what it noticed.
export const EVIDENCE_WORDS = {
  "naming words": "how often your entries name people, places and things",
  "general words": "how often your entries use words like it and they",
  "entry length": "how much your entries hold",
  "word graph: repeated steps": "how often the same words come round again",
  "word graph: links back": "how much your words tie back to one another",
  "word graph: links per word": "how much your words lead into one another",
  "variety of words": "the range of words in your entries",
  "moving between subjects": "how much your entries move from one thing to another",
  "memory visits": "how much of a day comes back in your memory visits",
  "naming scores": "your scores in the naming game",
  "fluency scores": "your scores in how many can you name",
  "switching scores": "your scores in two at a time",
  "bridge scores": "your word bridges",
  "chain scores": "your start to finish answers",
  "word-recall scores": "your scores in the five-word memory game",
  "description scores": "how much you say in answer to a question",
  "photo-story scores": "how much you say about a photo",
  "music scores": "how much you say about a song",
};

/** The area an activity gives the most practice in, whatever the person needs. */
export function mainAreaOf(slot) {
  let best = null;
  let bestFit = 0;
  for (const [key, area] of Object.entries(FOCUS_AREAS)) {
    const fit = area.fits[slot] || 0;
    if (fit > bestFit) { bestFit = fit; best = key; }
  }
  return best;
}

// A need at or above this is worth telling the person about by name.
export const NOTABLE_NEED = 0.3;

// Which slot of the plan an activity fills. Questions are split by what they
// ask for: a step-by-step question is a different workout from a memory.
export function slotOf(s) {
  if (s.kind !== "description") return s.kind;
  if (s.data?.kind === "open") return "open";
  return s.data?.kind || "scene";
}

export const SLOT_NAMES = {
  naming: "Naming game",
  fluency: "How many can you name",
  switching: "Two at a time",
  bridge: "Word bridges",
  chain: "Start to finish",
  "word-recall": "Five-word memory game",
  procedural: "Step by step",
  scene: "Describe the scene",
  reminiscence: "Looking back",
  open: "A question for you",
  "photo-story": "Photo story",
  music: "Music moments",
};

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const nums = (a) => a.filter((v) => typeof v === "number" && !Number.isNaN(v));

/**
 * How far recent values have moved the "harder" way from the earlier ones,
 * in units of the person's own spread: 0 = no slip, 1 = a clear slip.
 * `worse` is "down" when lower means harder (naming words) and "up" when
 * higher does (general words).
 */
function slip(recent, earlier, worse) {
  recent = nums(recent);
  earlier = nums(earlier);
  if (recent.length < 3 || earlier.length < 3) return 0;
  const spread = Math.sqrt((sd(recent) ** 2 + sd(earlier) ** 2) / 2) || Math.abs(mean(earlier)) * 0.1 || 1;
  const d = ((mean(recent) - mean(earlier)) / spread) * (worse === "down" ? -1 : 1);
  // Few samples can differ by chance, and a dozen comparisons are made at
  // once, so the difference must be clear for the number of samples behind
  // it (a t-value of 2.5 or more) before anything leans on it.
  const t = d / Math.sqrt(1 / recent.length + 1 / earlier.length);
  if (t < 2.5) return 0;
  // Under about three quarters of a spread is ordinary wobble; from there to
  // nearly two spreads it counts for more and more.
  return clamp01((d - 0.75) / 1.0);
}

/**
 * Splits a time-ordered list into a recent part and the person's earlier
 * level: the first half of their history (up to `earlierMax` items).
 * Comparing with that, rather than with the weeks just gone, means an area
 * that has stayed harder for a while keeps getting more room, instead of
 * the harder weeks quietly becoming the new normal.
 */
function halves(list, recentMax = 7, earlierMax = 60) {
  if (list.length < 6) return null;
  const recentSize = Math.min(recentMax, Math.max(3, Math.floor(list.length / 3)));
  const firstHalf = Math.max(3, Math.min(Math.floor(list.length / 2), list.length - recentSize));
  return {
    recent: list.slice(-recentSize),
    earlier: list.slice(0, firstHalf).slice(0, earlierMax),
  };
}

// What each game records as its score, as a share where that makes sense.
const SCORE_OF = {
  naming: (d) => (d.total ? d.gotten / d.total : null),
  fluency: (d) => (typeof d.count === "number" ? d.count : null),
  switching: (d) => (typeof d.switches === "number" ? d.switches : null),
  bridge: (d) => (typeof d.distinctWords === "number" ? d.distinctWords : null),
  chain: (d) => d.wordCount,
  "word-recall": (d) => (d.total ? d.found / d.total : null),
  description: (d) => d.wordCount,
  "photo-story": (d) => d.wordCount,
  music: (d) => d.wordCount,
};
// Which area a slip in each game's score points to.
const GAME_AREA = { naming: "naming", fluency: "variety", switching: "crossing", bridge: "crossing", chain: "linking", "word-recall": "memory", description: "detail", "photo-story": "detail", music: "detail" };
// A game counts as too easy when the last three were all at or near full marks.
const CEILING = { naming: 1, "word-recall": 0.9 };

/**
 * The person's plan: { ready, areas: { key: need }, top: [area keys],
 * easy: Set of slots, lastDone: Map slot -> time, requiredYesterday: Set }.
 */
export function buildFocus(entries, activityLog, { now = new Date(), rhythm = RHYTHMS.daily } = {}) {
  const journals = entries.filter((e) => e.type === "journal" && e.metrics)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const areas = { naming: 0, variety: 0, linking: 0, crossing: 0, detail: 0, memory: 0 };
  const evidence = [];
  const raise = (area, amount, source) => {
    if (amount > areas[area]) areas[area] = amount;
    if (amount > 0) evidence.push({ area, amount, source });
  };

  // Speech trends and the word graph, from journal entries.
  const j = halves(journals);
  if (j) {
    const m = (list, f) => list.map((e) => f(e.metrics));
    raise("naming", slip(m(j.recent, (x) => x.nounRate), m(j.earlier, (x) => x.nounRate), "down"), "naming words");
    raise("naming", slip(m(j.recent, (x) => x.pronounRate), m(j.earlier, (x) => x.pronounRate), "up"), "general words");
    raise("detail", slip(m(j.recent, (x) => x.wordCount), m(j.earlier, (x) => x.wordCount), "down"), "entry length");
    raise("variety", slip(m(j.recent, (x) => x.graph?.meanEdgeWeight), m(j.earlier, (x) => x.graph?.meanEdgeWeight), "up"), "word graph: repeated steps");
  }
  // The word graph and variety of words, in separate same-length stretches
  // of text: recent entries against everything before them.
  if (j) {
    const recent = windowSamples(j.recent.map((e) => e.text));
    const earlier = windowSamples(j.earlier.map((e) => e.text));
    const of = (list, key) => list.map((w) => w[key]);
    raise("linking", slip(of(recent, "linksBack"), of(earlier, "linksBack"), "down"), "word graph: links back");
    raise("linking", slip(of(recent, "linksPerWord"), of(earlier, "linksPerWord"), "down"), "word graph: links per word");
    raise("variety", slip(of(recent, "variety"), of(earlier, "variety"), "down"), "variety of words");
    // How much the entries move from one thing to another.
    raise("crossing",
      slip(j.recent.map((e) => topicsPer100Words(e.text)), j.earlier.map((e) => topicsPer100Words(e.text)), "down"),
      "moving between subjects");
  }

  // Memory visits, compared only with visits that had the same help.
  const visits = comparableRecalls(entries.filter((e) => e.type === "recall" && e.recallComparison))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const v = halves(visits, 4);
  if (v) raise("memory", slip(v.recent.map((e) => e.recallComparison.overlapRatio), v.earlier.map((e) => e.recallComparison.overlapRatio), "down"), "memory visits");

  // The games: recent scores against the person's own usual for that game.
  const log = [...activityLog].sort((a, b) => new Date(a.date) - new Date(b.date));
  const easy = new Set();
  for (const [kind, score] of Object.entries(SCORE_OF)) {
    const scores = log.filter((r) => r.kind === kind).map((r) => score(r.detail || {})).filter((x) => typeof x === "number");
    if (scores.length >= 8) {
      const recent = scores.slice(-4);
      const earlier = scores.slice(0, Math.min(Math.floor(scores.length / 2), scores.length - 4)).slice(0, 30);
      raise(GAME_AREA[kind], slip(recent, earlier, "down"), `${kind} scores`);
    }
    if (CEILING[kind] !== undefined && scores.length >= 3 && scores.slice(-3).every((x) => x >= CEILING[kind])) easy.add(kind);
  }

  // When each slot was last done, and which were yesterday's two.
  const lastDone = new Map();
  for (const r of log) {
    const slot = slotFromKey(r.detail?.contentKey, r.kind);
    if (slot) lastDone.set(slot, new Date(r.date).getTime());
  }

  const top = Object.entries(areas).filter(([, n]) => n >= 0.25).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  return {
    ready: journals.length >= 6 || log.length >= 6,
    areas,
    top,
    evidence: evidence.sort((a, b) => b.amount - a.amount),
    easy,
    lastDone,
    today: dateKey(now),
    now: now.getTime(),
    rhythm,
  };
}

// Content keys start with the kind of content ("desc:", "open:", "naming:").
// A question's kind (step by step, scene, looking back) is found from its
// prompt.
const DESC_KINDS = new Map(DESCRIPTION_PROMPTS.map((p) => [p.prompt, p.kind]));
function slotFromKey(key, kind) {
  if (!key) return kind || null;
  const [type, ...rest] = key.split(":");
  const body = rest.join(":");
  if (type === "desc") return DESC_KINDS.get(body) || "scene";
  if (type === "open") return "open";
  if (type === "words") return "word-recall";
  if (type === "bridge") return "bridge";
  if (type === "switch") return "switching";
  if (type === "chain") return "chain";
  if (type === "photo") return "photo-story";
  return { naming: "naming", fluency: "fluency", music: "music" }[type] || kind || null;
}

/**
 * How strongly an activity should come up today. 1 is an ordinary turn.
 * Returns { weight, area } where `area` is the focus it serves best.
 * `steady` leaves out the day-to-day turn-taking, for showing the plan.
 */
export function weightFor(s, focus, { steady = false } = {}) {
  const slot = slotOf(s);
  // The area this kind fits best counts in full, a second one by a third,
  // and the rest a little, so an activity that suits everything a bit never
  // crowds out the one that suits the main need.
  const gains = Object.entries(focus.areas)
    .map(([key, need]) => ({ key, gain: need * (FOCUS_AREAS[key].fits[slot] || 0) }))
    .sort((a, b) => b.gain - a.gain);
  let weight = 1 + 1.5 * gains[0].gain + 0.5 * gains[1].gain + 0.2 * gains.slice(2).reduce((sum, g) => sum + g.gain, 0);
  const best = gains[0].key;
  const bestGain = gains[0].gain * 1.5;
  // Too easy lately: still offered, but less often one of the two.
  if (focus.easy.has(s.kind)) weight -= 0.4;
  // Turn-taking runs on the person's own rhythm: for someone who writes
  // once a week, "done last time" means a week ago, not a day ago.
  const r = focus.rhythm || RHYTHMS.daily;
  const last = steady ? null : focus.lastDone.get(slot);
  if (last === null) { /* the steady plan: no turn-taking */ }
  else if (last === undefined) weight += 0.3;
  // Not done for several turns, or never: a fresh kind is stimulating too.
  else if (focus.now - last > r.freshAfterDays * 86400000) weight += 0.2;
  // Done last time: step well aside, so even the most needed kind comes
  // every other turn and another that serves the same need fills the gap.
  else if (focus.now - last < r.stepAsideDays * 86400000) weight *= 0.6;
  return { weight: Math.max(0.1, weight), area: bestGain >= 0.3 ? best : null };
}
