import { describe, expect, it } from "vitest";
import { liveOutcome } from "./live";

describe("liveOutcome", () => {
  it("prefers the official result", () => {
    expect(liveOutcome("draw", { state: "post", result: "home", score: { home: 1, away: 0 } })).toEqual({
      outcome: "draw",
      final: true,
    });
  });

  it("is unknown before kickoff", () => {
    expect(liveOutcome(null, { state: "pre", result: null, score: null })).toBeNull();
    expect(liveOutcome(null, undefined)).toBeNull();
  });

  it("follows the score while the match is on", () => {
    expect(liveOutcome(null, { state: "in", result: null, score: { home: 0, away: 1 } })).toEqual({
      outcome: "away",
      final: false,
    });
    expect(liveOutcome(null, { state: "in", result: null, score: { home: 2, away: 2 } })).toEqual({
      outcome: "draw",
      final: false,
    });
  });

  it("is final once ESPN marks it finished or void", () => {
    expect(liveOutcome(null, { state: "post", result: "home", score: { home: 2, away: 1 } })).toEqual({
      outcome: "home",
      final: true,
    });
    expect(liveOutcome(null, { state: "post", result: "void", score: null })).toEqual({
      outcome: "void",
      final: true,
    });
  });
});
