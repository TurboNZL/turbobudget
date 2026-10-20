/**
 * TurboBudget was called BudgetTrack until 2026-10-20. Everything it keeps in the browser used the old prefix: the app's own keys
 * (`budget-track-data`, `budget-track-tab`, ...) and the theme engine's (`budget-track.appearance`, `.themes`, ...). Renaming a storage
 * key without carrying the data over would look like losing every account, so this runs once, first (main.tsx imports it before
 * anything reads storage): each `budget-track*` key is copied to its `turbobudget*` name and the old one removed.
 *
 * A key that already exists under the new name wins (that is newer data), and an old key is only removed after its copy succeeded.
 * Delete this file, its import in main.tsx and its test once every device has run this version (the engine's rule for renames).
 * Note: localStorage is per address, so this helps a browser that opens the app at the same address; moving to a new address starts
 * empty and needs Data > export, then import there.
 */
export const OLD_PREFIX = "budget-track";
export const NEW_PREFIX = "turbobudget";

/** Returns how many keys were carried over. Never throws: storage can be blocked, and then the defaults apply. */
export const adoptOldStorage = (ls: Storage | undefined = typeof window === "undefined" ? undefined : window.localStorage): number => {
  if (!ls) return 0;
  let moved = 0;
  try {
    const old: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(OLD_PREFIX)) old.push(k);
    }
    for (const key of old) {
      const next = NEW_PREFIX + key.slice(OLD_PREFIX.length);
      try {
        if (ls.getItem(next) === null) {
          const value = ls.getItem(key);
          if (value !== null) {
            ls.setItem(next, value);
            moved++;
          }
        }
        ls.removeItem(key);
      } catch {
        // full or blocked: leave the old key where it is, so nothing is lost
      }
    }
  } catch {
    // storage unavailable
  }
  return moved;
};

adoptOldStorage();
