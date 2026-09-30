import type { Cents } from "@/domain";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMoney(cents: Cents): string {
  return money.format(cents / 100);
}

const compactMoney = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Like formatMoney but drops ".00", for tight tables. */
export function formatMoneyCompact(cents: Cents): string {
  return compactMoney.format(cents / 100);
}

/** Signed amount: "+$1,205" or "-$300". */
export function formatNet(cents: Cents): string {
  return `${cents > 0 ? "+" : cents < 0 ? "-" : ""}${formatMoneyCompact(Math.abs(cents))}`;
}

export function playerName(player: { nickname: string | null; display_name: string }): string {
  return player.nickname ?? player.display_name;
}
