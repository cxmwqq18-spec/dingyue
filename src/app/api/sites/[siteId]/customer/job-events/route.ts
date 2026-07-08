import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { subscribeCustomerJobEvents, type CustomerJobEvent } from "@/lib/customer-job-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function encodeEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const current = await getCurrentCustomerForSite(siteId);
  if (!current) return new Response(null, { status: 401 });

  let cleanup: (() => void) | undefined;
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cleanup?.();
    },
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encodeEvent(event, data));
        } catch {
          closed = true;
        }
      };
      send("ready", { ok: true, siteId, customerId: current.customer.id, connectedAt: new Date().toISOString() });
      const unsubscribe = subscribeCustomerJobEvents(
        { siteId, customerId: current.customer.id },
        (event: CustomerJobEvent) => send("job", event)
      );
      cleanup = () => {
        closed = true;
        unsubscribe?.();
      };
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      "Connection": "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
