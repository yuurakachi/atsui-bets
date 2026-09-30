import { describe, expect, it } from "vitest";
import { reminderMessage, type ReminderInput } from "./reminders";

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
});
