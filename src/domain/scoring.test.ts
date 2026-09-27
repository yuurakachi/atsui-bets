import { describe, expect, it } from "vitest";
import { isValidNflPick, scoreF1Pick, scoreMatchPicks, validateF1Pick } from "./scoring";

describe("scoreMatchPicks", () => {
  const matches = [
    { id: "m1", result: "home" as const },
    { id: "m2", result: "draw" as const },
    { id: "m3", result: "away" as const },
    { id: "m4", result: "void" as const },
    { id: "m5", result: null },
  ];

  it("gives 1 point per correct pick", () => {
    expect(scoreMatchPicks(matches, { m1: "home", m2: "draw", m3: "home" })).toBe(2);
  });

  it("scores 0 for missing picks", () => {
    expect(scoreMatchPicks(matches, {})).toBe(0);
  });

  it("ignores void and unfinished matches", () => {
    expect(scoreMatchPicks(matches, { m4: "home", m5: "away" })).toBe(0);
  });

  it("awards no points for an NFL tie", () => {
    expect(scoreMatchPicks([{ id: "g1", result: "draw" }], { g1: "home" })).toBe(0);
    expect(isValidNflPick("draw")).toBe(false);
  });
});

describe("F1", () => {
  const classification = ["VER", "NOR", "LEC", "PIA", "HAM", "RUS", "SAI", "ALO", "GAS", "ALB", "OCO"];

  it("gives 1 point per exact position", () => {
    const pick = ["VER", "LEC", "NOR", "PIA", "HAM", "RUS", "ALO", "SAI", "GAS", "OCO"];
    // exact: VER, PIA, HAM, RUS, GAS
    expect(scoreF1Pick(pick, classification)).toBe(5);
  });

  it("scores empty positions as 0", () => {
    expect(scoreF1Pick(["VER", null, null, null, null, null, null, null, null, null], classification)).toBe(1);
  });

  it("rejects repeated drivers and wrong lengths", () => {
    expect(validateF1Pick(["VER", "VER", null, null, null, null, null, null, null, null])).toHaveLength(1);
    expect(validateF1Pick(["VER"])).toHaveLength(1);
    expect(validateF1Pick(classification.slice(0, 10))).toEqual([]);
  });
});
