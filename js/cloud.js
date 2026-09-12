// Supabase-backed storage + auth. Mirrors the db.js API shape so data.js
// can route to either implementation. All rows are protected server-side
// by row-level security (each user reads/writes only their own data).

import { SUPABASE_URL, SUPABASE_ANON_KEY, cloudConfigured } from "./config.js?v=c8970c9f30";

let client = null;

export function getClient() {
  if (!cloudConfigured()) return null;
  if (!client) {
    if (!window.supabase) {
      console.error("Supabase library failed to load");
      return null;
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

/* ---------- Auth ---------- */

export async function getSession() {
  const c = getClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session || null;
}

export async function currentUser() {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Emails the person a 6-digit sign-in code (also creates the account on
 * first use). `metadata` records which privacy policy version they accepted,
 * stored on the auth user so the record survives on the server, not just
 * on the device they signed up from.
 */
export async function sendSignInCode(email, metadata) {
  const c = getClient();
  if (!c) throw new Error("Cloud is not configured");
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, data: metadata || undefined },
  });
  if (error) throw error;
}

export async function verifySignInCode(email, token) {
  const c = getClient();
  if (!c) throw new Error("Cloud is not configured");
  const { data, error } = await c.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const c = getClient();
  if (c) await c.auth.signOut();
}

export function onAuthChange(handler) {
  const c = getClient();
  if (!c) return;
  c.auth.onAuthStateChange((_event, session) => handler(session));
}

/* ---------- Row mapping ---------- */

function rowToEntry(row) {
  return {
    id: row.id,
    type: row.type,
    recallOf: row.recall_of || undefined,
    date: row.date,
    text: row.text,
    metrics: row.metrics || null,
    recallComparison: row.recall_comparison || undefined,
    photoIds: row.photo_ids || [],
  };
}

function entryToRow(entry, userId) {
  return {
    id: entry.id,
    user_id: userId,
    type: entry.type,
    recall_of: entry.recallOf || null,
    date: entry.date,
    text: entry.text,
    metrics: entry.metrics || null,
    recall_comparison: entry.recallComparison || null,
    photo_ids: entry.photoIds || [],
  };
}

/* ---------- Data (mirrors db.js API) ---------- */

/* ---------- Evening reminders ---------- */

/** Current reminder preference, or null when none has been set. */
export async function getReminderPref() {
  const c = getClient();
  const user = await currentUser();
  if (!c || !user) return null;
  const { data, error } = await c.from("reminder_prefs").select("*").eq("user_id", user.id).maybeSingle();
  if (error) return null;
  return data;
}

/** Turns the evening reminder on or off. Off is the default. */
export async function setReminderPref(enabled) {
  const c = getClient();
  const user = await currentUser();
  if (!c || !user) throw new Error("Not signed in");
  // The browser is the only place that knows what 7pm means for this person.
  let timezone = "UTC";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    /* keep UTC */
  }
  const { error } = await c.from("reminder_prefs").upsert({
    user_id: user.id,
    email: user.email,
    enabled,
    timezone,
  });
  if (error) throw error;
}

export const cloudDb = {
  async putEntry(entry) {
    const c = getClient();
    const user = await currentUser();
    const { error } = await c.from("entries").upsert(entryToRow(entry, user.id));
    if (error) throw error;
  },

  async getEntry(id) {
    const c = getClient();
    const { data, error } = await c.from("entries").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? rowToEntry(data) : undefined;
  },

  async deleteEntry(id) {
    const c = getClient();
    const { error } = await c.from("entries").delete().eq("id", id);
    if (error) throw error;
  },

  async allEntries() {
    const c = getClient();
    const { data, error } = await c.from("entries").select("*").order("date", { ascending: true });
    if (error) throw error;
    return (data || []).map(rowToEntry);
  },

  async entriesByType(type) {
    const all = await cloudDb.allEntries();
    return all.filter((e) => e.type === type);
  },

  async putPhoto(photo) {
    const c = getClient();
    const user = await currentUser();
    const path = `${user.id}/${photo.entryId}/${photo.id}`;
    const { error } = await c.storage.from("photos").upload(path, photo.blob, {
      contentType: photo.blob.type || "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
  },

  async getPhotosForEntry(entryId) {
    const c = getClient();
    const user = await currentUser();
    if (!user) return [];
    const dir = `${user.id}/${entryId}`;
    const { data: files, error } = await c.storage.from("photos").list(dir);
    if (error || !files) return [];
    const photos = [];
    for (const f of files) {
      const { data: blob, error: dlError } = await c.storage.from("photos").download(`${dir}/${f.name}`);
      if (!dlError && blob) photos.push({ id: f.name, entryId, blob, name: f.name });
    }
    return photos;
  },

  async deletePhoto() {
    /* photos are keyed by entry path in cloud mode; entry deletion handles cleanup */
  },

  async logActivity(record) {
    const c = getClient();
    const user = await currentUser();
    const { error } = await c.from("activity_log").upsert({
      id: record.id,
      user_id: user.id,
      date: record.date,
      kind: record.kind,
      detail: record.detail || {},
    });
    if (error) throw error;
  },

  async allActivityLog() {
    const c = getClient();
    const { data, error } = await c.from("activity_log").select("*").order("date", { ascending: false });
    if (error) throw error;
    return data || [];
  },
};
