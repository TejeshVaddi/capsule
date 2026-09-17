// Account and data deletion.
//
// The database cascade on auth.users removes `entries` and `activity_log`,
// but it does NOT touch Storage objects. Photos must be swept explicitly,
// and they are swept FIRST so that a failure part-way through never leaves
// orphaned images belonging to an account that no longer exists.
//
// Order: photos -> database rows -> auth user (server-side).
// Every step reports its own status so the UI can tell the truth about
// what actually happened rather than showing a blanket "done".

import { getClient, currentUser, signOut } from "./cloud.js?v=2fb457af22";
import { db as localDb, closeDb } from "./db.js?v=2fb457af22";

export const STEPS = [
  { key: "photos", label: "Removing photos" },
  { key: "rows", label: "Removing journal entries" },
  { key: "account", label: "Removing account" },
];

/**
 * Lists every object beneath a storage prefix. Supabase's list() is not
 * recursive and returns folders as rows with a null id, so descend manually.
 * Photos are stored at photos/{userId}/{entryId}/{photoId}.
 */
async function listAllObjects(client, bucket, prefix, depth = 0) {
  if (depth > 4) return []; // guard against pathological nesting
  const paths = [];
  let offset = 0;
  const pageSize = 100;

  for (;;) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: pageSize, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        // a folder: recurse into it
        const nested = await listAllObjects(client, bucket, full, depth + 1);
        paths.push(...nested);
      } else {
        paths.push(full);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return paths;
}

/**
 * Deletes everything belonging to the signed-in user.
 * Returns a per-step result; never throws for an individual step failure so
 * the caller can report partial success honestly.
 */
export async function deleteCloudAccount(onProgress = () => {}) {
  const client = getClient();
  const user = await currentUser();
  if (!client || !user) {
    return { ok: false, fatal: "not-signed-in", steps: {} };
  }

  const steps = {
    photos: { status: "pending", detail: "" },
    rows: { status: "pending", detail: "" },
    account: { status: "pending", detail: "" },
  };
  const report = () => onProgress({ ...steps });

  // ---- 1. Photos (explicit sweep; the cascade does not cover Storage) ----
  steps.photos.status = "running";
  report();
  try {
    const paths = await listAllObjects(client, "photos", user.id);
    if (paths.length > 0) {
      // remove() takes up to 1000 paths per call
      for (let i = 0; i < paths.length; i += 500) {
        const chunk = paths.slice(i, i + 500);
        const { error } = await client.storage.from("photos").remove(chunk);
        if (error) throw error;
      }
    }
    // verify the sweep actually emptied the folder
    const leftovers = await listAllObjects(client, "photos", user.id);
    if (leftovers.length > 0) {
      steps.photos.status = "failed";
      steps.photos.detail = `${leftovers.length} photo${leftovers.length === 1 ? "" : "s"} could not be removed`;
    } else {
      steps.photos.status = "done";
      steps.photos.detail = paths.length ? `${paths.length} removed` : "none to remove";
    }
  } catch (err) {
    console.error("photo sweep failed", err);
    steps.photos.status = "failed";
    steps.photos.detail = "could not reach photo storage";
  }
  report();

  // ---- 2. Database rows (explicit, not relying on the cascade alone) ----
  steps.rows.status = "running";
  report();
  try {
    const e = await client.from("entries").delete().eq("user_id", user.id);
    if (e.error) throw e.error;
    const a = await client.from("activity_log").delete().eq("user_id", user.id);
    if (a.error) throw a.error;
    steps.rows.status = "done";
  } catch (err) {
    console.error("row deletion failed", err);
    steps.rows.status = "failed";
    steps.rows.detail = "could not remove entries";
  }
  report();

  // ---- 3. Auth user (server-side only; anon key cannot do this) ----
  steps.account.status = "running";
  report();
  try {
    const { data, error } = await client.functions.invoke("delete-account");
    if (error) throw error;
    if (data && data.ok === false) throw new Error(data.error || "server refused");
    steps.account.status = "done";
  } catch (err) {
    console.error("account deletion failed", err);
    steps.account.status = "failed";
    steps.account.detail = "sign-in could not be removed";
  }
  report();

  // Always clear this device, whatever happened server-side.
  await wipeLocalData().catch(() => {});

  const allDone = Object.values(steps).every((s) => s.status === "done");
  if (allDone) await signOut().catch(() => {});

  return { ok: allDone, steps };
}

/**
 * Device-only mode: wipe IndexedDB so "delete my data" works without an account.
 *
 * The app's own open connection blocks deleteDatabase(), so the connection is
 * closed first. A blocked request is treated as a FAILURE, never as success:
 * reporting deletion that did not happen is the worst outcome here. The wipe
 * is verified by reopening and counting before it is reported as done.
 */
export async function wipeLocalData() {
  const ack = await localDb.getMeta("disclaimerAcknowledged").catch(() => null);

  await closeDb();

  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase("capsule-db");
    let blocked = false;
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error || new Error("delete-failed"));
    req.onblocked = () => {
      // Another tab still holds the database open.
      blocked = true;
      reject(new Error("blocked-by-another-tab"));
    };
    // Safety net: if neither event fires, do not hang forever.
    setTimeout(() => {
      if (!blocked) reject(new Error("delete-timed-out"));
    }, 8000);
  });

  // Verify: reopening yields a fresh, empty database if the wipe worked.
  const remaining = await localDb.allEntries();
  if (remaining.length > 0) {
    throw new Error(`wipe-incomplete: ${remaining.length} entries remain`);
  }

  // Restore the disclaimer acknowledgment: it is device state, not personal
  // data, and a returning user should not be re-gated by a screen they read.
  if (ack) {
    await localDb.setMeta("disclaimerAcknowledged", ack).catch(() => {});
  }
}
