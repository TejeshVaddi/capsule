const DB_NAME = "capsule-db";
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;

      if (!db.objectStoreNames.contains("entries")) {
        const entries = db.createObjectStore("entries", { keyPath: "id" });
        entries.createIndex("byDate", "date");
        entries.createIndex("byType", "type");
        entries.createIndex("byRecallOf", "recallOf");
      }

      if (!db.objectStoreNames.contains("photos")) {
        const photos = db.createObjectStore("photos", { keyPath: "id" });
        photos.createIndex("byEntry", "entryId");
      }

      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains("activityLog")) {
        const activities = db.createObjectStore("activityLog", { keyPath: "id" });
        activities.createIndex("byDate", "date");
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeNames, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const stores = Array.isArray(storeNames)
      ? Object.fromEntries(storeNames.map((n) => [n, transaction.objectStore(n)]))
      : transaction.objectStore(storeNames);
    let result;
    Promise.resolve(fn(stores, transaction))
      .then((r) => { result = r; })
      .catch(reject);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Transaction aborted"));
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  async putEntry(entry) {
    return tx("entries", "readwrite", (store) => reqToPromise(store.put(entry)));
  },

  async getEntry(id) {
    return tx("entries", "readonly", (store) => reqToPromise(store.get(id)));
  },

  async deleteEntry(id) {
    return tx("entries", "readwrite", (store) => reqToPromise(store.delete(id)));
  },

  async allEntries() {
    const result = await tx("entries", "readonly", (store) => reqToPromise(store.getAll()));
    return (result || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  },

  async entriesByType(type) {
    const all = await db.allEntries();
    return all.filter((e) => e.type === type);
  },

  async putPhoto(photo) {
    return tx("photos", "readwrite", (store) => reqToPromise(store.put(photo)));
  },

  async getPhotosForEntry(entryId) {
    return tx("photos", "readonly", (store) => {
      const idx = store.index("byEntry");
      return reqToPromise(idx.getAll(entryId));
    });
  },

  async deletePhoto(id) {
    return tx("photos", "readwrite", (store) => reqToPromise(store.delete(id)));
  },

  async setMeta(key, value) {
    return tx("meta", "readwrite", (store) => reqToPromise(store.put({ key, value })));
  },

  async getMeta(key) {
    const row = await tx("meta", "readonly", (store) => reqToPromise(store.get(key)));
    return row ? row.value : undefined;
  },

  async logActivity(record) {
    return tx("activityLog", "readwrite", (store) => reqToPromise(store.put(record)));
  },

  async allActivityLog() {
    const result = await tx("activityLog", "readonly", (store) => reqToPromise(store.getAll()));
    return (result || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  },
};

/**
 * Closes the cached connection and clears it. Required before
 * indexedDB.deleteDatabase(), which is otherwise blocked by any open
 * connection and will silently never complete.
 */
export async function closeDb() {
  if (!dbPromise) return;
  try {
    const database = await dbPromise;
    database.close();
  } catch {
    /* already closed or failed to open */
  }
  dbPromise = null;
}

export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
