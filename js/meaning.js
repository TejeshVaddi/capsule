// What a change in one of Capsule's measures actually means, in plain words.
//
// A line like "your entries are using fewer specific naming words" is true
// and, on its own, useless: it does not say what naming words do, or why
// fewer of them matters. So every measure carries an explanation, and the
// explanation is always about the entries themselves, never about the
// person's health.
//
// Three rules hold this text together:
//   Accurate. Naming words really are what pins a day down, and a narrower
//   range of words really does make days read alike. Nothing here claims a
//   cause, a diagnosis, or anything about the brain, because a journal
//   cannot show those.
//   Softer when it is bad news. A change that makes looking back harder is
//   said plainly once, and then followed by what Capsule is already doing
//   about it: more of the activities that give practice in that exact
//   thing. That is a fact about the app, not a promise about the person.
//   Louder when it is good news. A change the good way is worth saying out
//   loud, with what it means for looking back at a day.
//
// Nothing here promises improvement. "We will work on it together" is a
// promise to keep practising, which Capsule can keep.

/**
 * key: the measure. up/down: what more or less of it means.
 *   means   what the change means for the entries and for looking back
 *   work    what Capsule does about it, said only for the harder direction
 * Every "hard" reading has a `work` line; no measure is left as bad news
 * with nothing after it.
 */
const MEANINGS = {
  wordCount: {
    up: { tone: "good", means: "Entry length is how much of a day you put into words. Longer entries keep more of the day: more of the people, the places and the small things. That matters later, because a memory visit can only hand back what the entry holds, so a fuller entry gives you more to recognise." },
    down: { tone: "hard", means: "Entry length is how much of a day you put into words. Shorter entries keep less of it, and what is not written down is not there to come back to. A memory visit can only work from what the entry holds, so there are fewer hooks to bring the day back.", work: "Capsule will bring you more questions that invite you to say a little more, and the questions themselves give you somewhere to start. We can work on this together." },
    steady: { tone: "steady", means: "Your entries have kept about as much of each day as before." },
  },
  nounRate: {
    up: { tone: "good", means: "Naming words are the ones that pin a day down: Margaret, the market, the blue gate. More of them means your entries say who was there and where you went, not just that something happened. Those exact words are the best hooks for bringing a day back later, and the easiest for someone else to follow." },
    down: { tone: "hard", means: "Naming words are the ones that pin a day down: Margaret, the market, the blue gate. Fewer of them means an entry says what happened in general instead of who and where. That is the hardest kind of entry to use later, because there is nothing exact to catch hold of, and it is harder for family to picture what you mean.", work: "Capsule will bring you more naming games and word games, which are practice at the reach for an exact word. We can work on this together." },
    steady: { tone: "steady", means: "Your entries have named people, places and things about as often as before." },
  },
  pronounRate: {
    up: { tone: "hard", means: "Words like it, they and that stand in for a name you would otherwise say. When more of them turn up in place of the names, the day still gets written down, but without the parts that identify it. Read back a week later, an entry of stand-in words can belong to almost any day, so it gives you little to recognise, and a listener has to guess who or what you meant.", work: "Capsule will bring you more naming games, where the whole task is finding the exact word. We can work on this together." },
    down: { tone: "good", means: "Words like it, they and that stand in for names. Fewer of them means more of your entries say who and what outright, so a day reads as its own day when you come back to it, and nobody has to guess what you meant." },
    steady: { tone: "steady", means: null },
  },
  vocabRichness: {
    up: { tone: "good", means: "This is how wide a range of words your entries draw on. A wider range means your days read differently from one another, which is what makes one day findable among many rather than blurring into the rest." },
    down: { tone: "hard", means: "This is how wide a range of words your entries draw on. A narrower range means more days are described in the same handful of words, and days described alike are hard to tell apart when you look back: the entry no longer says which day it was.", work: "Capsule will bring you more word games that ask for many different words at once, which is practice at reaching past the first word that comes. We can work on this together." },
    steady: { tone: "steady", means: "The range of words in your entries has stayed about the same." },
  },
  graphLinksBack: {
    up: { tone: "good", means: "This counts how often your words come back round to one another inside an entry, tying the parts of a day together. More of it means a day reads as one story, with each part leading to the next, which is easier to follow and easier to bring back whole rather than in pieces." },
    down: { tone: "hard", means: "This counts how often your words come back round to one another inside an entry. Less of it means a day reads as separate remarks rather than one story. Remembering tends to work by one thing leading to the next, so an entry with nothing tying it together gives that less to run on.", work: "Capsule will bring you more activities that ask for something told in order, start to finish, which is practice at tying one part to the next. We can work on this together." },
    steady: { tone: "steady", means: null },
  },
  graphRepetition: {
    up: { tone: "hard", means: "This counts how often the same words come round again inside one entry. When a few words carry most of a day, the other parts of it are not being written down, so the entry keeps less than it looks like it does.", work: "Capsule will bring you more activities that ask for many different words, which is practice at reaching for the next word rather than the one already used. We can work on this together." },
    down: { tone: "good", means: "This counts how often the same words come round again inside one entry. Fewer repeats means more of the day is being said in its own words, so the entry keeps more of what actually happened." },
    steady: { tone: "steady", means: null },
  },
  disfluencyRate: {
    up: { tone: "hard", means: "This counts the ums, the uhs and words said twice in a row. More of them usually means the word you were reaching for did not come as quickly that day. It does not change what the entry keeps, and everybody has days like this, so it is the weakest thing here. Capsule counts it itself and it is not a research-backed measure.", work: "Capsule will bring you more naming and word games, which are practice at that reach. We can work on this together." },
    down: { tone: "good", means: "This counts the ums, the uhs and words said twice in a row. Fewer of them usually means the words have been coming more easily when you speak." },
    steady: { tone: "steady", means: null },
  },
  recallDetail: {
    up: { tone: "good", means: "This is how much of a day comes back in a memory visit, in your own words rather than from the notes Capsule shows you. More of it means more of the day returned to you unprompted, which is the thing these visits are for." },
    down: { tone: "hard", means: "This is how much of a day comes back in a memory visit, in your own words rather than from the notes. Less of it means fewer of that day's own details returned unprompted. It is a handful of visits about particular days, nothing more, and how much comes back also depends on how much the entry held in the first place.", work: "Capsule will bring you more memory games and photo stories, and it will keep the notes at the amount of help that suits you, so a visit stays possible rather than becoming a test. We can work on this together." },
    steady: { tone: "steady", means: "About as much of a day has been coming back in your memory visits as before." },
  },
  // Games, used by the monthly note.
  naming: { up: { tone: "good", means: "Finding a word from its description is the same reach a name asks for when you are telling someone about your day." } },
  fluency: { up: { tone: "good", means: "Naming many things in a minute draws on how widely your words connect to one another, which is what you lean on when you are searching for one." } },
  switching: { up: { tone: "good", means: "Crossing between two subjects and back is harder than staying in one, and it is what a day full of different things asks of you." } },
  bridge: { up: { tone: "good", means: "A longer bridge between two words means you travelled further through what they have to do with each other, which is the same path a memory takes when one thing reminds you of another." } },
  chain: { up: { tone: "good", means: "Telling something start to finish is practice at tying one part to the next, which is how a day comes back whole rather than in pieces." } },
  "word-recall": { up: { tone: "good", means: "Holding five new words through a distraction and bringing them back is the plainest measure of new memory in the app." } },
  description: { up: { tone: "good", means: "Saying more in answer to a question means more of the thought reaches words, and what reaches words is what can be kept." } },
};

/**
 * The plain meaning of one change.
 * `direction` is "up", "down" or "steady" for the measure itself, not for
 * whether that is good news; the table knows which way is which.
 * Returns { tone, means, work } or null when there is nothing worth saying.
 */
export function explain(key, direction) {
  const entry = MEANINGS[key]?.[direction];
  if (!entry || !entry.means) return null;
  return { tone: entry.tone, means: entry.means, work: entry.work || null };
}

/**
 * The word a person should see on a change before they read anything else:
 * is this one going well, or is it one to work on? Said in the plainest
 * words available, and never as a verdict on the person.
 */
export const TONE_WORDS = {
  good: "Going well",
  hard: "One to work on",
  steady: "Holding steady",
};

/** A closing line for a set of changes, matched to how they went overall. */
export function closingLine({ hard = 0, good = 0 } = {}) {
  if (hard && good) return "Some of this went one way and some the other, which is how most months look. Capsule leans your activities towards the parts that were harder.";
  if (hard) return "None of this is a verdict on you, and none of it is a health result. Capsule will lean your activities towards these, and we can work on them together.";
  if (good) return "That is the kind of change that makes a day easier to bring back later. Keep going as you are.";
  return null;
}
