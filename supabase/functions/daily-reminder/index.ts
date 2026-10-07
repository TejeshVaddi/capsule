// Nightly reminder for people who have not finished today's Capsule.
//
// A browser cannot do this: the app is not running at 7pm. It needs a
// scheduled server-side job. Deploy this function, then schedule it with
// pg_cron (see the README, "Evening reminders").
//
// Sending is deliberately conservative:
//   - only to people who opted in
//   - only when today is genuinely unfinished
//   - at most one message per person per day
//   - never mentions metrics, trends, or anything about their health,
//     because an email subject line is not a private place
//
// A care centre gets the same message turned around: a list of which
// residents still have their list to do. It names them and says nothing
// else about them, for the same reason: an inbox is not a private place,
// and "has not journaled today" is not a fact about anybody's health.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Only the scheduler may run this. Set with:
  //   supabase secrets set REMINDER_SECRET=<random string>
  const secret = Deno.env.get("REMINDER_SECRET");
  const provided = req.headers.get("x-reminder-secret");
  if (!secret || provided !== secret) return json({ ok: false, error: "unauthorised" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("REMINDER_FROM") ?? "";
  if (!RESEND_KEY || !FROM) {
    return json({ ok: false, error: "email-not-configured", hint: "set RESEND_API_KEY and REMINDER_FROM" }, 500);
  }

  const now = new Date();

  /** What the clock reads for this person right now, in their own zone. */
  function localParts(timeZone: string) {
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
      });
      const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
      return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
    } catch {
      return { date: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
    }
  }

  // Who has opted in, and has not already been reminded today?
  const { data: prefs, error: prefErr } = await admin
    .from("reminder_prefs")
    .select("user_id, email, last_reminded_on, send_hour_local, timezone")
    .eq("enabled", true);
  if (prefErr) return json({ ok: false, error: prefErr.message }, 500);

  let sent = 0, skipped = 0, notTheirHour = 0;

  for (const p of prefs ?? []) {
    // This runs hourly. Only act for people whose own clock says 7pm, so a
    // reminder never lands in the middle of someone's night.
    const local = localParts(p.timezone ?? "UTC");
    if (local.hour !== (p.send_hour_local ?? 19)) { notTheirHour++; continue; }
    if (p.last_reminded_on === local.date) { skipped++; continue; }

    // Their day, not the server's.
    const dayStart = new Date(now);
    dayStart.setUTCHours(dayStart.getUTCHours() - 26); // generous lower bound
    const todayKey = local.date;

    // A care centre gets a different email: not "you have not finished" but
    // a list of who has not. Which residents exist is the account's own
    // record, so an empty list simply means this is a personal account.
    const { data: residents } = await admin
      .from("profiles").select("id, name")
      .eq("user_id", p.user_id).order("name", { ascending: true });

    let subject = "Your Capsule for today";
    let text = "";

    if ((residents ?? []).length) {
      // Finished is a row written by the app, so somebody who has not opened
      // Capsule at all today has no row and is named, which is the whole
      // point of the message.
      const { data: done } = await admin
        .from("daily_completion").select("profile_id")
        .eq("user_id", p.user_id).eq("day", todayKey);
      const finished = new Set((done ?? []).map((d) => d.profile_id));
      const outstanding = (residents ?? []).filter((r) => !finished.has(r.id));

      if (!outstanding.length) { skipped++; continue; }

      subject = `Capsule: ${outstanding.length} still to do today`;
      text =
        `These residents have not finished their Capsule today:\n\n` +
        outstanding.map((r) => `  - ${r.name}`).join("\n") +
        `\n\nThere is still time. Open Capsule, tap a name, and tap Launch Capsule.\n\n` +
        `If you would rather not get these, you can turn reminders off on the Account screen.`;
    } else {
      const { count: entryCount } = await admin
        .from("entries").select("id", { count: "exact", head: true })
        .eq("user_id", p.user_id).is("profile_id", null).gte("date", dayStart.toISOString());
      const { count: actCount } = await admin
        .from("activity_log").select("id", { count: "exact", head: true })
        .eq("user_id", p.user_id).is("profile_id", null).gte("date", dayStart.toISOString());

      if ((entryCount ?? 0) > 0 && (actCount ?? 0) >= 2) { skipped++; continue; }

      text =
        "There is still time to add today to your Capsule.\n\n" +
        "Tell it about your day, try an activity or two, and your streak carries on.\n\n" +
        "If you would rather not get these, you can turn reminders off on the Account screen.";
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: p.email, subject, text }),
    });

    if (res.ok) {
      sent++;
      await admin.from("reminder_prefs")
        .update({ last_reminded_on: todayKey })
        .eq("user_id", p.user_id);
    }
  }

  return json({ ok: true, sent, skipped, notTheirHour, total: prefs?.length ?? 0 });
});
