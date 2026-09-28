import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";

export interface CurrentPlayer {
  id: string;
  displayName: string;
  nickname: string | null;
  isAdmin: boolean;
}

/** The signed-in account, or a redirect to /login. */
export const requireAccount = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");
  return { userId: data.claims.sub, email: data.claims.email as string | undefined };
});

/**
 * The registered player behind the session. Accounts that aren't linked to a player
 * (their email was never registered by an admin) go to /sin-acceso.
 */
export const requirePlayer = cache(async (): Promise<CurrentPlayer> => {
  const { userId } = await requireAccount();
  const supabase = await createClient();
  const { data: player } = await supabase
    .from("players")
    .select("id, display_name, nickname, is_admin")
    .eq("user_id", userId)
    .maybeSingle();

  if (!player) redirect("/sin-acceso");

  return {
    id: player.id,
    displayName: player.display_name,
    nickname: player.nickname,
    isAdmin: player.is_admin,
  };
});
