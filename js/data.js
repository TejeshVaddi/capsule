// Storage facade. Views import { db, newId } from here and never care
// whether the person is signed in (cloud/Supabase) or device-only (IndexedDB).
//
// Meta (disclaimer acknowledgment, mode choice) always stays local, it's
// about this device, not the account.

import { db as localDb, newId } from "./db.js?v=611e55e30f";
import { cloudDb, getSession } from "./cloud.js?v=611e55e30f";
import { cloudConfigured } from "./config.js?v=611e55e30f";

export { newId };

let signedIn = false;

/** Call once at boot (and after sign-in/out) to set the active backend. */
export async function refreshDataMode() {
  signedIn = cloudConfigured() && Boolean(await getSession());
  return signedIn;
}

export function isCloudMode() {
  return signedIn;
}

function backend() {
  return signedIn ? cloudDb : localDb;
}

export const db = {
  putEntry: (entry) => backend().putEntry(entry),
  getEntry: (id) => backend().getEntry(id),
  deleteEntry: (id) => backend().deleteEntry(id),
  allEntries: () => backend().allEntries(),
  entriesByType: (type) => backend().entriesByType(type),
  putPhoto: (photo) => backend().putPhoto(photo),
  getPhotosForEntry: (entryId) => backend().getPhotosForEntry(entryId),
  deletePhoto: (id) => backend().deletePhoto(id),
  logActivity: (record) => backend().logActivity(record),
  allActivityLog: () => backend().allActivityLog(),

  // device-scoped, always local
  setMeta: (key, value) => localDb.setMeta(key, value),
  getMeta: (key) => localDb.getMeta(key),
};

/** Copies device-only entries (and photos) into the signed-in account. */
export async function migrateLocalToCloud(onProgress = () => {}) {
  const localEntries = await localDb.allEntries();
  let done = 0;
  for (const entry of localEntries) {
    await cloudDb.putEntry(entry);
    const photos = await localDb.getPhotosForEntry(entry.id);
    for (const p of photos) await cloudDb.putPhoto(p);
    done++;
    onProgress(done, localEntries.length);
  }
  return done;
}

export async function localEntryCount() {
  const entries = await localDb.allEntries();
  return entries.length;
}
