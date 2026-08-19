// Capsule: server-side account deletion.
//
// Deleting an auth user requires the service_role key, which must never reach
// the browser. This function runs on Supabase's servers, where the key is
// supplied as an environment variable and is NOT part of the repository.
//
// Deploy with:  supabase functions deploy delete-account
//
// It authenticates the caller from their own JWT and can only ever delete
// the caller's own account: the user id comes from the verified token, never
// from the request body, so one user cannot ask it to delete another.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/** One-way hash, so the audit trail proves a deletion happened without
 *  retaining an identifier that points back at a real person. */
async function hashId(id: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${id}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method-not-allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  // Optional: set with `supabase secrets set AUDIT_SALT=<random string>`
  const AUDIT_SALT = Deno.env.get("AUDIT_SALT") ?? "capsule-audit";

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ ok: false, error: "missing-auth" }, 401);
  }

  // Identify the caller from their own token.
  const asCaller = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await asCaller.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ ok: false, error: "invalid-session" }, 401);
  }
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = { photos: "skipped", rows: "skipped", audit: "skipped", account: "pending" };

  try {
    // Defence in depth: re-sweep storage server-side in case the client died
    // part-way through its own sweep.
    const stack: string[] = [userId];
    const objects: string[] = [];
    let guard = 0;
    while (stack.length && guard++ < 500) {
      const prefix = stack.pop()!;
      const { data: listed } = await admin.storage.from("photos").list(prefix, { limit: 1000 });
      for (const item of listed ?? []) {
        const full = `${prefix}/${item.name}`;
        if (item.id === null) stack.push(full);
        else objects.push(full);
      }
    }
    if (objects.length) {
      for (let i = 0; i < objects.length; i += 500) {
        await admin.storage.from("photos").remove(objects.slice(i, i + 500));
      }
    }
    result.photos = `removed:${objects.length}`;

    await admin.from("entries").delete().eq("user_id", userId);
    await admin.from("activity_log").delete().eq("user_id", userId);
    result.rows = "removed";

    // Audit BEFORE the account disappears, so the record is written even if
    // the final step fails. Stores no readable identifier.
    //
    // insert() reports failure via `error` rather than throwing, so it is
    // checked explicitly: an unwritable audit table must be visible, not
    // silently skipped. It does NOT abort the deletion, because the person's
    // right to have their data removed outweighs our own record-keeping.
    const { error: auditErr } = await admin.from("deletion_audit").insert({
      user_hash: await hashId(userId, AUDIT_SALT),
      deleted_at: new Date().toISOString(),
      photos_removed: objects.length,
    });
    if (auditErr) {
      console.error("AUDIT WRITE FAILED (deletion continued):", auditErr.message);
      result.audit = `failed: ${auditErr.message}`;
    } else {
      result.audit = "logged";
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;
    result.account = "removed";

    return json({ ok: true, result });
  } catch (err) {
    console.error("deletion failed", err);
    return json({ ok: false, error: String(err?.message ?? err), result }, 500);
  }
});
