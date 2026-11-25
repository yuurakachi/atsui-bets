import { describe, expect, it } from "vitest";
import { axisLabels, pointAt } from "./chart-scale";

describe("pointAt", () => {
  // Five points at x = 34 + 50, 34 + 100, … 34 + 250.
  const at = (x: number) => pointAt(x, 34, 50, 5);

  it("picks the point under the finger", () => {
    expect(at(84)).toBe(0);
    expect(at(184)).toBe(2);
    expect(at(284)).toBe(4);
  });

  it("picks the nearest point between two", () => {
    expect(at(84 + 24)).toBe(0);
    expect(at(84 + 26)).toBe(1);
  });

  it("stays on the first or last point past the ends", () => {
    expect(at(0)).toBe(0);
    expect(at(320)).toBe(4);
  });

  it("always picks the only point", () => {
    expect(pointAt(10, 34, 274, 1)).toBe(0);
    expect(pointAt(320, 34, 274, 1)).toBe(0);
  });
});

describe("axisLabels", () => {
  it("keeps every label when they fit", () => {
    expect(axisLabels(["oct", "nov", "dic"], 90)).toEqual(["oct", "nov", "dic"]);
  });

  it("numbers the points when the labels don't fit, keeping the close as it is", () => {
    expect(axisLabels(["oct", "nov", "fin"], 20, (i) => i === 2)).toEqual(["1", "2", "fin"]);
  });
});
