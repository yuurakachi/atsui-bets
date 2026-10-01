import { describe, expect, it } from "vitest";
import { nextDayEvents, reminderMessage, type ReminderInput } from "./reminders";

const base: ReminderInput = {
  sport: "liga_mx",
  poolName: "Liga MX",
  roundName: "J11",
  lockAt: new Date("2026-10-09T05:59:00Z"), // Thu Oct 8, 23:59 in Mexico City
  url: "https://example.com/r/11",
  missing: [],
  openEvents: 9,
  players: 3,
};

describe("reminderMessage", () => {
  it("announces the round when nobody has picked yet", () => {
    const text = reminderMessage({
      ...base,
      missing: [
        { name: "Ana", count: 9 },
        { name: "Beto", count: 9 },
        { name: "Caro", count: 9 },
      ],
    });
    expect(text).toBe(
      [
        "⚽ *Liga MX · Jornada 11*",
        "¡Ya están abiertos los pics!",
        "Los pics cierran el *jueves 8 de octubre a las 23:59*.",
        "",
        "👉 https://example.com/r/11",
      ].join("\n"),
    );
  });

  it("names who is missing picks and how many when partial", () => {
    const text = reminderMessage({
      ...base,
      missing: [
        { name: "Ana", count: 9 },
        { name: "Caro", count: 2 },
      ],
    });
    expect(text).toContain("Faltan: Ana, Caro (le faltan 2)");
    expect(text).toContain("cierran el *jueves 8 de octubre a las 23:59*");
  });

  const nfl: ReminderInput = {
    ...base,
    sport: "nfl",
    poolName: "NFL 2026",
    roundName: "Semana 5",
    lockAt: new Date("2026-10-11T16:55:00Z"), // Sun Oct 11, 10:55 in Mexico City
    openEvents: 12,
  };

  it("chases one day of NFL games at a time", () => {
    const text = reminderMessage({ ...nfl, missing: [{ name: "Ana", count: 12 }, { name: "Caro", count: 3 }] });
    expect(text).toBe(
      [
        "🏈 *NFL 2026 · Semana 5*",
        "Los 12 juegos del *domingo 11 de octubre* cierran uno por uno; el primero a las *10:55*.",
        "",
        "Faltan: Ana, Caro (le faltan 3)",
        "",
        "👉 https://example.com/r/11",
      ].join("\n"),
    );
  });

  it("names the single game of a Thursday or Monday night", () => {
    const text = reminderMessage({ ...nfl, lockAt: new Date("2026-10-09T00:10:00Z"), openEvents: 1 });
    expect(text).toContain("El juego del *jueves 8 de octubre* cierra a las *18:10*.");
  });
});

describe("nextDayEvents", () => {
  it("keeps the events locking on the first day, in Mexico City time", () => {
    const events = [
      { id: "mon", lockAt: new Date("2026-10-13T00:10:00Z") },
      { id: "sun-night", lockAt: new Date("2026-10-12T00:15:00Z") }, // Sun 18:15
      { id: "sun-early", lockAt: new Date("2026-10-11T16:55:00Z") },
    ];
    expect(nextDayEvents(events).map((e) => e.id)).toEqual(["sun-night", "sun-early"]);
    expect(nextDayEvents([])).toEqual([]);
  });
});
