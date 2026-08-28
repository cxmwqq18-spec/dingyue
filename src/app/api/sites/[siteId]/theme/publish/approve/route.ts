import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "public_content_approval_retired" }, { status: 410 });
}
