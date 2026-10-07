// The privacy policy, shown on the opening screen and required at sign-up.
//
// Kept here as structured content rather than a separate page so it works
// offline, needs no navigation away from the app, and can be versioned:
// POLICY_VERSION is recorded with each acceptance, so if the policy
// changes you can tell who accepted which version.
//
// House style note: no em dashes anywhere in user-facing text.

import { openLegalModal, sectionsToHTML } from "./legal.js?v=9d6a2c4f69";

export const POLICY_VERSION = "2026-10-07";
export const POLICY_UPDATED = "7 October 2026";

// Shown in both the privacy policy and the terms. Must stay an address that
// is actually monitored: it is the only route a user has to reach anyone.
export const CONTACT_EMAIL = "getcapsulemem@gmail.com";

const SECTIONS = [
  {
    heading: "The short version",
    paragraphs: [
      "Capsule is a journaling app that helps you record your day and revisit old memories. We store what you tell us, meaning your journal entries, photos, and some measurements about your speech, so the app can show you patterns over time. We do not diagnose any medical condition, and we do not share your information with anyone else without your permission.",
    ],
  },
  {
    heading: "What we collect",
    paragraphs: ["When you use Capsule, we collect:"],
    list: [
      "<strong>Journal entries.</strong> The text of what you say or type about your day, and about your recollections of past days.",
      "<strong>Photos</strong> you choose to upload.",
      "<strong>Speech measurements.</strong> Things like word count, hesitation patterns, and vocabulary variety, calculated automatically from your entries.",
      "<strong>Your email address</strong>, used only to sign you in. We send a one-time code, and we never ask for or store a password.",
      "<strong>Basic account activity</strong>, such as when you signed up and when you last used the app.",
    ],
    after: ["We do <strong>not</strong> collect your location, your contacts, or anything from other apps on your device."],
  },
  {
    heading: "How we use your information",
    paragraphs: ["We use what you share to:"],
    list: [
      "Show your journal entries back to you, organised by date.",
      "Resurface old photos and ask what you remember about them.",
      "Track how your speech measurements change over time, and show you that trend honestly.",
      "Suggest activities based on your own patterns.",
    ],
    after: ["We do <strong>not</strong> use your information to diagnose Alzheimer's disease or any other condition, to make medical claims about your health, to sell or rent your information to anyone, or to show you ads."],
  },
  {
    heading: "Who can see your information",
    paragraphs: [
      "<strong>Only the account it belongs to.</strong> Every entry, photo, and measurement is tied to one account and protected so that no other account, including other Capsule users, can read, download, or access it. This is enforced at the database level, not just in the app's design.",
      "If you use Capsule for your own journal, that account is yours, and nobody else can see any of it.",
      "If a care centre set up the account, read the next section, because the answer there is different and you should know exactly what it is.",
    ],
  },
  {
    heading: "If a care centre set up the account",
    important: true,
    paragraphs: [
      "Capsule can be used by a care home, day centre, or similar service, which signs in once and keeps a separate Capsule for each resident. If that is how you are using Capsule, this section applies to you.",
      "<strong>Staff at that centre can see what a resident writes.</strong> Anyone who can sign in to the centre's account can open any resident's Capsule and read their entries, see their photos, and see the measurements and trends taken from their words. Residents are kept entirely separate from one another, and no other centre and no other account can reach them, but within that one account the material is visible to whoever holds the sign-in.",
      "<strong>The centre, not Capsule, is responsible for asking the resident.</strong> A journal is a personal thing, and the words in it belong to the person who said them, not to the service looking after them. A centre using Capsule is agreeing that it has the resident's agreement, or the agreement of whoever is lawfully entitled to decide for them, and that the resident has been told in a way they can understand what is recorded and who can read it.",
      "<strong>Each resident can be set so that staff see less.</strong> Every resident has a setting for what staff can see without them there. It starts at the narrow one: whether they have finished today, and how long their run is, and nothing more. A centre can widen it to include how that person's own measures are moving, for a resident who has agreed to that. Opening somebody's Capsule still shows their whole journal, whatever the setting says, because that is what opening it is for.",
      "<strong>A resident can ask for their Capsule at any time.</strong> They can ask to see it, to have a copy of it, or to have it removed. The Download my data button produces the whole journal as a single file, and removing a resident from the Residents list permanently deletes their entries, photos, activities, and streak.",
      "<strong>The evening reminder names residents.</strong> If the centre turns reminders on, the message sent to the account email lists which residents have not finished that day. It says nothing else about them: no entries, no measurements, nothing about their health. It is still a list of names leaving the app, so a centre should only turn it on if that is appropriate where it is sent.",
      "Nothing about centre use changes what Capsule itself does with the material. We do not read it, sell it, share it between centres, use it to train any model, or use it to assess anybody.",
    ],
  },
  {
    heading: "Where your information is stored",
    paragraphs: [
      "Your data is stored with our hosting provider, Supabase, using industry-standard encryption. Photos are kept in a private storage location that only your account can reach.",
      "If you choose not to create an account, your entries stay only on your own device and are never sent anywhere.",
    ],
  },
  {
    heading: "How long we keep your information",
    paragraphs: [
      "We keep your information for as long as your account is active. When you delete your account, deletion happens straight away rather than on a delay: your photos are removed from storage first, then your entries and measurements, then your account itself.",
    ],
  },
  {
    heading: "Deleting your data",
    paragraphs: ["You can delete your account and everything in it at any time from the Account screen. This removes:"],
    list: [
      "All journal entries.",
      "All uploaded photos.",
      "All speech measurements and trends.",
      "Your account and email address.",
    ],
    after: [
      "Deletion is permanent and cannot be undone. If any step does not complete, the app tells you exactly which part failed rather than claiming your data is gone when it is not.",
      "If you use Capsule without an account, the same option clears everything stored on your device.",
      "On a care centre account, removing a resident from the Residents list permanently deletes that resident's entries, photos, activities, and streak, and deleting the account removes every resident in it.",
    ],
  },
  {
    heading: "What Capsule is not",
    important: true,
    paragraphs: [
      "Capsule is an <strong>educational and journaling tool</strong>. It is <strong>not a medical device</strong> and does <strong>not diagnose, treat, or predict</strong> any medical condition, including Alzheimer's disease or any form of dementia. Any patterns or summaries shown in the app are based on your own history and are not a substitute for professional medical evaluation. If you or someone you care for has concerns about memory or cognitive health, please speak to a doctor.",
    ],
  },
  {
    heading: "Changes to this policy",
    paragraphs: [
      "If we make significant changes to how we handle your information, we will tell you before those changes take effect.",
    ],
  },
];

function contactHTML() {
  return CONTACT_EMAIL
    ? `<p>Questions about this policy or your data can be sent to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
    : `<p>A contact address for questions about this policy has not been set yet. If you are testing Capsule, please raise anything you notice with whoever gave you access.</p>`;
}

export function policyHTML() {
  return `${sectionsToHTML(SECTIONS, `Last updated ${POLICY_UPDATED}`)}
    <section class="policy-section">
      <h3>Contact</h3>
      ${contactHTML()}
    </section>`;
}

/** Opens the policy in a scrollable modal. Resolves when it is closed. */
export function openPrivacyPolicy() {
  return openLegalModal("Privacy policy", policyHTML());
}
