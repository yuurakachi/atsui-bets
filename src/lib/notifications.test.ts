import { describe, expect, it } from "vitest";
import { closingMessage, openedMessage, winnerMessage } from "./notifications";

describe("openedMessage", () => {
  it("announces a Liga MX matchday with its first lock", () => {
    expect(
      openedMessage({
        sport: "liga_mx",
        poolName: "Liga MX",
        roundNames: ["J17"],
        firstLockAt: new Date("2026-11-14T00:55:00Z"), // Fri Nov 13, 18:55
      }),
    ).toEqual({
      title: "⚽ Liga MX · Jornada 17",
      body: "¡Ya están abiertos los pics! El primer partido cierra el viernes 13 de noviembre a las 18:55.",
    });
  });

  it("announces an F1 Sprint and GP together", () => {
    expect(
      openedMessage({
        sport: "f1",
        poolName: "F1 2026",
        roundNames: ["Sprint Brasil", "GP Brasil"],
        firstLockAt: new Date("2026-11-20T17:25:00Z"), // Fri Nov 20, 11:25
      }),
    ).toEqual({
      title: "🏎️ F1 2026 · Sprint Brasil y GP Brasil",
      body: "¡Ya están abiertos los pics! Cierran el viernes 20 de noviembre a las 11:25.",
    });
  });
});

describe("closingMessage", () => {
  const lockAt = new Date("2026-11-14T00:55:00Z"); // 18:55

  it("tells the player how many picks they miss in each pool", () => {
    expect(
      closingMessage({
        lockAt,
        own: [
          { pool: "Liga MX · Jornada 17", missing: 1 },
          { pool: "NFL 2026 · Semana 11", missing: 3 },
        ],
        others: [],
      }),
    ).toEqual({
      title: "⏰ Los pics cierran a las 18:55",
      body: "Te falta 1 pic en Liga MX · Jornada 17. Te faltan 3 en NFL 2026 · Semana 11.",
    });
  });

  it("tells a delegate what the players they enter picks for are missing", () => {
    expect(
      closingMessage({
        lockAt,
        own: [],
        others: [{ name: "Nao", pool: "Liga MX · Jornada 17", missing: 2 }],
      }).body,
    ).toBe("A Nao le faltan 2 pics en Liga MX · Jornada 17.");
  });
});

describe("winnerMessage", () => {
  it("names the winner with points and prize", () => {
    expect(
      winnerMessage({ sport: "nfl", poolName: "NFL 2026", roundName: "Semana 10", winners: ["Ana"], points: 12, prizeEachCents: 1125_00, perfect: [], bonusEachCents: 0 }),
    ).toEqual({ title: "🏆 NFL 2026 · Semana 10", body: "Ganó Ana con 12 pts: $1,125.00." });
  });

  it("splits a tie and adds the perfect-round bonus", () => {
    expect(
      winnerMessage({
        sport: "liga_mx",
        poolName: "Liga MX",
        roundName: "J17",
        winners: ["Ana", "Beto"],
        points: 9,
        prizeEachCents: 562_50,
        perfect: ["Ana", "Beto"],
        bonusEachCents: 1000_00,
      }).body,
    ).toBe("Empate de Ana y Beto con 9 pts: $562.50 c/u. 🎯 Jornada perfecta de Ana y Beto: $1,000.00 c/u del acumulado.");
  });
});
