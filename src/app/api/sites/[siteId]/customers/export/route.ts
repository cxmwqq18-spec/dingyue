import { NextResponse } from "next/server";
import { getCurrentSiteAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const maxExportRows = 5000;
const exportBatchSize = 500;

function escapeCsv(value: string | number) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

function customerCsvLine(customer: {
  id: string;
  name: string;
  email: string;
  status: string;
  balance: { balance: number; reserved: number } | null;
}) {
  return [
    customer.id,
    customer.name,
    customer.email,
    customer.status,
    customer.balance?.balance ?? 0,
    customer.balance?.reserved ?? 0
  ]
    .map(escapeCsv)
    .join(",");
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params;
    if (!(await getCurrentSiteAdmin(siteId))) {
      return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let exportedRows = 0;
        let cursor: string | undefined;
        controller.enqueue(encoder.encode("customer_id,name,email,status,available_credits,reserved_credits\n"));
        while (exportedRows < maxExportRows) {
          const customers = await prisma.customer.findMany({
            where: { siteId },
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              balance: { select: { balance: true, reserved: true } }
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: Math.min(exportBatchSize, maxExportRows - exportedRows),
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
          });
          if (!customers.length) break;
          cursor = customers[customers.length - 1]?.id;
          exportedRows += customers.length;
          controller.enqueue(encoder.encode(`${customers.map(customerCsvLine).join("\n")}\n`));
        }
        controller.close();
      }
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="site-${siteId}-customers.csv"`
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "customers_export_failed" },
      { status: 500 }
    );
  }
}
