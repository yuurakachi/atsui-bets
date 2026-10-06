import type { Cents } from "@/domain";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMoney(cents: Cents): string {
  return money.format(cents / 100);
}

const wholeMoney = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

/** Like formatMoney but drops ".00", for tight tables. Amounts with cents keep both decimals. */
export function formatMoneyCompact(cents: Cents): string {
  return cents % 100 === 0 ? wholeMoney.format(cents / 100) : money.format(cents / 100);
}

/** Signed amount: "+$1,205", "-$262.50" or "$0". */
export function formatNet(cents: Cents): string {
  return `${cents > 0 ? "+" : cents < 0 ? "-" : ""}${formatMoneyCompact(Math.abs(cents))}`;
}

export function playerName(player: { nickname: string | null; display_name: string }): string {
  return player.nickname ?? player.display_name;
}
