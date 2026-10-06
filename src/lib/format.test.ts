import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyCompact, formatNet } from "./format";

describe("formatMoney", () => {
  it("always shows cents", () => {
    expect(formatMoney(1200_00)).toBe("$1,200.00");
    expect(formatMoney(562_50)).toBe("$562.50");
  });
});

describe("formatMoneyCompact", () => {
  it("drops the cents of whole amounts", () => {
    expect(formatMoneyCompact(1200_00)).toBe("$1,200");
    expect(formatMoneyCompact(0)).toBe("$0");
  });

  it("never shows a single decimal", () => {
    // A weekly prize split in two: $1,125 / 2.
    expect(formatMoneyCompact(562_50)).toBe("$562.50");
    expect(formatMoneyCompact(128_57)).toBe("$128.57");
    expect(formatMoneyCompact(30_05)).toBe("$30.05");
  });
});

describe("formatNet", () => {
  it("signs what was won or lost", () => {
    expect(formatNet(1205_00)).toBe("+$1,205");
    expect(formatNet(-300_00)).toBe("-$300");
    expect(formatNet(262_50)).toBe("+$262.50");
    expect(formatNet(-246_43)).toBe("-$246.43");
  });

  it("has no sign at zero", () => {
    expect(formatNet(0)).toBe("$0");
  });
});
