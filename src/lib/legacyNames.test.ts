// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { adoptOldStorage } from "./legacyNames";

beforeEach(() => localStorage.clear());

describe("adopting the BudgetTrack storage keys", () => {
  it("carries the data, the tab, the filters and the engine's keys over to the new names and removes the old ones", () => {
    const data = JSON.stringify({ version: 4, accounts: [{ id: 1, name: "Everyday" }], transactions: [] });
    localStorage.setItem("budget-track-data", data);
    localStorage.setItem("budget-track-tab", "graphs");
    localStorage.setItem("budget-track.appearance", '{"theme":"nord","ui":"default"}');
    localStorage.setItem("budget-track.themes", "{}");
    expect(adoptOldStorage(localStorage)).toBe(4);
    expect(localStorage.getItem("turbobudget-data")).toBe(data);
    expect(localStorage.getItem("turbobudget-tab")).toBe("graphs");
    expect(localStorage.getItem("turbobudget.appearance")).toBe('{"theme":"nord","ui":"default"}');
    expect(localStorage.getItem("turbobudget.themes")).toBe("{}");
    expect(Object.keys(localStorage).filter((k) => k.startsWith("budget-track"))).toEqual([]);
  });

  it("keeps newer data when the new name already exists, and still removes the stale old key", () => {
    localStorage.setItem("budget-track-data", "OLD");
    localStorage.setItem("turbobudget-data", "NEW");
    expect(adoptOldStorage(localStorage)).toBe(0);
    expect(localStorage.getItem("turbobudget-data")).toBe("NEW");
    expect(localStorage.getItem("budget-track-data")).toBeNull();
  });

  it("is safe to run twice, and does nothing on a fresh browser", () => {
    expect(adoptOldStorage(localStorage)).toBe(0);
    localStorage.setItem("budget-track-data", "x");
    expect(adoptOldStorage(localStorage)).toBe(1);
    expect(adoptOldStorage(localStorage)).toBe(0);
    expect(localStorage.getItem("turbobudget-data")).toBe("x");
  });

  it("leaves other keys alone", () => {
    localStorage.setItem("something-else", "1");
    localStorage.setItem("budget-track-data", "x");
    adoptOldStorage(localStorage);
    expect(localStorage.getItem("something-else")).toBe("1");
  });

  it("never removes an old key whose copy failed, so nothing can be lost", () => {
    localStorage.setItem("budget-track-data", "precious");
    const real = localStorage;
    const fake = {
      get length() { return real.length; },
      key: (i: number) => real.key(i),
      getItem: (k: string) => real.getItem(k),
      removeItem: (k: string) => real.removeItem(k),
      setItem: () => { throw new Error("QuotaExceededError"); },
      clear: () => real.clear(),
    } as Storage;
    expect(adoptOldStorage(fake)).toBe(0);
    expect(localStorage.getItem("budget-track-data")).toBe("precious");
  });
});
