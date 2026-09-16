// Terms of Service.
//
// Written to describe how Capsule actually behaves, in the same plain
// language as the privacy policy. Like that document, this has NOT been
// reviewed by a lawyer; see the note at the foot of the README before
// launching to real users.
//
// House style: no em dashes in user-facing text.

import { openLegalModal, sectionsToHTML } from "./legal.js?v=6fe1a667df";
import { CONTACT_EMAIL } from "./privacy.js?v=6fe1a667df";

export const TERMS_VERSION = "2026-08-20";
export const TERMS_UPDATED = "20 August 2026";

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
      "Use it for your own journaling, or to support someone who has asked for your help.",
      "Do not upload anything unlawful, or anything about another person who would not want it recorded.",
      "Do not try to break, overload, or gain unauthorised access to the service or to anyone else's account.",
    ],
  },
  {
    heading: "Your entries belong to you",
    paragraphs: [
      "You keep ownership of everything you write and every photo you upload. We do not claim any rights over your entries, we do not sell them, and we do not use them to train any model.",
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
