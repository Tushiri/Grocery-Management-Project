import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

type AuthenticatedContext = {
  supabase: Awaited<ReturnType<typeof supabaseServer>>;
  user: { id: string };
};

export async function requireAuthenticatedUser():
  Promise<AuthenticatedContext | NextResponse> {
  const supabase = await supabaseServer();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return { supabase, user: { id: userData.user.id } };
}

export async function parseJsonBody<T>(req: Request): Promise<T | NextResponse> {
  try {
    return (await req.json()) as T;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
