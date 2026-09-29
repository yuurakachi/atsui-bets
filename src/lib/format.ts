import type { Cents } from "@/domain";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMoney(cents: Cents): string {
  return money.format(cents / 100);
}

export function playerName(player: { nickname: string | null; display_name: string }): string {
  return player.nickname ?? player.display_name;
}
