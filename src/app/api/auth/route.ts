import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  checkPassword,
  createToken,
} from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));

  if (!checkPassword(String(password ?? ""))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = await createToken();
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
