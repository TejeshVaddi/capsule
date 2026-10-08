// Storage facade. Views import { db, newId } from here and never care
// whether the person is signed in (cloud/Supabase) or device-only
// (IndexedDB), nor which resident of a care centre is open.
//
// Both of those are decided here, in one place, for a reason. Every view
// asks for "the entries" and gets the ones belonging to whoever is open,
// so the journal, the activities, the trends, the streak and the memory
// visits needed no changes at all to work for a house full of people.
//
// The scoping rule, in full:
//   personal use   no profile is open, writes carry no profileId, and reads
//                  return only entries that carry none. An existing journal
//                  therefore needs no migration.
//   a centre       the open resident's id is stamped on everything written
//                  and every read is filtered to it. Nothing untagged, and
//                  nothing of another resident's, can come back.
// See profiles.js.
//
// Meta about the device or the account (the disclaimer, which kind of
// account this is) always stays local and shared. Meta about a person (the
// streak, today's chosen activities) is namespaced per resident.

import { db as localDb, newId } from "./db.js?v=c44468da07";
import { cloudDb, getSession } from "./cloud.js?v=c44468da07";
import { cloudConfigured } from "./config.js?v=c44468da07";
import { activeProfileId, scopedMetaKey, PERSON_META } from "./profiles.js?v=c44468da07";

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

/**
 * Whose records a call is about. Left out, it is whoever is open on screen.
 *
 * Passed in, it is that resident, and nothing global changes. This matters:
 * the residents list asks for every resident's streak while the rest of the
 * app is still starting up, and an earlier version did it by swapping the
 * open resident for a moment. Anything else running at that moment saw the
 * wrong person. A read says who it is for instead.
 */
const scopeOf = (profileId) => (profileId === undefined ? activeProfileId() : profileId);

/** True when a record belongs to the person a call is about. */
const mineFor = (scope) => (record) => (scope ? record?.profileId === scope : !record?.profileId);

/** Stamps a record with whoever is open, so it comes back to them later. */
function stamp(record) {
  const open = activeProfileId();
  return open ? { ...record, profileId: open } : record;
}

export const db = {
  putEntry: (entry) => backend().putEntry(stamp(entry)),
  getEntry: async (id) => {
    const entry = await backend().getEntry(id);
    // Looked up by id, so it still has to be checked: an id from one
    // resident's screen must not fetch another resident's day.
    return entry && mineFor(activeProfileId())(entry) ? entry : undefined;
  },
  deleteEntry: (id) => backend().deleteEntry(id),
  allEntries: async (profileId) => (await backend().allEntries()).filter(mineFor(scopeOf(profileId))),
  entriesByType: async (type, profileId) => (await backend().entriesByType(type)).filter(mineFor(scopeOf(profileId))),
  putPhoto: (photo) => backend().putPhoto(photo),
  getPhotosForEntry: (entryId) => backend().getPhotosForEntry(entryId),
  deletePhoto: (id) => backend().deletePhoto(id),
  logActivity: (record) => backend().logActivity(stamp(record)),
  allActivityLog: async (profileId) => (await backend().allActivityLog()).filter(mineFor(scopeOf(profileId))),

  /**
   * Meta about the device or the account stays on the device: having read
   * the disclaimer is true of this browser, not of a person.
   *
   * Meta about a person (the streak, today's chosen activities) follows the
   * account when there is one, so a centre that picks up a different tablet
   * finds the same streaks rather than starting everybody at zero.
   */
  setMeta: async (key, value, profileId) => {
    const scope = scopeOf(profileId);
    if (signedIn && PERSON_META.has(key)) return cloudDb.setProfileState(scope, key, value);
    return localDb.setMeta(scopedMetaKey(key, scope), value);
  },
  getMeta: async (key, profileId) => {
    const scope = scopeOf(profileId);
    if (signedIn && PERSON_META.has(key)) {
      const fromCloud = await cloudDb.getProfileState(scope, key).catch(() => undefined);
      if (fromCloud !== undefined && fromCloud !== null) return fromCloud;
    }
    return localDb.getMeta(scopedMetaKey(key, scope));
  },

  /** Says this person finished today, which is what the 7pm email reads. */
  markDayComplete: async (day, profileId) => {
    if (!signedIn) return;
    await cloudDb.markDayComplete(scopeOf(profileId), day).catch((err) => console.error(err));
  },
};

/**
 * Everything on this device, whoever is open and whoever is signed in.
 * Used by the account screens, which talk about the device as a whole
 * rather than about one person's journal.
 */
export async function localEntryCount() {
  const entries = await localDb.allEntries();
  return entries.length;
}
