// The privacy policy, shown on the opening screen and required at sign-up.
//
// Kept here as structured content rather than a separate page so it works
// offline, needs no navigation away from the app, and can be versioned:
// POLICY_VERSION is recorded with each acceptance, so if the policy
// changes you can tell who accepted which version.
//
// House style note: no em dashes anywhere in user-facing text.

import { openLegalModal, sectionsToHTML } from "./legal.js?v=f5fa412c13";

export const POLICY_VERSION = "2026-08-20";
export const POLICY_UPDATED = "20 August 2026";

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
      "<strong>Only you.</strong> Every entry, photo, and measurement is tied to your account and protected so that nobody else, including other Capsule users, can read, download, or access it. This is enforced at the database level, not just in the app's design.",
      "If a caregiver or family-sharing feature is added in future, we will ask for your explicit permission before anyone else can see your entries.",
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
