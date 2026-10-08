// Terms of Service.
//
// Written to describe how Capsule actually behaves, in the same plain
// language as the privacy policy. Like that document, this has NOT been
// reviewed by a lawyer; see the note at the foot of the README before
// launching to real users.
//
// House style: no em dashes in user-facing text.

import { openLegalModal, sectionsToHTML } from "./legal.js?v=c44468da07";
import { CONTACT_EMAIL } from "./privacy.js?v=c44468da07";

export const TERMS_VERSION = "2026-10-07";
export const TERMS_UPDATED = "7 October 2026";

const SECTIONS = [
  {
    heading: "The short version",
    paragraphs: [
      "Capsule is a journaling and cognitive-engagement app. You can use it for free. What you write belongs to you. It is not a medical device, it cannot tell you whether you have any condition, and it is not a substitute for seeing a doctor.",
    ],
  },
  {
    heading: "Capsule is not medical care",
    important: true,
    paragraphs: [
      "This is the most important thing on this page. Capsule does <strong>not diagnose, treat, prevent, or predict</strong> any medical condition, including Alzheimer's disease and any other form of dementia.",
      "The trends and summaries it shows are descriptions of your own past entries and nothing more. They are not a test result, not a risk score, and not a clinical opinion. Never use Capsule to decide whether to seek care, to delay seeking care, or to change anything about your treatment. If you have any concern about memory or thinking, speak to a doctor.",
    ],
  },
  {
    heading: "Using Capsule",
    paragraphs: ["You may use Capsule if you are 18 or older, or if a responsible adult is helping you use it. When you use it, we ask that you:"],
    list: [
      "Use it for your own journaling, or to support someone who has asked for your help, or, as a care service, for residents who have agreed to it.",
      "Do not upload anything unlawful, or anything about another person who would not want it recorded.",
      "Do not try to break, overload, or gain unauthorised access to the service or to anyone else's account.",
    ],
  },
  {
    heading: "Using Capsule in a care centre",
    important: true,
    paragraphs: [
      "A care home, day centre, or similar service can sign in once and keep a separate Capsule for each resident. Doing that puts other people's words in your hands, so these conditions come with it. By setting a Capsule account up as a centre, you agree to all of them.",
    ],
    list: [
      "<strong>You have each resident's agreement.</strong> Before adding someone, you have their agreement, or the agreement of whoever is lawfully entitled to decide for them. You have explained, in a way that person can understand, what Capsule records and that staff with the sign-in can read it.",
      "<strong>You keep the sign-in secure.</strong> Anyone who can read the account's email can sign in and open every resident in it. Treat that email account as you would the key to a records cabinet.",
      "<strong>You do not use Capsule to assess anyone.</strong> Not to screen, score, diagnose, triage, or decide anything about a person's care, placement, or treatment. Capsule describes a person's own past entries and nothing more. Using it as evidence about somebody's condition is a misuse of it.",
      "<strong>You widen a resident's setting only with their agreement.</strong> Each resident has a setting for what staff can see without them there, and it starts narrow. Widening it to show how their own measures are moving is a decision about that person, taken with them, not a default to turn on for the house.",
      "<strong>You remove a resident's record when you should.</strong> When they leave, when they ask, or when whoever decides for them asks. Removing them from the Residents list deletes their entries, photos, activities, and streak permanently.",
      "<strong>You give a resident their own words when they ask for them.</strong> The Download my data button produces the whole journal as one file that opens in any browser.",
      "<strong>You, not we, hold the relationship with the resident.</strong> Capsule provides the software. The duty of care, and any obligation you have under the law where you operate, including rules about health or care records, rests with your service. Please take your own advice on what those obligations are before using Capsule with real residents.",
    ],
  },
  {
    heading: "Your entries belong to you",
    paragraphs: [
      "You keep ownership of everything you write and every photo you upload. We do not claim any rights over your entries, we do not sell them, and we do not use them to train any model.",
      "On a care centre account, the entries belong to the resident who wrote them, not to the centre that holds the account. The centre keeps them on that person's behalf.",
      "We store your content only so the app can show it back to you and track your own patterns over time, as described in the privacy policy.",
    ],
  },
  {
    heading: "Accounts",
    paragraphs: [
      "Signing in uses a one-time code sent to your email address. There is no password to set or lose. Keep access to that email account secure, because anyone who can read your email can sign in as you.",
      "You may use Capsule without an account at all. In that case everything stays on your own device.",
    ],
  },
  {
    heading: "Ending your use",
    paragraphs: [
      "You can delete your account and everything in it at any time from the Account screen, and deletion happens straight away. It is permanent and cannot be undone.",
      "We may suspend or end access to an account that is being used to harm others or to attack the service. If we ever do, we will tell you at the email address on the account.",
    ],
  },
  {
    heading: "What we can and cannot promise",
    paragraphs: [
      "Capsule is provided as it is, without warranties of any kind. We cannot promise it will always be available, error free, or that your data can never be lost through a fault or an outage.",
      "Because of that, please treat Capsule as one copy of your journal rather than the only copy. The History screen has a \"Download my data\" button, and using it from time to time is worth the moment it takes.",
      "To the fullest extent the law allows, we are not liable for indirect or consequential loss arising from your use of Capsule. Nothing here limits liability that cannot lawfully be limited.",
    ],
  },
  {
    heading: "Changes to the service and to these terms",
    paragraphs: [
      "Capsule will change over time as features are added or removed. If we make a significant change to these terms, we will tell you before it takes effect.",
    ],
  },
];

export function termsHTML() {
  const body = sectionsToHTML(SECTIONS, `Last updated ${TERMS_UPDATED}`);
  const contact = CONTACT_EMAIL
    ? `<p>Questions about these terms can be sent to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>`
    : `<p>A contact address for questions about these terms has not been set yet. If you are testing Capsule, please raise anything you notice with whoever gave you access.</p>`;
  return `${body}
    <section class="policy-section">
      <h3>Contact</h3>
      ${contact}
    </section>`;
}

export function openTerms() {
  return openLegalModal("Terms of Service", termsHTML());
}
