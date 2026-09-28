import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Google sends the user back here with a one-time code that becomes the session. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
    console.error("[auth/callback] code exchange failed:", error.code, error.message);
  } else {
    console.error("[auth/callback] no code:", request.nextUrl.searchParams.get("error_description"));
  }

  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
