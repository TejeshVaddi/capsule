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
  const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0);

  // Who has opted in, and has not already been reminded today?
  const { data: prefs, error: prefErr } = await admin
    .from("reminder_prefs")
    .select("user_id, email, last_reminded_on")
    .eq("enabled", true);
  if (prefErr) return json({ ok: false, error: prefErr.message }, 500);

  const todayKey = now.toISOString().slice(0, 10);
  let sent = 0, skipped = 0;

  for (const p of prefs ?? []) {
    if (p.last_reminded_on === todayKey) { skipped++; continue; }

    // Anything logged today counts as having shown up.
    const { count: entryCount } = await admin
      .from("entries").select("id", { count: "exact", head: true })
      .eq("user_id", p.user_id).gte("date", todayStart.toISOString());
    const { count: actCount } = await admin
      .from("activity_log").select("id", { count: "exact", head: true })
      .eq("user_id", p.user_id).gte("date", todayStart.toISOString());

    if ((entryCount ?? 0) > 0 && (actCount ?? 0) >= 2) { skipped++; continue; }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: p.email,
        subject: "Your Capsule for today",
        text:
          "There is still time to add today to your Capsule.\n\n" +
          "Tell it about your day, try an activity or two, and your streak carries on.\n\n" +
          "If you would rather not get these, you can turn reminders off on the Account screen.",
      }),
    });

    if (res.ok) {
      sent++;
      await admin.from("reminder_prefs")
        .update({ last_reminded_on: todayKey })
        .eq("user_id", p.user_id);
    }
  }

  return json({ ok: true, sent, skipped, total: prefs?.length ?? 0 });
});
