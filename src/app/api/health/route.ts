import { NextResponse } from "next/server";

// Example Route Handler — your backend endpoints will live under src/app/api/**.
export function GET() {
  return NextResponse.json({ ok: true, service: "bean-and-co", time: new Date().toISOString() });
}
