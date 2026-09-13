import { db } from "../data.js?v=611e55e30f";
import { getDailyPlan, getStreak, completeToday, celebratedToday, markCelebrated } from "../daily.js?v=611e55e30f";
import { buildWeeklySummary, shouldShowWeekly, markWeeklyShown, startOfWeek } from "../weekly.js?v=611e55e30f";
import { celebrateStreak } from "../celebrate.js?v=611e55e30f";
import { el, escapeHtml, photoUrl, guideHtml } from "../ui.js?v=611e55e30f";
import { icon } from "../icons.js?v=611e55e30f";

// Fewer than this and the picture grid is left out entirely.
const MIN_WEEK_PHOTOS = 3;
// Same idea for the sticky-note wall: one lone note is not a collage.
const MIN_SNIPPETS = 2;

export async function renderHomeView(root, { navigate }) {
  root.innerHTML = "";

  const [plan, streak] = await Promise.all([getDailyPlan(), getStreak()]);

  const panel = el(`
    <div class="stack">
      <div class="glass-panel home-hero">
        <div class="home-streak">
          <div class="home-streak-ring${streak.count ? " lit" : ""}">
            <span class="home-streak-num">${streak.count}</span>
          </div>
          <div>
            <p class="home-streak-label">${streak.count === 1 ? "day" : "days"} in a row</p>
            <p class="muted home-streak-sub">${streakLine(streak, plan)}</p>
          </div>
        </div>
        <div class="home-progress">
          <div class="home-progress-bar"><span style="width:${plan.totalCount ? (plan.doneCount / plan.totalCount) * 100 : 0}%"></span></div>
          <p class="muted">${plan.doneCount} of ${plan.totalCount} done today</p>
        </div>
      </div>

      <div class="glass-panel">
        <h2>Today, in order</h2>
        ${guideHtml(plan.allDone
          ? "Everything is done for today. You can come back tomorrow."
          : `Do the steps from the top. Next is: ${plan.nextTask.title}. Tap the purple Start button.`)}
        <ol class="today-list" data-slot="tasks"></ol>
      </div>

      <div data-slot="weekly"></div>
    </div>
  `);
  root.appendChild(panel);

  const list = panel.querySelector('[data-slot="tasks"]');
  plan.tasks.forEach((t, i) => {
    const isNext = plan.nextTask && plan.nextTask.key === t.key;
    const item = el(`
      <li class="today-item${t.done ? " done" : ""}${isNext ? " next" : ""}">
        <span class="today-check" aria-hidden="true">${t.done ? icon("check") : `<span class="today-num">${i + 1}</span>`}</span>
        <span class="today-body">
          <span class="today-title">${escapeHtml(t.title)}</span>
          <span class="today-detail muted">${escapeHtml(t.detail)}</span>
          ${t.progress ? `<span class="today-progress">${escapeHtml(t.progress)}</span>` : ""}
        </span>
        ${t.done ? "" : `<button class="btn ${isNext ? "btn-primary" : "btn-secondary"} today-go">${isNext ? "Start" : "Open"}</button>`}
      </li>`);
    const btn = item.querySelector(".today-go");
    if (btn) btn.addEventListener("click", () => navigate(t.view));
    list.appendChild(item);
  });

  // Finishing everything triggers the celebration, once a day.
  if (plan.allDone && !(await celebratedToday())) {
    const count = await completeToday();
    await markCelebrated();
    await celebrateStreak(count);
    return navigate("home");
  }

  await mountWeekly(panel.querySelector('[data-slot="weekly"]'), navigate);
}

function streakLine(streak, plan) {
  if (plan.allDone) return "Everything is done for today.";
  if (!streak.count) return "Finish today's list to begin a streak.";
  if (streak.atRisk) return "Finish today's list to keep it going.";
  return "Keep it going with today's list.";
}

/* ---------------- Weekly look back ---------------- */

async function mountWeekly(mount, navigate) {
  // Always the week just gone, never the one in progress: a week cannot be
  // summarised until it is over. On Friday the 21st this shows the 9th to
  // the 15th, not a half-finished current week.
  const prevWeek = new Date(startOfWeek());
  prevWeek.setDate(prevWeek.getDate() - 7);
  const s = await buildWeeklySummary(prevWeek);
  if (!s.journalCount && !s.activityCount) return;

  // Shown in full once per week, on the first visit after the week closes.
  // After that it collapses to a line they can reopen, so it stays reachable
  // without becoming permanent furniture on the home screen.
  const firstLook = await shouldShowWeekly();
  if (!firstLook) {
    const bar = el(`
      <button class="week-reopen" type="button">
        <span>Your week: ${weekLabel(s.weekStart)}</span>
        <span class="week-reopen-cue">See it again</span>
      </button>`);
    bar.addEventListener("click", () => {
      bar.remove();
      buildWeeklyCard(mount, s);
    });
    mount.appendChild(bar);
    return;
  }

  await markWeeklyShown();
  buildWeeklyCard(mount, s);
}

async function buildWeeklyCard(mount, s) {
  const card = el(`
    <div class="glass-panel">
      <div class="section-title">
        <h2>Your week</h2>
        <span class="pill">${weekLabel(s.weekStart)}</span>
      </div>

      <div class="week-wins" data-slot="wins">
        ${s.wins.map((w) => `<p class="week-win">${icon("check")} ${escapeHtml(w)}</p>`).join("")}
      </div>

      <div class="week-stats">
        <div><strong>${s.daysActive}</strong><span>day${s.daysActive === 1 ? "" : "s"} active</span></div>
        <div><strong>${s.journalCount}</strong><span>entr${s.journalCount === 1 ? "y" : "ies"}</span></div>
        <div><strong>${s.activityCount}</strong><span>activit${s.activityCount === 1 ? "y" : "ies"}</span></div>
        <div><strong>${s.recallCount}</strong><span>memory visit${s.recallCount === 1 ? "" : "s"}</span></div>
      </div>

      ${s.snippets.length >= MIN_SNIPPETS ? `
        <h3 class="week-sub">Moments from the week</h3>
        <div class="sticky-wall" data-slot="wall">
          ${s.snippets.map((sn, i) => `
            <div class="sticky" style="--tilt:${(i % 5) - 2}deg; --tone:${i % 4}">
              <p class="sticky-date">${new Date(sn.date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</p>
              <p class="sticky-text">${escapeHtml(sn.text)}</p>
            </div>`).join("")}
        </div>` : ""}

      <div data-slot="photos"></div>

      ${s.movements.length ? `
        <h3 class="week-sub">What changed in your patterns</h3>
        <div class="week-movements">
          ${s.movements.map((m) => `
            <div class="week-move week-move-${m.direction}">
              <strong>${escapeHtml(m.label)}</strong>
              <span>${escapeHtml(m.text)}</span>
            </div>`).join("")}
        </div>
        <p class="muted week-footnote">Compared with the week before.</p>
      ` : ""}
    </div>
  `);
  mount.appendChild(card);

  // Photos from the week, loaded after the card is on screen.
  const photoMount = card.querySelector('[data-slot="photos"]');
  const photos = [];
  for (const id of s.photoEntryIds) {
    const p = await db.getPhotosForEntry(id).catch(() => []);
    photos.push(...p);
  }
  // A "Pictures from the week" heading over one or two stray images reads as
  // something half broken rather than as a collage. Below the threshold the
  // whole section is left out, and the week still reads fine without it.
  if (photos.length >= MIN_WEEK_PHOTOS) {
    const wrap = el(`
      <div>
        <h3 class="week-sub">Pictures from the week</h3>
        <div class="week-photos"></div>
      </div>`);
    const grid = wrap.querySelector(".week-photos");
    photos.slice(0, 24).forEach((p) => {
      const img = document.createElement("img");
      img.src = photoUrl(p.blob);
      img.alt = "A photo from your week";
      img.loading = "lazy";
      grid.appendChild(img);
    });
    photoMount.appendChild(wrap);
  }
}

function weekLabel(start) {
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const f = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${f(start)} to ${f(end)}`;
}
