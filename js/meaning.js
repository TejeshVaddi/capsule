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
 * Each measure, in three parts a person can actually use:
 *   what   what the thing being measured is
 *   means  what more or less of it means for the entries
 *   helps  what working on it does for you
 *   work   what Capsule does about it, on the harder direction only
 * One short example at most. A wall of examples reads as padding.
 */
const MEANINGS = {
  wordCount: {
    up: {
      tone: "good",
      what: "Entry length is how many words you put into a day.",
      means: "Longer entries hold more of what happened: more people, more places, more of the small things.",
      helps: "A fuller entry gives you more to recognise when you come back to it, and gives your family more of the day to share.",
    },
    down: {
      tone: "hard",
      what: "Entry length is how many words you put into a day.",
      means: "Shorter entries hold less of what happened, and what is not said is not saved.",
      helps: "Saying a few more sentences about each day keeps more of it, and a memory visit can only hand back what the entry holds.",
      work: "Capsule will bring you more questions that invite you to say a little more. We can work on this together.",
    },
    steady: { tone: "steady", what: "Entry length is how many words you put into a day.", means: "Your entries have held about as much as before.", helps: null },
  },
  nounRate: {
    up: {
      tone: "good",
      what: "Naming words are nouns: the people, places, things and ideas in a day.",
      means: "More of them means your entries say exactly who was there and where you went, not just that something happened.",
      helps: "Exact words are what let you tell one day from another later, and what let someone else picture it with you.",
    },
    down: {
      tone: "hard",
      what: "Naming words are nouns: the people, places, things and ideas in a day.",
      means: "Fewer of them means your entries describe a day in general terms rather than naming what was in it.",
      helps: "Reaching for the exact word helps you say what you feel, talk about particular people, and point to the places and things you mean.",
      work: "Capsule will bring you more naming games and word games, which are practice at reaching for an exact word. We can work on this together.",
    },
    steady: { tone: "steady", what: "Naming words are nouns: the people, places, things and ideas in a day.", means: "Your entries have named them about as often as before.", helps: null },
  },
  pronounRate: {
    up: {
      tone: "hard",
      what: "Stand-in words are pronouns: it, they, that, them.",
      means: "More of them in place of names means the day is written down without the parts that say which day it was.",
      helps: "Swapping a stand-in word for the name it replaced makes an entry belong to one day, and saves the listener guessing who you meant.",
      work: "Capsule will bring you more naming games, where the whole task is finding the exact word. We can work on this together.",
    },
    down: {
      tone: "good",
      what: "Stand-in words are pronouns: it, they, that, them.",
      means: "Fewer of them means more of your entries say who and what outright.",
      helps: "A day written in its own names reads as that day and nobody else's, however long afterwards you come back to it.",
    },
    steady: { tone: "steady", what: null, means: null, helps: null },
  },
  vocabRichness: {
    up: {
      tone: "good",
      what: "This is how many different words your entries draw on.",
      means: "A wider range means you are describing days in their own words rather than a standard few.",
      helps: "Days described differently stay separate in your mind and in your journal, so one is easier to find again.",
    },
    down: {
      tone: "hard",
      what: "This is how many different words your entries draw on.",
      means: "A narrower range means more days are being described with the same handful of words.",
      helps: "Reaching past the first word that comes keeps your days distinct, which is what stops them blurring together when you look back.",
      work: "Capsule will bring you more word games that ask for many different words at once. We can work on this together.",
    },
    steady: { tone: "steady", what: "This is how many different words your entries draw on.", means: "The range has stayed about the same.", helps: null },
  },
  graphLinksBack: {
    up: {
      tone: "good",
      what: "This counts how often your words come back round to one another inside an entry.",
      means: "More of it means the parts of a day are tied together rather than listed one after another.",
      helps: "Remembering runs on one thing leading to the next, so a day told as one story comes back whole rather than in pieces.",
    },
    down: {
      tone: "hard",
      what: "This counts how often your words come back round to one another inside an entry.",
      means: "Less of it means a day reads as separate remarks with nothing joining them.",
      helps: "Saying how one part led to the next gives your memory a thread to follow back later.",
      work: "Capsule will bring you more activities that ask for something told in order, start to finish. We can work on this together.",
    },
    steady: { tone: "steady", what: null, means: null, helps: null },
  },
  graphRepetition: {
    up: {
      tone: "hard",
      what: "This counts how often the same words come round again inside one entry.",
      means: "When a few words carry most of a day, the rest of it is not being written down.",
      helps: "Finding a second word for the same thing puts more of the day on the page, where it can be found again.",
      work: "Capsule will bring you more activities that ask for many different words. We can work on this together.",
    },
    down: {
      tone: "good",
      what: "This counts how often the same words come round again inside one entry.",
      means: "Fewer repeats means more of the day is being said in its own words.",
      helps: "Every word that is not a repeat is another part of the day kept.",
    },
    steady: { tone: "steady", what: null, means: null, helps: null },
  },
  disfluencyRate: {
    up: {
      tone: "hard",
      what: "This counts the ums, the uhs, and words said twice in a row.",
      means: "More of them usually means the word you wanted did not arrive as quickly that day.",
      helps: "It does not change what your entry keeps, and everyone has days like this, so it is the weakest thing on this page. Capsule counts it itself and it is not a research-backed measure.",
      work: "Capsule will bring you more naming and word games, which are practice at that reach. We can work on this together.",
    },
    down: {
      tone: "good",
      what: "This counts the ums, the uhs, and words said twice in a row.",
      means: "Fewer of them usually means the words have been arriving more easily.",
      helps: null,
    },
    steady: { tone: "steady", what: null, means: null, helps: null },
  },
  recallDetail: {
    up: {
      tone: "good",
      what: "This is how much of a day comes back in a memory visit, in your own words rather than from the notes Capsule shows you.",
      means: "More of it means more of the day returned to you unprompted.",
      helps: "That is the whole point of a visit: not being told the day, but finding it.",
    },
    down: {
      tone: "hard",
      what: "This is how much of a day comes back in a memory visit, in your own words rather than from the notes Capsule shows you.",
      means: "Less of it means fewer of that day's own details came back unprompted.",
      helps: "How much returns also depends on how much the entry held to begin with, so a fuller entry gives a visit more to work with. This is a handful of visits about particular days, nothing more.",
      work: "Capsule will bring you more memory games and photo stories, and will keep the notes at the amount of help that suits you. We can work on this together.",
    },
    steady: { tone: "steady", what: null, means: "About as much has been coming back as before.", helps: null },
  },
  // Games, used by the monthly note.
  naming: { up: { tone: "good", means: "Finding a word from its description is the same reach a name asks for when you are telling someone about your day." } },
  fluency: { up: { tone: "good", means: "Naming many things in a minute draws on how widely your words connect to one another, which is what you lean on when searching for one." } },
  switching: { up: { tone: "good", means: "Crossing between two subjects and back is harder than staying in one, and it is what a day full of different things asks of you." } },
  bridge: { up: { tone: "good", means: "Getting from one word to another is the same path a memory takes when one thing reminds you of another." } },
  chain: { up: { tone: "good", means: "Telling something start to finish is practice at tying one part to the next." } },
  "word-recall": { up: { tone: "good", means: "Holding five new words through a distraction is the plainest measure of new memory in the app." } },
  description: { up: { tone: "good", means: "What reaches words is what can be kept." } },
};

/**
 * The plain meaning of one change: { tone, what, means, helps, work }.
 * `direction` is the measure's own direction, not whether it is good news;
 * the table knows which way is which. Null when there is nothing to say.
 */
export function explain(key, direction) {
  const entry = MEANINGS[key]?.[direction];
  if (!entry || (!entry.means && !entry.what)) return null;
  return {
    tone: entry.tone,
    what: entry.what || null,
    means: entry.means || null,
    helps: entry.helps || null,
    work: entry.work || null,
  };
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
