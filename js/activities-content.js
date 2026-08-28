// Content library for Capsule's activities.
//
// The STRUCTURE of these exercises follows well-established categories used in
// cognitive engagement work: semantic (category) fluency, confrontation naming
// from a definition, word-list learning with an interference delay, recognition
// versus free recall, reminiscence, and procedural sequencing.
//
// The ITEMS are all written for Capsule. Published instruments (CERAD word
// lists, Boston Naming Test items, and similar) are deliberately NOT reused:
// they are copyrighted, and rehearsing real test items at home would degrade
// those tests for the person's own clinician. The structure carries the value.
//
// None of this assesses or diagnoses. Nothing here is scored against a norm,
// and no result is ever compared to anyone but the person themselves.

/* ---------------------------------------------------------------
   NAMING: retrieve a specific word from a description.
   Mirrors confrontation-naming tasks, presented as a friendly game.
   --------------------------------------------------------------- */

export const NAMING_SETS = [
  { theme: "In the kitchen", items: [
    { word: "kettle", clue: "You boil water in it for tea." },
    { word: "spoon", clue: "You stir your tea with it." },
    { word: "oven", clue: "You bake bread or roast a dinner in it." },
    { word: "plate", clue: "You serve food on it." },
    { word: "sieve", clue: "You pour flour through it to remove lumps." },
    { word: "rolling pin", clue: "You flatten pastry with it." },
  ]},
  { theme: "In the garden", items: [
    { word: "rose", clue: "A classic flower with thorns on its stem." },
    { word: "shovel", clue: "You dig holes in the soil with it." },
    { word: "watering can", clue: "You carry water to your plants in it." },
    { word: "seed", clue: "You plant this tiny thing and it grows." },
    { word: "hedge", clue: "A row of bushes that makes a green wall." },
    { word: "wheelbarrow", clue: "One wheel, two handles, for carrying soil." },
  ]},
  { theme: "Weather", items: [
    { word: "rain", clue: "Water falling from the sky." },
    { word: "frost", clue: "The white crust on grass on a cold morning." },
    { word: "breeze", clue: "A gentle wind." },
    { word: "thunder", clue: "The loud rumble after lightning." },
    { word: "fog", clue: "Thick cloud at ground level that hides the road." },
    { word: "rainbow", clue: "Coloured arc in the sky after a shower." },
  ]},
  { theme: "Around town", items: [
    { word: "library", clue: "A quiet building full of books to borrow." },
    { word: "market", clue: "Stalls selling fruit, vegetables and goods." },
    { word: "bakery", clue: "The shop that sells fresh bread and cakes." },
    { word: "station", clue: "Where you catch a train." },
    { word: "post office", clue: "Where you buy stamps and send parcels." },
    { word: "chemist", clue: "Where you collect your prescriptions." },
  ]},
  { theme: "Tools and fixing", items: [
    { word: "hammer", clue: "You knock nails in with it." },
    { word: "screwdriver", clue: "You turn screws with it." },
    { word: "ladder", clue: "You climb it to reach the gutter." },
    { word: "tape measure", clue: "You check the length of something with it." },
    { word: "spirit level", clue: "It has a bubble that tells you if a shelf is straight." },
    { word: "pliers", clue: "You grip and bend wire with them." },
  ]},
  { theme: "Clothes", items: [
    { word: "cardigan", clue: "A knitted top that buttons up the front." },
    { word: "scarf", clue: "You wrap it round your neck in winter." },
    { word: "gloves", clue: "They keep your hands warm." },
    { word: "raincoat", clue: "A waterproof coat for wet weather." },
    { word: "slippers", clue: "Soft shoes you wear indoors." },
    { word: "belt", clue: "It holds your trousers up." },
  ]},
  { theme: "Music and dancing", items: [
    { word: "piano", clue: "Black and white keys, played with both hands." },
    { word: "violin", clue: "You play it with a bow, under your chin." },
    { word: "record", clue: "A black disc that spins and plays music." },
    { word: "choir", clue: "A group of people singing together." },
    { word: "waltz", clue: "A dance counted in threes." },
    { word: "drum", clue: "You beat it with sticks to keep time." },
  ]},
  { theme: "At the seaside", items: [
    { word: "pier", clue: "A long walkway out over the sea." },
    { word: "seagull", clue: "The white bird that steals your chips." },
    { word: "deckchair", clue: "A striped folding chair for the beach." },
    { word: "lighthouse", clue: "A tall tower that warns ships at night." },
    { word: "pebble", clue: "A small smooth stone on the shore." },
    { word: "tide", clue: "The sea coming in and going out." },
  ]},
  { theme: "Animals", items: [
    { word: "hedgehog", clue: "A small garden animal covered in spines." },
    { word: "owl", clue: "A bird that hunts at night and hoots." },
    { word: "squirrel", clue: "Bushy tail, buries nuts in the garden." },
    { word: "sheep", clue: "Woolly farm animal that gets shorn." },
    { word: "robin", clue: "Small brown bird with a red breast." },
    { word: "fox", clue: "Red wild dog with a bushy tail." },
  ]},
  { theme: "Travel", items: [
    { word: "suitcase", clue: "You pack your clothes in it for a trip." },
    { word: "passport", clue: "The little book you show at the border." },
    { word: "timetable", clue: "It tells you when the bus or train leaves." },
    { word: "ferry", clue: "A boat that carries cars and people across water." },
    { word: "compass", clue: "Its needle always points north." },
    { word: "postcard", clue: "A picture card you send from your holiday." },
  ]},
  { theme: "Celebrations", items: [
    { word: "candle", clue: "You blow these out on a birthday cake." },
    { word: "wedding", clue: "The day two people marry." },
    { word: "wreath", clue: "A ring of greenery hung on the door at Christmas." },
    { word: "toast", clue: "Raising your glass to wish someone well." },
    { word: "confetti", clue: "Small paper pieces thrown over a couple." },
    { word: "banner", clue: "A long sign hung up saying Happy Birthday." },
  ]},
  { theme: "The body and health", items: [
    { word: "elbow", clue: "The joint in the middle of your arm." },
    { word: "ankle", clue: "The joint just above your foot." },
    { word: "bandage", clue: "You wrap it round a cut to protect it." },
    { word: "thermometer", clue: "It tells you if you have a temperature." },
    { word: "spectacles", clue: "You wear them to read the newspaper." },
    { word: "walking stick", clue: "It helps you keep your balance." },
  ]},
];

/* ---------------------------------------------------------------
   CATEGORY FLUENCY: name as many things in a category as you can.
   The classic semantic-fluency structure, framed as a friendly round.
   Open-ended, so it never runs out the way a fixed item list does.
   --------------------------------------------------------------- */

export const FLUENCY_CATEGORIES = [
  { category: "animals", prompt: "Name as many animals as you can." },
  { category: "fruits and vegetables", prompt: "Name as many fruits and vegetables as you can." },
  { category: "things in a kitchen", prompt: "Name as many things you would find in a kitchen as you can." },
  { category: "birds", prompt: "Name as many birds as you can." },
  { category: "things you wear", prompt: "Name as many things you can wear as you can." },
  { category: "towns and cities", prompt: "Name as many towns or cities as you can." },
  { category: "flowers and trees", prompt: "Name as many flowers or trees as you can." },
  { category: "jobs people do", prompt: "Name as many jobs as you can." },
  { category: "things in a garden", prompt: "Name as many things you would find in a garden as you can." },
  { category: "things that go in a sandwich", prompt: "Name as many things you could put in a sandwich as you can." },
  { category: "musical instruments", prompt: "Name as many musical instruments as you can." },
  { category: "things at the seaside", prompt: "Name as many things you would find at the seaside as you can." },
];

/* ---------------------------------------------------------------
   WORD LISTS for recall. Everyday, picturable, concrete nouns.
   Each list ships with recognition distractors drawn from nearby
   meanings, so the recognition round is a real choice, not a giveaway.
   --------------------------------------------------------------- */

export const WORD_LISTS = [
  { words: ["apple", "table", "penny", "river", "candle"],
    distractors: ["pear", "chair", "button", "stream", "lantern"] },
  { words: ["garden", "mirror", "letter", "orange", "bridge"],
    distractors: ["meadow", "window", "parcel", "lemon", "tunnel"] },
  { words: ["basket", "silver", "meadow", "button", "kettle"],
    distractors: ["bucket", "golden", "valley", "buckle", "teapot"] },
  { words: ["blanket", "lantern", "cherry", "harbour", "pillow"],
    distractors: ["curtain", "candle", "plum", "cove", "cushion"] },
  { words: ["ribbon", "cottage", "thunder", "saucer", "feather"],
    distractors: ["lace", "cabin", "lightning", "mug", "petal"] },
  { words: ["compass", "biscuit", "curtain", "puddle", "trumpet"],
    distractors: ["clock", "cracker", "blind", "pond", "whistle"] },
  { words: ["violet", "ladder", "postcard", "walnut", "engine"],
    distractors: ["daisy", "staircase", "envelope", "acorn", "motor"] },
  { words: ["harvest", "slipper", "marble", "chimney", "onion"],
    distractors: ["autumn", "sandal", "pebble", "rooftop", "garlic"] },
];

/* Light interference between learning and recall. The point is to occupy
   the mind briefly, not to be difficult or to be scored. */
export const INTERFERENCE_TASKS = [
  { instruction: "Count backwards from 20 to 1, out loud if you like.", seconds: 25 },
  { instruction: "Name the months of the year, starting with January.", seconds: 25 },
  { instruction: "Say the days of the week backwards, starting with Sunday.", seconds: 25 },
  { instruction: "Count up in fives, from 5 as far as you can go.", seconds: 25 },
  { instruction: "Name the seasons, then say which one we are in now.", seconds: 25 },
];

/* ---------------------------------------------------------------
   DESCRIPTION PROMPTS, in three families.

   reminiscence  - autobiographical recall, the basis of reminiscence work
   procedural    - describing a familiar sequence in order
   scene         - open connected speech, the richest source of natural
                   language for someone's own trend history
   --------------------------------------------------------------- */

export const DESCRIPTION_PROMPTS = [
  // Reminiscence
  { kind: "reminiscence", prompt: "Describe your favourite room in the house you grew up in." },
  { kind: "reminiscence", prompt: "Describe your oldest friend. How did you meet?" },
  { kind: "reminiscence", prompt: "Describe a job you had, and what a normal day was like." },
  { kind: "reminiscence", prompt: "Describe the first home you lived in as an adult." },
  { kind: "reminiscence", prompt: "Describe a holiday you remember well. Who was with you?" },
  { kind: "reminiscence", prompt: "Describe a teacher you still remember, and what they were like." },
  { kind: "reminiscence", prompt: "Describe how you celebrated birthdays when you were young." },
  { kind: "reminiscence", prompt: "Describe a car, bicycle, or bus you travelled in often." },
  { kind: "reminiscence", prompt: "Describe a wedding you went to. What do you remember of the day?" },
  { kind: "reminiscence", prompt: "Describe the street you lived on as a child." },

  // Procedural sequencing
  { kind: "procedural", prompt: "Describe how you make a proper cup of tea, step by step." },
  { kind: "procedural", prompt: "Describe how you would plant something in a garden, from start to finish." },
  { kind: "procedural", prompt: "Describe how you get ready to go out on a cold morning." },
  { kind: "procedural", prompt: "Describe how to make a sandwich you like, step by step." },
  { kind: "procedural", prompt: "Describe how you would wrap a present." },
  { kind: "procedural", prompt: "Describe how you would post a letter, from writing it to sending it." },

  // Scene and open description
  { kind: "scene", prompt: "Describe what you can see out of your window right now." },
  { kind: "scene", prompt: "Describe a meal you love. What is on the plate?" },
  { kind: "scene", prompt: "Describe the room you are sitting in, as if to someone on the telephone." },
  { kind: "scene", prompt: "Describe a market or a busy street, and everything going on in it." },
  { kind: "scene", prompt: "Describe your ideal day out, from morning to evening." },
  { kind: "scene", prompt: "Describe a garden in summer, with as much detail as you can." },
];

/* ---------------------------------------------------------------
   MUSIC MOMENTS: music-evoked autobiographical memory.

   No audio is played. Capsule cannot stream recordings (that needs
   licensing), cannot embed external players (the app blocks external
   requests), and does not reproduce lyrics. What it uses instead are
   song titles, performers, dances, and the objects music came out of,
   which are factual references and work perfectly well as memory cues.

   The cue does the work here, not the sound: naming a tune someone
   danced to is often enough to open the memory around it.
   --------------------------------------------------------------- */

export const MUSIC_ERAS = [
  {
    era: "The 1940s",
    songs: [
      { title: "In the Mood", artist: "Glenn Miller" },
      { title: "We'll Meet Again", artist: "Vera Lynn" },
      { title: "White Christmas", artist: "Bing Crosby" },
      { title: "Boogie Woogie Bugle Boy", artist: "The Andrews Sisters" },
    ],
    scenes: [
      "A dance hall on a Saturday night",
      "The wireless on in the kitchen",
      "A big band with a row of brass players",
      "Dancing the jitterbug",
    ],
  },
  {
    era: "The 1950s",
    songs: [
      { title: "Rock Around the Clock", artist: "Bill Haley & His Comets" },
      { title: "Hound Dog", artist: "Elvis Presley" },
      { title: "Que Sera, Sera", artist: "Doris Day" },
      { title: "Johnny B. Goode", artist: "Chuck Berry" },
    ],
    scenes: [
      "A jukebox in a coffee bar",
      "Your first record player",
      "A church or chapel choir",
      "Learning to jive",
    ],
  },
  {
    era: "The 1960s",
    songs: [
      { title: "She Loves You", artist: "The Beatles" },
      { title: "(I Can't Get No) Satisfaction", artist: "The Rolling Stones" },
      { title: "Respect", artist: "Aretha Franklin" },
      { title: "What a Wonderful World", artist: "Louis Armstrong" },
    ],
    scenes: [
      "A transistor radio held to your ear",
      "A seaside bandstand",
      "The twist",
      "Watching a band on a black and white television",
    ],
  },
  {
    era: "The 1970s",
    songs: [
      { title: "Dancing Queen", artist: "ABBA" },
      { title: "Imagine", artist: "John Lennon" },
      { title: "Stayin' Alive", artist: "Bee Gees" },
      { title: "Bohemian Rhapsody", artist: "Queen" },
    ],
    scenes: [
      "A wedding reception with everyone up dancing",
      "A record shop, flicking through the racks",
      "A car radio on a long drive",
      "A school disco",
    ],
  },
  {
    era: "The 1980s",
    songs: [
      { title: "Billie Jean", artist: "Michael Jackson" },
      { title: "Every Breath You Take", artist: "The Police" },
      { title: "Wake Me Up Before You Go-Go", artist: "Wham!" },
      { title: "Sweet Child o' Mine", artist: "Guns N' Roses" },
    ],
    scenes: [
      "A cassette tape you recorded yourself",
      "A Walkman on the bus",
      "Music videos on the television",
      "A works Christmas party",
    ],
  },
];

/* ---------------------------------------------------------------
   OPEN-ENDED PROMPTS. Unlike the clued sets these have no fixed answer
   and no end, so they never run out and never produce a wrong response.
   Useful on days when a person does not want to be asked questions with
   right answers, which for many people is most days.
   --------------------------------------------------------------- */

export const OPEN_PROMPTS = [
  { kind: "open", prompt: "What is something you know how to do that most people do not?" },
  { kind: "open", prompt: "If you could send a message to yourself at twenty, what would it say?" },
  { kind: "open", prompt: "Who taught you something that stuck with you? What was it?" },
  { kind: "open", prompt: "What is a small thing that always makes a day better?" },
  { kind: "open", prompt: "Describe a place you could find your way around with your eyes shut." },
  { kind: "open", prompt: "What is the best meal you have ever eaten, and where were you?" },
  { kind: "open", prompt: "What did you want to be when you grew up? What happened instead?" },
  { kind: "open", prompt: "Tell me about a piece of advice you would give a young person today." },
  { kind: "open", prompt: "What is something that has changed a great deal in your lifetime?" },
  { kind: "open", prompt: "Describe someone who made you laugh. What were they like?" },
  { kind: "open", prompt: "What is a job or chore you secretly enjoy doing?" },
  { kind: "open", prompt: "If you had a free afternoon and good weather, what would you do?" },
  { kind: "open", prompt: "Tell me about a time you were proud of someone else." },
  { kind: "open", prompt: "What is something you own that has a story behind it?" },
  { kind: "open", prompt: "Describe a journey you have made many times." },
  { kind: "open", prompt: "What did your kitchen smell like when you were a child?" },
  { kind: "open", prompt: "Tell me about a friend you have not seen in a long time." },
  { kind: "open", prompt: "What is something you have changed your mind about over the years?" },
  { kind: "open", prompt: "Describe a room you would happily sit in all afternoon." },
  { kind: "open", prompt: "What is a tradition in your family, and how did it start?" },
];

/* Open prompts, so they fit whatever cue the person chose. */
export const MUSIC_PROMPTS = [
  "Where does this take you? Who was there?",
  "What were you doing when you used to hear this?",
  "Describe the room, or the place, this brings back.",
  "Who did you listen to this with?",
  "What else do you remember from around that time?",
];

/* Prompts for the person's own photographs. Kept open so they fit any picture. */
export const PHOTO_PROMPTS = [
  "Tell the story of this day. Who was there, and what happened?",
  "What was happening just before this photo was taken?",
  "Describe everything you can see in this picture.",
  "What do you remember about how this day felt?",
  "Who would you want to show this photo to, and what would you tell them about it?",
];

/**
 * Picks an item the person has not seen recently.
 * Rotation keeps daily use from repeating within a week or so; it falls
 * back to a rotating index once every option has been seen.
 */
export function pickFresh(list, recentKeys, keyOf, seed = Date.now()) {
  if (!list.length) return null;
  const seen = new Set(recentKeys);
  const unseen = list.filter((item) => !seen.has(keyOf(item)));
  const pool = unseen.length ? unseen : list;
  const index = Math.abs(Math.floor(seed / 60000)) % pool.length;
  return pool[index];
}
