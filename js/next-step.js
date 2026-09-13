// The end of each of the day's steps: what comes next, and one big button
// that goes straight there. Nobody should have to work out where to go after
// finishing something, or hunt through the tabs for it.
//
// The order comes from the daily plan (journal, the two activities, then a
// memory visit when there is one). When everything is done, the button goes
// Home, which marks the finished day.

import { getDailyPlan } from "./daily.js?v=611e55e30f";
import { el, escapeHtml, guideHtml } from "./ui.js?v=611e55e30f";

const BUTTON = {
  journal: "Tell Capsule about today",
  activities: "Go to today's 2 activities",
  recall: "Visit an earlier day",
};

/**
 * `doneText` says what was just finished, e.g. "Your entry is saved."
 * Returns an element to append.
 */
export async function nextStepBlock(navigate, doneText) {
  const plan = await getDailyPlan();
  const next = plan.nextTask;
  const block = el(`
    <div class="next-step">
      ${guideHtml(next
        ? `${doneText} Next: ${next.title}. Tap the button below.`
        : `${doneText} That was the last thing for today. Tap the button below to finish.`)}
      <button class="btn btn-primary btn-large" type="button">
        ${escapeHtml(next ? BUTTON[next.key] || next.title : "Finish for today")}
      </button>
    </div>`);
  block.querySelector("button").addEventListener("click", () => navigate(next ? next.view : "home"));
  return block;
}
