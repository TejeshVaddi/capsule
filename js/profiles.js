// One account, one person, or one account and a house full of them.
//
// Capsule began as a single person's journal. A care centre signs up once
// and then needs a separate Capsule for every resident: separate days,
// separate activities, separate streak, separate trends. Nothing about one
// resident may ever appear in another's.
//
// How that is kept apart. Every entry and every activity written while a
// resident is open carries their `profileId`, and every read is filtered to
// the resident who is open. The filtering happens once, in data.js, which
// every view already goes through, so the journal, the activities, the
// trends and the streak are unchanged: each one asks for "the entries" and
// is handed that resident's.
//
// Personal use writes no profileId at all. That is deliberate rather than
// tidy: it means an existing journal needs no migration, and an account
// holder's own days can never be served up under a resident's name.
//
// Per-person state lives in meta (the streak, which activities were chosen
// today, whether the week has been shown). Those keys are namespaced per
// resident for the same reason. Keys about the device or the account, like
// having read the disclaimer, stay shared.

import { db as localDb, newId } from "./db.js?v=9d6a2c4f69";
import { cloudDb, getSession } from "./cloud.js?v=9d6a2c4f69";
import { cloudConfigured } from "./config.js?v=9d6a2c4f69";

/**
 * Where the people live. Signed in, they belong to the account, so a centre
 * that picks up a different tablet finds the same residents and the same
 * streaks. Signed out, they are on this device, like everything else.
 *
 * Read fresh each time rather than cached: signing in or out changes the
 * answer, and a stale one here would write a resident into the wrong place.
 */
async function store() {
  if (!cloudConfigured()) return localDb;
  return (await getSession().catch(() => null)) ? cloudDb : localDb;
}

export const ACCOUNT_TYPE_META = "accountType"; // "personal" | "centre"
const ACTIVE_KEY = "capsule.activeProfile";

/**
 * Meta that belongs to a person rather than to the device or the account.
 * Anything here is stored under the open resident; anything else is shared.
 */
export const PERSON_META = new Set([
  "streak",
  "celebratedOn",
  "weeklyShownFor",
  "monthlyShownFor",
  "requiredActivities",
  "rhythm",
  "walkthroughSeen",
]);

/** The meta key to actually read or write, given who is open. */
export function scopedMetaKey(key, profileId) {
  return profileId && PERSON_META.has(key) ? `p:${profileId}:${key}` : key;
}

/* ---------------- Which account this is ---------------- */

export async function getAccountType() {
  return (await localDb.getMeta(ACCOUNT_TYPE_META).catch(() => null)) || null;
}

export async function setAccountType(type) {
  await localDb.setMeta(ACCOUNT_TYPE_META, type);
}

export async function isCentre() {
  return (await getAccountType()) === "centre";
}

/* ---------------- Who is open ---------------- */
//
// Held in sessionStorage rather than in the database: a resident being open
// is about this sitting at this screen, not something true of the account.
// Closing the tab closes the resident, which is the safe default in a
// shared room, and a reload in the middle of a session keeps them open.

let active = null;
try {
  active = sessionStorage.getItem(ACTIVE_KEY) || null;
} catch {
  /* private window: the resident simply does not survive a reload */
}

export function activeProfileId() {
  return active;
}

export function openProfile(id) {
  active = id || null;
  try {
    if (active) sessionStorage.setItem(ACTIVE_KEY, active);
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    /* non-fatal */
  }
}

export function closeProfile() {
  openProfile(null);
}

/* ---------------- The residents ---------------- */

/** Everyone in this account, in the order a list of people should read. */
export async function listProfiles() {
  const all = await (await store()).allProfiles().catch(() => []);
  return all.sort((a, b) => sortName(a).localeCompare(sortName(b), undefined, { sensitivity: "base" }));
}

// Sorted by last name where there is one, the way a residents list is kept
// on paper, so two Margarets do not sit apart from their own surnames.
function sortName(p) {
  const parts = (p.name || "").trim().split(/\s+/);
  return parts.length > 1 ? `${parts[parts.length - 1]} ${parts[0]}` : parts[0] || "";
}

export async function getProfile(id) {
  if (!id) return null;
  return (await (await store()).getProfile(id).catch(() => null)) || null;
}

/**
 * What a member of staff can see about a resident without that resident
 * being there.
 *
 * Capsule's whole premise is that a journal belongs to the person who wrote
 * it. A centre has to be able to see who still has their day to do, which
 * is a practical question about running a house. It does not have to see
 * how that person's words have been changing, which is not.
 *
 * So the default is the narrow one. A centre can widen it per resident, for
 * a person who has said that is fine, rather than for the house at once.
 *
 * Neither setting shows a resident's entries on a staff screen: nothing
 * here ever has. What both leave open is that opening somebody's Capsule
 * hands over their whole journal, which is the point of opening it, and the
 * app says so rather than implying a setting prevents it.
 */
export const STAFF_ACCESS = {
  private: {
    key: "private",
    label: "Just their streak and today's list",
    detail: "Staff can see whether this person has finished today and how long their run is, and nothing else. Their patterns are kept for them.",
  },
  shared: {
    key: "shared",
    label: "Also how their patterns are moving",
    detail: "Staff can also see how this person's own measures have changed over time. Choose this only if they have agreed to it.",
  },
};

export const DEFAULT_STAFF_ACCESS = "private";

export function staffAccessOf(profile) {
  return STAFF_ACCESS[profile?.staffAccess]?.key || DEFAULT_STAFF_ACCESS;
}

/** Creates or updates one. `name` is the only thing actually required. */
export async function saveProfile({ id, name, dob = "", photoId = null, staffAccess }) {
  const trimmed = (name || "").trim();
  if (!trimmed) throw new Error("A name is needed");
  const existing = id ? await getProfile(id) : null;
  const profile = {
    id: id || newId(),
    name: trimmed,
    dob: dob || "",
    photoId: photoId !== undefined ? photoId : existing?.photoId || null,
    // Narrow unless somebody has chosen to widen it.
    staffAccess: STAFF_ACCESS[staffAccess]?.key || staffAccessOf(existing),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  await (await store()).putProfile(profile);
  return profile;
}

/**
 * Removes a resident and everything of theirs: their days, their photos,
 * their activities and their streak. A resident who has left should not be
 * left behind in the database of the home they have left.
 */
export async function deleteProfile(id) {
  if (!id) return;
  const where = await store();
  if (where === cloudDb) {
    await cloudDb.deleteProfile(id);
    if (active === id) closeProfile();
    return;
  }
  const entries = await localDb.allEntries().catch(() => []);
  for (const e of entries.filter((x) => x.profileId === id)) {
    const photos = await localDb.getPhotosForEntry(e.id).catch(() => []);
    for (const photo of photos) await localDb.deletePhoto(photo.id).catch(() => {});
    await localDb.deleteEntry(e.id).catch(() => {});
  }
  const log = await localDb.allActivityLog().catch(() => []);
  for (const r of log.filter((x) => x.profileId === id)) {
    await localDb.deleteActivity(r.id).catch(() => {});
  }
  const profile = await getProfile(id);
  if (profile?.photoId) await localDb.deletePhoto(profile.photoId).catch(() => {});
  for (const key of PERSON_META) {
    await localDb.deleteMeta(scopedMetaKey(key, id)).catch(() => {});
  }
  await localDb.deleteProfile(id);
  if (active === id) closeProfile();
}

/** First name, for greeting someone by it. */
export function firstNameOf(profile) {
  return (profile?.name || "").trim().split(/\s+/)[0] || "";
}

/**
 * A date of birth as a date in this place, not in UTC.
 *
 * new Date("1938-04-12") is midnight UTC, which anywhere west of it is the
 * evening of the 11th, so a birthday typed into the form came back a day
 * early. A date of birth has no time and no timezone; it is read as the
 * day it says.
 */
export function dateOfBirth(dob) {
  if (!dob) return null;
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  const d = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(dob);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Age from a date of birth, or null when there is not one. */
export function ageFrom(dob) {
  const born = dateOfBirth(dob);
  if (!born) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (beforeBirthday) age--;
  return age >= 0 && age < 130 ? age : null;
}
