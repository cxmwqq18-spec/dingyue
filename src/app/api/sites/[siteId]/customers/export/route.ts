import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSiteAdminBySessionFromState, readPlatformState } from "@/lib/server-store";
import { siteAdminSessionCookie } from "@/lib/session";

function escapeCsv(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const state = readPlatformState();
  const sessionId = (await cookies()).get(siteAdminSessionCookie(siteId))?.value;
  if (!getSiteAdminBySessionFromState(state, siteId, sessionId)) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }

  const rows = state.customers
    .filter((customer) => customer.siteId === siteId)
    .map((customer) =>
      [
        customer.id,
        customer.name,
        customer.email,
        customer.status,
        customer.balance.available,
        customer.balance.reserved
      ]
        .map(escapeCsv)
        .join(",")
    );

  const csv = [["customer_id", "name", "email", "status", "available_credits", "reserved_credits"].join(","), ...rows].join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="site-${siteId}-customers.csv"`
    }
  });
}
